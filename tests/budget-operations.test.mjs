import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const native = createRequire(import.meta.url);
function load(file, deps = {}) {
  const out = {};
  new Function(
    "exports",
    "require",
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
      },
    }).outputText,
  )(out, (k) => deps[k] ?? native(k));
  return out;
}
const ops = load("lib/workspace/budget-operations.ts", {
  "../commercial/budget-input": load("lib/commercial/budget-input.ts"),
  "./action-errors": load("lib/workspace/action-errors.ts"),
});
const id = "00000000-0000-4000-8000-000000000001";
function form() {
  const f = new FormData();
  Object.entries({
    clientId: id,
    projectId: "",
    title: "Projeto de pesquisa",
    description: "",
    notes: "",
    validUntil: "",
    discountPercent: "30",
    items: JSON.stringify([
      { description: "Análise", quantity: 1, unitPrice: 100 },
    ]),
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
test("browser saves through protected RPC and returns confirmed budget ID without internal planning", async () => {
  let calls = 0;
  const r = await ops.saveBudget(
    {
      rpc: async (name, args) => {
        calls++;
        assert.equal(name, "save_client_budget_v3");
        assert.equal(args.payload.discountPercent, 30);
        assert.equal(args.payload.internalNotes, "");
        return { data: id, error: null };
      },
    },
    form(),
  );
  assert.equal(calls, 1);
  assert.equal(r.success, true);
  assert.equal(r.id, id);
});
test("invalid items do not reach database and archive propagates protected business errors", async () => {
  const f = form();
  f.set("items", "[]");
  assert.equal(
    (
      await ops.saveBudget(
        {
          rpc: () => {
            throw Error("must not call");
          },
        },
        f,
      )
    ).success,
    false,
  );
  const r = await ops.archiveBudget(
    {
      rpc: async () => ({
        error: {
          code: "P0001",
          message: "Resolva o pagamento antes de arquivar",
        },
      }),
    },
    id,
  );
  assert.equal(r.success, false);
  assert.match(r.message, /pagamento/);
});
test("uncertain save/archival never auto-retries or reports success", async () => {
  let calls = 0;
  const db = {
    rpc: async () => {
      calls++;
      throw Error("network");
    },
  };
  assert.equal((await ops.saveBudget(db, form())).success, false);
  assert.equal((await ops.archiveBudget(db, id)).success, false);
  assert.equal(calls, 2);
});

test("reviewed identity is saved in the same budget RPC without changing profile", async () => {
  const f = form();
  f.set(
    "clientDetails",
    JSON.stringify({ legal_name: "Nome revisado", institution: "" }),
  );
  const result = await ops.saveBudget(
    {
      rpc: async (name, { payload }) => {
        assert.deepEqual(payload.clientDetails, {
          legal_name: "Nome revisado",
          institution: "",
        });
        return { data: id, error: null };
      },
      from: () => {
        throw Error("Must not overwrite shared profile");
      },
    },
    f,
  );
  assert.equal(result.success, true);
});
const { budgetClientDefaults } = load("lib/commercial/budget-defaults.ts", {
  "./billing": load("lib/commercial/billing.ts"),
});
test("budget defaults prefer saved billing, preserve intentionally empty values and reuse request contact", () => {
  const request = {
    name: "Solicitante",
    email: "fixture@example.test",
    phone: "44999999999",
    intake: { institution: "Universidade" },
  };
  const fresh = budgetClientDefaults(null, { full_name: "Perfil" }, request);
  assert.equal(fresh.legal_name, "Solicitante");
  assert.equal(fresh.institution, "Universidade");
  const saved = budgetClientDefaults(
    { legal_name: "Revisado", institution: "" },
    null,
    request,
  );
  assert.equal(saved.legal_name, "Revisado");
  assert.equal(saved.institution, "");
  assert.equal(saved.email, "fixture@example.test");
});

test("reviewed request context uses the extended atomic save and preserves cleared fields", async () => {
  const f = form();
  f.set("requestDetails", JSON.stringify({ purpose: "Tese", department: "" }));
  const result = await ops.saveBudget(
    {
      rpc: async (name, { payload }) => {
        assert.equal(name, "save_client_budget_with_context");
        assert.deepEqual(payload.requestDetails, {
          purpose: "Tese",
          department: "",
        });
        return { data: id, error: null };
      },
    },
    f,
  );
  assert.equal(result.success, true);
  const missing = await ops.saveBudget(
    {
      rpc: async () => ({ error: { code: "PGRST202", message: "Not found" } }),
    },
    f,
  );
  assert.equal(missing.success, false);
  assert.match(missing.message, /ATUALIZAR-CONTEXTO-ORCAMENTO/);
});
test("request defaults and coefficient matching reuse known answers without inventing urgency fees", () => {
  const { budgetRequestDefaults, requestEstimateFactors } = load(
    "lib/commercial/budget-defaults.ts",
    { "./billing": load("lib/commercial/billing.ts") },
  );
  const r = budgetRequestDefaults(
    {
      title: "Pesquisa",
      description: "Demanda original",
      desired_date: "2026-12-10",
      intake: { purpose: "Tese", department: "Pós-graduação" },
    },
    { due_date: "2026-12-20" },
    "Padrão",
  );
  assert.equal(r.title, "Pesquisa");
  assert.equal(r.delivery, "2026-12-20");
  assert.equal(r.details.department, "Pós-graduação");
  const model = {
    coefficients: [
      { group: "Urgência", label: "Prazo curto", coefficient: 0.1 },
      { group: "Responsabilidade", label: "Tese", coefficient: 0.35 },
      { group: "Banco", label: "Banco limpo e organizado", coefficient: 0 },
    ],
  };
  assert.deepEqual(
    requestEstimateFactors(
      {
        urgency: "Prazo definido",
        purpose: "Tese",
        data_status: "Planilha organizada",
      },
      model,
    ),
    { Urgência: -1, Responsabilidade: 1, Banco: 2 },
  );
});
test("reviewed intake replaces legacy auto-filled lines without duplicating or exposing stale answers", () => {
  const { intakeDescription } = load("lib/commercial/intake.ts", {
    "../budget-request": load("lib/budget-request.ts"),
  });
  const text = intakeDescription(
    { purpose: "Tese", department: "" },
    "Demanda original\nFinalidade do trabalho: TCC\nDepartamento / instituição: Antigo",
  );
  assert.equal(text, "Demanda original\nFinalidade do trabalho: Tese");
});
