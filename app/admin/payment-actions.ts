"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export async function paymentAction(
  action: string,
  id: string,
  fields: Record<string, string> = {},
) {
  try {
    z.string().uuid().parse(id);
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw Error("Entre novamente.");
    const calls: Record<
      string,
      { name: string; args: Record<string, unknown> }
    > = {
      choose: { name: "choose_payment_offer", args: { p_id: id } },
      request: { name: "request_budget_payment", args: { p_id: id } },
      receipt: {
        name: "submit_payment_receipt",
        args: { p_id: id, p_path: fields.path },
      },
      instructions: {
        name: "manage_budget_payment",
        args: {
          p_id: id,
          p_action: "instrucoes",
          p_instructions: fields.instructions,
          p_url: fields.url,
        },
      },
      confirm: {
        name: "manage_budget_payment",
        args: { p_id: id, p_action: "confirmar" },
      },
      reject: {
        name: "manage_budget_payment",
        args: { p_id: id, p_action: "rejeitar" },
      },
    };
    if (!calls[action]) throw Error("Ação inválida.");
    const { error } = await db.rpc(calls[action].name, calls[action].args);
    if (error) throw Error(error.message);
    return {
      success: true,
      message:
        action === "choose"
          ? "Forma escolhida. Confira o PDF correspondente antes de aprovar e assinar."
          : "Atualização registrada.",
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : "Não foi possível concluir.",
    };
  }
}
export async function receiptDownload(id: string) {
  z.string().uuid().parse(id);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw Error("Entre novamente.");
  const { data, error } = await db
    .from("budget_payments")
    .select("receipt_path")
    .eq("id", id)
    .single();
  if (error || !data?.receipt_path) throw Error("Comprovante indisponível.");
  const r = await db.storage
    .from("payment-receipts")
    .createSignedUrl(data.receipt_path, 60, { download: true });
  if (r.error || !r.data) throw Error("Não foi possível abrir.");
  return r.data.signedUrl;
}
export async function savePaymentSettings(form: FormData) {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw Error("Entre novamente.");
    const options = z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          label: z.string().min(2).max(100),
          method: z.enum(["pix", "card"]),
          installments: z.number().int().min(1).max(12),
          feePercent: z.number().min(0).max(49.99),
          enabled: z.boolean(),
        }),
      )
      .min(1)
      .max(13)
      .parse(JSON.parse(String(form.get("options"))));
    if (new Set(options.map((o) => o.id)).size !== options.length)
      throw Error("Opções duplicadas.");
    const { error } = await db
      .from("payment_settings")
      .upsert({
        id: 1,
        options,
        pix_key: z.string().max(250).parse(form.get("pixKey")),
        instructions: z.string().max(4000).parse(form.get("instructions")),
      });
    if (error)
      throw Error(
        "Não foi possível salvar. Confira a migração e seu acesso admin.",
      );
    return {
      success: true,
      message:
        "Taxas salvas. As próximas propostas usarão estes valores; PDFs existentes não mudam.",
    };
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof z.ZodError
          ? "Revise as taxas e parcelas."
          : e instanceof Error
            ? e.message
            : "Falha ao salvar.",
    };
  }
}
