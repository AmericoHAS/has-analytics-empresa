import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
const require = createRequire(import.meta.url);
let crashInjected = false;
function load(file, recoverPrint = false) {
  const exports = {};
  new Function(
    "exports",
    "require",
    "Buffer",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
  )(
    exports,
    (id) =>
      id === "./template-engine"
        ? load("lib/commercial/template-engine.ts", recoverPrint)
        : id === "./pdf-print"
          ? recoverPrint === "closed"
            ? {
                ...load("lib/commercial/pdf-print.ts"),
                printTemplatePdf: async (page, reference) => {
                  if (!crashInjected) {
                    crashInjected = true;
                    await page.context().browser().close();
                  }
                  return load("lib/commercial/pdf-print.ts").printTemplatePdf(page, reference);
                },
              }
            : recoverPrint
            ? {
                printTemplatePdf: (page, reference) => {
                  let attempt = 0;
                  return load("lib/commercial/pdf-print.ts").printTemplatePdf(
                    {
                      pdf: (options) => {
                        if (++attempt === 1)
                          throw Error("Page.printToPDF: Printing failed");
                        return page.pdf(options);
                      },
                    },
                    reference,
                  );
                },
                isChromiumPrintFailure: load("lib/commercial/pdf-print.ts")
                  .isChromiumPrintFailure,
              }
            : load("lib/commercial/pdf-print.ts")
          : id === "./pdf-runtime"
            ? load("lib/commercial/pdf-runtime.ts")
          : id === "../budget-request"
            ? load("lib/budget-request.ts")
            : require(id),
    Buffer,
  );
  return exports;
}
const { renderCommercial, documentLines } = load("lib/commercial/render.ts");
const { billingSchema } = load("lib/commercial/billing.ts");
const sample = {
  reference: "TEST-001",
  kind: "contrato",
  title: "Análise estatística de pesquisa — demonstração",
  body: "Condições ajustadas entre as partes.\nTrês fases: organização, análise e relatório.",
  created: "19/09/2026",
  client: {
    legal_name: "Cliente de Teste",
    tax_id: "12345678901",
    email: "teste@example.test",
    phone: "44999998888",
    address: "Rua de Teste, 10",
    city: "Maringá",
    state: "PR",
    postal_code: "87000000",
    institution: "Instituição de Teste",
    representative: "",
  },
  provider: {
    provider_name: "HAS Analytics — Exemplo",
    provider_tax_id: "12345678901",
    provider_address: "Endereço demonstrativo",
    provider_contact: "teste@example.test",
  },
  budget: {
    number: "ORC-TESTE",
    description: "Análise e interpretação de dados experimentais.",
    notes:
      "Entrega após recebimento do banco e confirmação das condições acordadas.",
    subtotal: 810,
    discount: 10,
    total: 729,
    payment: "Pix: 50% no início e 50% na entrega",
    due: "2026-10-20",
    validity: "2026-09-30",
  },
  items: [
    { description: "Organização do banco", quantity: 1, unit_price: 250 },
    { description: "Análise estatística", quantity: 8, unit_price: 70 },
    { description: "Relatório e interpretação", quantity: 1, unit_price: 0 },
  ],
};
test("billing rejects incomplete legal identity and keeps Brazilian accented text", () => {
  assert.equal(billingSchema.safeParse(sample.client).success, true);
  assert.equal(
    billingSchema.safeParse({ ...sample.client, tax_id: "123" }).success,
    false,
  );
  assert.equal(
    billingSchema.safeParse({ ...sample.client, address: "" }).success,
    false,
  );
});
test("PDF and genuine DOCX contain one consistent version and agreed amounts", async () => {
  const files = await renderCommercial(sample);
  assert.equal(files.pdf.subarray(0, 5).toString(), "%PDF-");
  const pdf = await PDFDocument.load(files.pdf);
  assert.ok(pdf.getPageCount() >= 1);
  const zip = await JSZip.loadAsync(files.word);
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /Cliente de Teste/);
  assert.match(xml, /TEST-001/);
  assert.match(xml, /729,00/);
  assert.match(xml, /Três fases/);
  assert.ok(documentLines(sample).join(" ").includes("50%"));
  if (process.env.QA_ARTIFACTS) {
    fs.mkdirSync("../commercial-qa", { recursive: true });
    fs.writeFileSync("../commercial-qa/sample.pdf", files.pdf);
    fs.writeFileSync("../commercial-qa/sample.docx", files.word);
  }
});
test("native templates preserve long conditions without unresolved tokens", async () => {
  const files = await renderCommercial({
    ...sample,
    body: "Cláusula de teste com texto extenso. ".repeat(250),
  });
  assert.ok((await PDFDocument.load(files.pdf)).getPageCount() > 3);
  const z = await JSZip.loadAsync(files.word);
  assert.doesNotMatch(
    await z.file("word/document.xml").async("string"),
    /\{\{/,
  );
});

function actions(role = "client", signed = true, generation = false) {
  let storageCalls = 0;
  const imports = {
    zod: require("zod"),
    "@/lib/commercial/payments": load("lib/commercial/payments.ts"),
    "node:crypto": require("node:crypto"),
    "pdf-lib": require("pdf-lib"),
    "@/lib/commercial/render": { renderCommercial },
    "@/lib/commercial/billing": { billingSchema },
    "@/lib/commercial/intake": load("lib/commercial/intake.ts"),
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: {
              user: signed
                ? { id: "11111111-1111-4111-8111-111111111111" }
                : null,
            },
          }),
        },
        from: (table) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: table === "profiles" ? { role } : null,
                error: null,
              }),
            }),
          }),
        }),
        storage: {
          from: () => {
            storageCalls++;
            throw Error("Storage must not be reached");
          },
        },
      }),
    },
  };
  const exports = {};
  new Function(
    "exports",
    "require",
    ts.transpileModule(
      fs.readFileSync(generation ? "lib/commercial/generate.ts" : "app/admin/commercial-actions.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText,
  )(exports, (id) => imports[id]);
  return { exports, calls: () => storageCalls };
}
test("server denies client Word access before touching storage", async () => {
  const a = actions();
  await assert.rejects(
    () =>
      a.exports.commercialDownload(
        "30000000-0000-4000-8000-000000000001",
        "word",
      ),
    /exclusivo/,
  );
  assert.equal(a.calls(), 0);
});
test("server prevents non-admin document generation and unauthenticated downloads", async () => {
  const a = actions();
  const result = await actions("client", true, true).exports.generateCommercialDocument(new FormData());
  assert.equal(result.success, false);
  assert.match(result.message, /restrito/);
  assert.equal(a.calls(), 0);
  await assert.rejects(
    () =>
      actions("client", false).exports.commercialDownload(
        "30000000-0000-4000-8000-000000000001",
        "pdf",
      ),
    /Entre novamente/,
  );
});
test("publication requires an explicit review confirmation", async () => {
  const a = actions("admin");
  const result = await a.exports.publishCommercial(
    "30000000-0000-4000-8000-000000000001",
    false,
  );
  assert.equal(result.success, false);
  assert.match(result.message, /confirme/);
  assert.equal(a.calls(), 0);
});

test("all three documents use original template assets and fill every placeholder", async () => {
  for (const kind of ["orcamento", "contrato", "recibo"]) {
    const files = await renderCommercial({
      ...sample,
      kind,
      template: {
        amountWords: "setecentos e vinte e nove reais",
        revisions: "1",
        forumCity: "Maringá — PR",
      },
    });
    const native = await JSZip.loadAsync(
      fs.readFileSync(`templates/has/modelo_${kind}_HAS.docx`),
    );
    const filled = await JSZip.loadAsync(files.word);
    for (const name of Object.keys(native.files).filter(
      (n) => n.startsWith("word/media/") && !native.files[n].dir,
    )) {
      assert.deepEqual(
        await native.file(name).async("nodebuffer"),
        await filled.file(name).async("nodebuffer"),
      );
    }
    assert.doesNotMatch(
      await filled.file("word/document.xml").async("string"),
      /\{\{/,
    );
    assert.ok((await PDFDocument.load(files.pdf)).getPageCount() >= 1);
    if (process.env.QA_ARTIFACTS) {
      fs.writeFileSync(`../commercial-qa/${kind}.pdf`, files.pdf);
      fs.writeFileSync(`../commercial-qa/${kind}.docx`, files.word);
    }
  }
});

test("real Chromium recovery renders all native templates after an injected print failure", async () => {
  const recoveredRender = load(
    "lib/commercial/render.ts",
    true,
  ).renderCommercial;
  for (const kind of ["orcamento", "contrato", "recibo"]) {
    const files = await recoveredRender({
      ...sample,
      kind,
      template: {
        amountWords: "setecentos e vinte e nove reais",
        revisions: "1",
        forumCity: "Maringá — PR",
      },
    });
    assert.ok((await PDFDocument.load(files.pdf)).getPageCount() >= 1);
    assert.match(
      await (
        await JSZip.loadAsync(files.word)
      )
        .file("word/document.xml")
        .async("string"),
      /Cliente de Teste/,
    );
    if (process.env.QA_ARTIFACTS) {
      fs.mkdirSync("../pdf-recovery-qa", { recursive: true });
      fs.writeFileSync(`../pdf-recovery-qa/${kind}.pdf`, files.pdf);
      fs.writeFileSync(`../pdf-recovery-qa/${kind}.docx`, files.word);
    }
  }
});

test("stage and additional-service unit prices never appear in native proposal or contract text", async () => {
  const { templateValues } = load("lib/commercial/render.ts");
  const data = {
    ...sample,
    items: [
      ...sample.items,
      {
        description: "Validação complementar",
        quantity: 7,
        unit_price: 123.45,
      },
    ],
  };
  const values = templateValues(data);
  assert.equal(
    values.DESCRICAO_SERVICOS,
    data.items.map((i) => i.description).join("\n"),
  );
  assert.ok(Object.values(values).some(value => value.includes("Validação complementar")));
  assert.doesNotMatch(values.OBSERVACOES, /123,45|7 ×/);
  assert.match(values.VALOR_FINAL, /729,00/);
  const { fillHasTemplate } = load("lib/commercial/template-engine.ts");
  for (const kind of ["orcamento", "contrato"]) {
    const { word } = await fillHasTemplate(kind, values);
    const zip = await JSZip.loadAsync(word);
    const xml = await zip.file("word/document.xml").async("string");
    assert.doesNotMatch(xml, /123,45|7 ×/);
    assert.match(xml, /729,00/);
  }
});


test("a real closed browser is discarded and the proposal is rendered in a new browser", async () => {
  crashInjected = false;
  const render = load("lib/commercial/render.ts", "closed").renderCommercial;
  const files = await render({ ...sample, kind: "orcamento" });
  assert.equal(crashInjected, true);
  assert.ok((await PDFDocument.load(files.pdf)).getPageCount() >= 1);
});


test("six consecutive native proposals release browser profiles after every generation", async () => {
  const { readdir, mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, dirname, resolve, basename } = await import("node:path");
  const parent=tmpdir();
  const own=await mkdtemp(join(parent,"has-pdf-sequence-"));
  const previous=Object.fromEntries(["TMPDIR","TEMP","TMP"].map(key=>[key,process.env[key]]));
  try {
    for(const key of Object.keys(previous)) process.env[key]=own;
    for (let i=0;i<6;i++) {
      const result = await renderCommercial({...sample, kind: "orcamento", reference: `SEQUENTIAL-${i}`, budget: {...sample.budget, total: 810 + i * 20}});
      assert.ok((await PDFDocument.load(result.pdf)).getPageCount() > 0);
      assert.ok(result.word.length > 0);
      const remaining = (await readdir(own)).filter(name => /^playwright_(chromium|edge).*profile-|^playwright-artifacts-/.test(name));
      assert.deepEqual(remaining, [], `Browser temporaries retained after PDF ${i+1}`);
    }
  } finally {
    for(const [key,value] of Object.entries(previous)) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
    assert.equal(dirname(resolve(own)),resolve(parent));assert.ok(basename(own).startsWith("has-pdf-sequence-"));
    await rm(own,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(error => {
      // Windows graphics drivers may retain their Intel cache after Edge exits.
      // Browser profiles/artifacts were checked separately after every render.
      if (process.platform !== "win32" || error.code !== "EPERM" || !String(error.path).startsWith(join(own,"Intel"))) throw error;
      console.info("Windows driver cache retained; all six browser profile cleanup checks passed.");
    });
  }
});


test("client demand and admin scope stay distinct; fourth and fifth phases keep native rows", async () => {
  const { originalRequestDescription } = load("lib/commercial/intake.ts");
  const { templateValues } = load("lib/commercial/render.ts");
  const demand = "Preciso avaliar a associação entre os tratamentos e a resposta clínica.";
  const scope = "Ajustar modelos mistos e verificar pressupostos com relatório reproduzível.";
  const input = { ...sample, budget: { ...sample.budget, description: scope },
    template: { requestText: originalRequestDescription(demand + "\n\n[Solicita orçamento e acesso à área do cliente. Autoriza contato sobre esta demanda.]") },
    items: [
      {description:"Organização",quantity:1,unit_price:100},
      {description:"Análise",quantity:1,unit_price:200},
      {description:"Relatório",quantity:1,unit_price:300},
      {description:"Orientação nas correções do trabalho\nAcompanhamento das análises",quantity:1,unit_price:150},
      {description:"Revisão complementar",quantity:1,unit_price:50},
    ] };
  const values=templateValues(input);
  assert.equal(values.SOLICITACAO_CLIENTE,demand);
  assert.equal(values.DESCRICAO_ANALISE_HAS,scope);
  assert.equal(templateValues({...input,template:{}}).SOLICITACAO_CLIENTE,"");
  for(const kind of ["orcamento","contrato"]) {
    const result=await renderCommercial({...input,kind});
    const zip=await JSZip.loadAsync(result.word);
    const xml=await zip.file('word/document.xml').async('string');
    const text=xml.replace(/<[^>]+>/g,'');
    assert.match(text,/Fase 4/); assert.match(text,/Fase 5/);
    assert.match(text,/Orientação nas correções/); assert.match(text,/Revisão complementar/);
    assert.doesNotMatch(text,/Solicita orçamento e acesso/);
    if(kind==='contrato') {
      const rows=xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g);
      assert.ok(rows.some(row=>row.includes('Fase 4') && row.includes('Orientação nas correções')));
    }
    assert.ok((await PDFDocument.load(result.pdf)).getPageCount()>0);
    fs.mkdirSync('../budget-fields-qa',{recursive:true});
    fs.writeFileSync(`../budget-fields-qa/${kind}.pdf`,result.pdf);
    fs.writeFileSync(`../budget-fields-qa/${kind}.docx`,result.word);
  }
});
