"use server";
import {
  quotePayment,
  paymentDescription,
  type PaymentOption,
} from "@/lib/commercial/payments";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  renderCommercial,
  type DocumentSnapshot,
} from "@/lib/commercial/render";
import { billingSchema } from "@/lib/commercial/billing";
async function session(admin = false) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw Error("Entre novamente para continuar.");
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  if (admin && !isAdmin) throw Error("Acesso restrito ao administrador.");
  return { db, user, isAdmin };
}
function failure(e: unknown) {
  return {
    success: false,
    message:
      e instanceof z.ZodError
        ? "Revise os campos informados."
        : e instanceof Error
          ? e.message
          : "Não foi possível concluir.",
  };
}
export async function saveDocumentTemplate(form: FormData) {
  try {
    const { db } = await session(true);
    const data = z
      .object({
        kind: z.enum(["orcamento", "contrato"]),
        body: z.string().max(20000),
        provider_name: z.string().trim().max(180),
        provider_tax_id: z.string().trim().max(30),
        provider_address: z.string().trim().max(500),
        provider_contact: z.string().trim().max(300),
      })
      .parse(Object.fromEntries(form));
    const { error } = await db.from("document_templates").upsert(data);
    if (error)
      throw Error(
        "Não foi possível salvar o modelo. Confira a atualização comercial do banco.",
      );
    return {
      success: true,
      message: "Modelo salvo. Versões anteriores permanecem inalteradas.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function generateCommercialDocument(form: FormData) {
  const paths: string[] = [];
  let db: Awaited<ReturnType<typeof createClient>> | undefined;
  try {
    const auth = await session(true);
    db = auth.db;
    const input = z
      .object({
        budgetId: z.string().uuid(),
        kind: z.enum(["orcamento", "contrato"]),
        body: z.string().max(20000),
        title: z.string().trim().min(3).max(300),
      })
      .parse(Object.fromEntries(form));
    const { data: b, error: be } = await db
      .from("client_budgets")
      .select("*")
      .eq("id", input.budgetId)
      .single();
    if (be || !b) throw Error("Orçamento não encontrado.");
    if (input.kind === "contrato" && b.status !== "aprovado")
      throw Error("O orçamento precisa estar aprovado para gerar contrato.");
    const [
      { data: client, error: ce },
      { data: provider, error: pe },
      { data: items, error: ie },
    ] = await Promise.all([
      db
        .from("client_billing_profiles")
        .select("*")
        .eq("client_id", b.client_id)
        .single(),
      db.from("document_templates").select("*").eq("kind", input.kind).single(),
      db
        .from("client_budget_items")
        .select("description,quantity,unit_price")
        .eq("budget_id", b.id)
        .order("display_order"),
    ]);
    if (ce || !client || !billingSchema.safeParse(client).success)
      throw Error("Complete primeiro os dados do cliente na aba Cadastro.");
    if (pe || !provider || ie || !items?.length)
      throw Error("Confira o modelo e os itens do orçamento.");
    if (
      !provider.provider_name?.trim() ||
      !provider.provider_tax_id?.trim() ||
      !provider.provider_address?.trim()
    )
      throw Error(
        "Abra Modelo e dados do prestador, preencha nome, CPF/CNPJ e endereço da HAS e salve antes de gerar o PDF.",
      );
    const { data: settings, error: se } = await db
      .from("payment_settings")
      .select("options")
      .eq("id", 1)
      .single();
    if (se)
      throw Error(
        "Aplique ATUALIZAR-FLUXO-PAGAMENTO.sql antes de gerar os documentos.",
      );
    const { data: chosen } = await db
      .from("budget_payments")
      .select("option")
      .eq("budget_id", b.id)
      .maybeSingle();
    const options: PaymentOption[] =
      input.kind === "orcamento"
        ? (settings?.options ?? []).filter((o: PaymentOption) => o.enabled)
        : [];
    if (input.kind === "orcamento" && !options.length)
      throw Error(
        "Ative ao menos uma forma de pagamento nos Modelos Comerciais.",
      );
    const group = randomUUID();
    const rows: Record<string, unknown>[] = [];
    const variants =
      input.kind === "orcamento"
        ? options.map((o) => quotePayment(Number(b.total), o))
        : [chosen?.option ?? null];
    for (const payment of variants) {
      const id = randomUUID();
      const reference = id.slice(0, 8).toUpperCase();
      const snapshot: DocumentSnapshot = {
        reference,
        kind: input.kind,
        title: input.title,
        body: input.body,
        created: new Date().toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        client: billingSchema.parse(client),
        provider: {
          provider_name: provider.provider_name,
          provider_tax_id: provider.provider_tax_id,
          provider_address: provider.provider_address,
          provider_contact: provider.provider_contact,
        },
        budget: {
          number: b.budget_number,
          description: b.description ?? "",
          notes:
            (b.notes ?? "") +
            (b.publication_partnership
              ? "\nParceria em publicação: desconto de " +
                b.discount_percent +
                "%, conforme condições acordadas."
              : ""),
          subtotal: Number(b.subtotal),
          discount: Number(b.discount_percent),
          total: payment?.total ?? Number(b.total),
          payment: payment
            ? paymentDescription(payment)
            : (b.payment_terms ?? ""),
          due: b.final_due_date ?? "",
          validity: b.valid_until ?? "",
        },
        items: items.map((i) => ({
          ...i,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        })),
      };
      const files = await renderCommercial(snapshot);
      const pdfPath = `${b.client_id}/${id}/document.pdf`,
        wordPath = `${b.client_id}/${id}/editable.docx`;
      for (const [path, bytes, mime] of [
        [pdfPath, files.pdf, "application/pdf"],
        [
          wordPath,
          files.word,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      ] as const) {
        const { error } = await db.storage
          .from("commercial-documents")
          .upload(path, bytes, { contentType: mime, upsert: false });
        if (error) throw Error("Falha ao armazenar o documento privado.");
        paths.push(path);
      }
      rows.push({
        id,
        client_id: b.client_id,
        budget_id: b.id,
        kind: input.kind,
        title: input.title,
        body: input.body,
        snapshot,
        source_revision: b.revision,
        pdf_path: pdfPath,
        word_path: wordPath,
        payment_option: payment,
        offer_group: input.kind === "orcamento" ? group : null,
      });
    }
    const { error } = await db.from("commercial_documents").insert(rows);
    if (error)
      throw Error(
        "O orçamento pode ter mudado durante a geração. Atualize e tente novamente.",
      );
    return {
      success: true,
      message:
        "PDFs e Word gerados com as condições de pagamento. Confira cada opção e disponibilize o conjunto ao cliente.",
    };
  } catch (e) {
    if (db && paths.length)
      await db.storage.from("commercial-documents").remove(paths);
    return failure(e);
  }
}
export async function commercialDownload(
  id: string,
  format: "pdf" | "word" | "signed",
) {
  const { db, isAdmin } = await session();
  z.string().uuid().parse(id);
  z.enum(["pdf", "word", "signed"]).parse(format);
  if (format === "word" && !isAdmin)
    throw Error("O Word é exclusivo da administração.");
  const { data: d, error } = await db
    .from("commercial_documents")
    .select("pdf_path,word_path,signed_path")
    .eq("id", id)
    .single();
  if (error || !d) throw Error("Documento indisponível.");
  const path =
    format === "word"
      ? d.word_path
      : format === "signed"
        ? d.signed_path
        : d.pdf_path;
  if (!path) throw Error("Arquivo ainda não disponível.");
  const { data, error: linkError } = await db.storage
    .from("commercial-documents")
    .createSignedUrl(path, 60, { download: true });
  if (linkError || !data) throw Error("Não foi possível abrir o arquivo.");
  return data.signedUrl;
}
export async function publishCommercial(id: string, reviewed: boolean) {
  try {
    z.string().uuid().parse(id);
    if (reviewed !== true) throw Error("Confira o PDF e confirme a revisão.");
    const { db } = await session(true);
    const { error } = await db.rpc("publish_commercial_document", { p_id: id });
    if (error) throw Error(error.message);
    return { success: true, message: "Documento disponibilizado ao cliente." };
  } catch (e) {
    return failure(e);
  }
}
export async function decideCommercial(
  id: string,
  accept: boolean,
  note: string,
) {
  try {
    z.string().uuid().parse(id);
    z.boolean().parse(accept);
    z.string().max(2000).parse(note);
    const { db } = await session();
    const { error } = await db.rpc("decide_commercial_document", {
      p_id: id,
      p_accept: accept,
      p_note: note,
    });
    if (error) throw Error(error.message);
    return {
      success: true,
      message: accept
        ? "Aprovação registrada para esta versão."
        : "Resposta registrada. A administração receberá seu pedido de revisão.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function submitCommercialSignature(id: string, path: string) {
  try {
    z.string().uuid().parse(id);
    const { db, user } = await session();
    if (!path.startsWith(`${user.id}/signatures/`) || !path.endsWith(".pdf"))
      throw Error("Caminho de arquivo inválido.");
    const { data: file, error: fileError } = await db.storage
      .from("commercial-documents")
      .download(path);
    if (fileError || !file || file.size > 20 * 1024 * 1024)
      throw Error("Arquivo indisponível ou maior que 20 MB.");
    try {
      await PDFDocument.load(await file.arrayBuffer());
    } catch {
      throw Error(
        "O arquivo não é um PDF legível ou está protegido por senha.",
      );
    }
    const { error } = await db.rpc("submit_signed_commercial", {
      p_id: id,
      p_path: path,
    });
    if (error) throw Error(error.message);
    return {
      success: true,
      message: "PDF recebido. A assinatura será conferida pela administração.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function reviewCommercialSignature(id: string, valid: boolean) {
  try {
    z.string().uuid().parse(id);
    z.boolean().parse(valid);
    const { db } = await session(true);
    const { error } = await db.rpc("review_commercial_signature", {
      p_id: id,
      p_valid: valid,
    });
    if (error) throw Error(error.message);
    return { success: true, message: "Conferência registrada." };
  } catch (e) {
    return failure(e);
  }
}

export async function registerCommercialRevision(
  originalId: string,
  pdfPath: string,
  wordPath: string,
) {
  try {
    z.string().uuid().parse(originalId);
    const { db } = await session(true);
    const { data: d, error } = await db
      .from("commercial_documents")
      .select("*")
      .eq("id", originalId)
      .single();
    if (error || !d) throw Error("Documento de origem não encontrado.");
    for (const [path, ext] of [
      [pdfPath, ".pdf"],
      [wordPath, ".docx"],
    ])
      if (!path.startsWith(`${d.client_id}/revisions/`) || !path.endsWith(ext))
        throw Error("Arquivos de revisão inválidos.");
    const [{ data: pdf, error: pdfError }, { data: word, error: wordError }] =
      await Promise.all([
        db.storage.from("commercial-documents").download(pdfPath),
        db.storage.from("commercial-documents").download(wordPath),
      ]);
    if (
      pdfError ||
      wordError ||
      !pdf ||
      !word ||
      pdf.size > 20 * 1024 * 1024 ||
      word.size > 20 * 1024 * 1024
    )
      throw Error("Use arquivos PDF e DOCX de até 20 MB cada.");
    try {
      await PDFDocument.load(await pdf.arrayBuffer());
    } catch {
      throw Error("O PDF está inválido ou protegido por senha.");
    }
    const wordBytes = Buffer.from(await word.arrayBuffer());
    if (
      wordBytes.subarray(0, 2).toString() !== "PK" ||
      !wordBytes.includes(Buffer.from("word/document.xml"))
    )
      throw Error("Envie um arquivo Word no formato DOCX.");
    const { error: insertError } = await db
      .from("commercial_documents")
      .insert({
        client_id: d.client_id,
        budget_id: d.budget_id,
        kind: d.kind,
        title: d.title,
        body: d.body,
        snapshot: d.snapshot,
        source_revision: d.source_revision,
        pdf_path: pdfPath,
        word_path: wordPath,
        external_revision: true,
        payment_option: d.payment_option,
        offer_group: d.payment_option ? randomUUID() : null,
      });
    if (insertError)
      throw Error(
        "O orçamento mudou ou a revisão não pôde ser registrada. Gere uma versão atualizada antes de reenviar.",
      );
    return {
      success: true,
      message:
        "Revisão externa salva em rascunho. Confira se PDF e Word correspondem entre si e ao orçamento antes de disponibilizar.",
    };
  } catch (e) {
    return failure(e);
  }
}
