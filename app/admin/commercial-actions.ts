"use server";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
    const { error } = await db
      .from("document_templates")
      .upsert({ ...data, native_body: data.body });
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
  const reference = randomUUID().slice(0, 8);
  let stage = "session";
  try {
    z.string().uuid().parse(id);
    if (reviewed !== true) throw Error("Confira o PDF e confirme a revisão.");
    const { db } = await session(true);
    stage = "publish";
    const { error } = await db.rpc("publish_commercial_document", { p_id: id });
    if (error) {
      console.error("[HAS_COMMERCIAL_PUBLISH_FAILED]", { reference, stage, code: error.code });
      return { success: false, message: `Não foi possível disponibilizar: ${error.message} (referência ${reference}).` };
    }
    stage = "verify";
    const { data: published, error: verificationError } = await db
      .from("commercial_documents")
      .select("status,published_at")
      .eq("id", id)
      .single();
    if (verificationError || !published?.published_at || !["enviado", "aprovado"].includes(published.status)) {
      console.error("[HAS_COMMERCIAL_PUBLISH_FAILED]", { reference, stage, code: verificationError?.code ?? "publication_not_confirmed" });
      return { success: false, message: `Não foi possível confirmar a disponibilização. Atualize a lista antes de tentar novamente. Referência: ${reference}.` };
    }
    return {
      success: true,
      message:
        "Documento disponível na área do cliente. O aviso foi registrado na fila de e-mail; confira a entrega na aba Avisos.",
    };
  } catch (e) {
    console.error("[HAS_COMMERCIAL_PUBLISH_FAILED]", { reference, stage, code: "action_failed" });
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
export async function submitCommercialSignature(
  id: string,
  path: string,
  receipt?: string,
) {
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
    const { error } = await db.rpc(
      receipt ? "submit_contract_package" : "submit_signed_commercial",
      {
        p_id: id,
        p_path: path,
        ...(receipt ? { p_receipt: receipt } : {}),
      },
    );
    if (error) throw Error(error.message);
    return {
      success: true,
      message: "PDF recebido. A assinatura será conferida pela administração.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function registerProviderSignature(id: string, path: string) {
  try {
    z.string().uuid().parse(id);
    const { db } = await session(true);
    const { data: d } = await db
      .from("commercial_documents")
      .select("client_id")
      .eq("id", id)
      .single();
    if (
      !d ||
      !path.startsWith(`${d.client_id}/${id}/`) ||
      !path.endsWith(".pdf")
    )
      throw Error("Arquivo inválido.");
    const { data: file, error } = await db.storage
      .from("commercial-documents")
      .download(path);
    if (error || !file || file.size > 20 * 1024 * 1024)
      throw Error("Envie um PDF de até 20 MB.");
    await PDFDocument.load(await file.arrayBuffer());
    const { error: save } = await db.rpc("register_provider_signature", {
      p_id: id,
      p_path: path,
    });
    if (save) throw Error(save.message);
    return {
      success: true,
      message:
        "PDF assinado pela HAS registrado. Confira a versão antes de disponibilizar.",
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

export async function discardContractDraft(id: string) {
  try {
    z.string().uuid().parse(id);
    const { db } = await session(true);
    const { error } = await db.rpc("discard_contract_draft", { p_id: id });
    if (error) throw Error(
      ["PGRST202", "42883"].includes(error.code)
        ? "Aplique DESCARTAR-CONTRATOS-RASCUNHO.sql no Supabase para habilitar esta opção."
        : error.message,
    );
    return { success: true, message: "Rascunho retirado da lista ativa. Os arquivos permanecem no histórico privado." };
  } catch (e) { return failure(e); }
}
