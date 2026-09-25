import {
  quotePayment,
  paymentDescription,
  type PaymentOption,
} from "@/lib/commercial/payments";
import { intakeDescription } from "@/lib/commercial/intake";
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
export async function generateCommercialDocument(form: FormData) {
  const paths: string[] = [];
  let db: Awaited<ReturnType<typeof createClient>> | undefined;
  try {
    const auth = await session(true);
    db = auth.db;
    const input = z
      .object({
        budgetId: z.string().uuid(),
        kind: z.enum(["orcamento", "contrato", "recibo"]),
        body: z.string().max(20000),
        title: z.string().trim().min(3).max(300),
        amountWords: z.string().max(500).default(""),
        transactionId: z.string().max(200).default(""),
        revisions: z.string().max(100).default("1"),
        forumCity: z.string().max(200).default("Maringá — PR"),
        paymentLink: z
          .union([z.literal(""), z.string().url().startsWith("https://")])
          .default(""),
      })
      .parse(Object.fromEntries(form));
    const { data: b, error: be } = await db
      .from("client_budgets")
      .select("*")
      .eq("id", input.budgetId)
      .single();
    if (be || !b) throw Error("Orçamento não encontrado.");
    if (b.archived_at)
      throw Error(
        "Orçamento arquivado: consulte os documentos já gerados no histórico.",
      );
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
      db
        .from("document_templates")
        .select("*")
        .eq("kind", input.kind === "recibo" ? "orcamento" : input.kind)
        .single(),
      db
        .from("client_budget_items")
        .select("description,quantity,unit_price")
        .eq("budget_id", b.id)
        .order("display_order"),
    ]);
    const documentClient = b.client_details ?? client;
    if (
      (!b.client_details && ce) ||
      !documentClient ||
      !billingSchema.safeParse(documentClient).success
    )
      throw Error(
        "Revise os dados do cliente em Editar orçamento (nome, CPF/CNPJ, contato e endereço) e salve antes de gerar.",
      );
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
      .select("options,pix_key,instructions")
      .eq("id", 1)
      .single();
    if (se)
      throw Error(
        "Aplique ATUALIZAR-FLUXO-PAGAMENTO.sql antes de gerar os documentos.",
      );
    const { data: chosen } = await db
      .from("budget_payments")
      .select("option,status,confirmed_at")
      .eq("budget_id", b.id)
      .maybeSingle();
    if (
      input.kind === "recibo" &&
      (chosen?.status !== "confirmado" || !input.amountWords.trim())
    )
      throw Error(
        "Confirme o recebimento integral e informe o valor por extenso antes de emitir recibo.",
      );
    const options: PaymentOption[] =
      input.kind === "orcamento"
        ? (settings?.options ?? []).filter((o: PaymentOption) => o.enabled)
        : [];
    if (input.kind === "orcamento" && !options.length)
      throw Error(
        "Ative ao menos uma forma de pagamento nos Modelos Comerciais.",
      );
    const { data: planning } = await db
      .from("budget_planning")
      .select("*")
      .eq("budget_id", b.id)
      .maybeSingle();
    const { data: request } = planning?.request_id
      ? await db
          .from("budget_requests")
          .select("description,intake")
          .eq("id", planning.request_id)
          .maybeSingle()
      : { data: null };
    if (input.kind === "contrato" && !chosen?.option)
      throw Error("O cliente precisa escolher e aprovar a forma de pagamento.");
    const { data: contract } = await db
      .from("commercial_documents")
      .select("id")
      .eq("budget_id", b.id)
      .eq("kind", "contrato")
      .in("status", ["enviado", "aprovado"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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
        client: billingSchema.parse(documentClient),
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
        template: {
          engine: "has-native-v1",
          contractNumber:
            input.kind === "recibo" && contract
              ? `CTR-${contract.id.slice(0, 8).toUpperCase()}`
              : undefined,
          amountWords: input.amountWords,
          transactionId: input.transactionId,
          paymentDate: chosen?.confirmed_at
            ? new Date(chosen.confirmed_at).toLocaleDateString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })
            : "",
          installments: String(chosen?.option?.installments ?? 1),
          projectTitle: b.title,
          department: planning?.department || documentClient.institution || "",
          requestText: intakeDescription(
            b.request_details ?? request?.intake ?? {},
            b.description || request?.description || "",
          ),
          revisions: input.revisions,
          forumCity: input.forumCity,
          signatureCity: documentClient.city,
          pixKey: settings?.pix_key ?? "",
          paymentInstructions: settings?.instructions ?? "",
          paymentLink: input.paymentLink,
          partnershipClause: b.publication_partnership
            ? "Parceria em publicação com desconto de " +
              b.discount_percent +
              "%, conforme escopo e responsabilidades acordados entre as partes."
            : "",
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
