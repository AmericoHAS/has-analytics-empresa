import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { budgetInput } from "../commercial/budget-input";
import { actionError } from "./action-errors";
type Database = Pick<SupabaseClient, "rpc" | "from">;
export type BudgetResult = { success: boolean; message: string; id?: string };
export async function saveBudget(
  db: Database,
  form: FormData,
): Promise<BudgetResult> {
  try {
    const payload = budgetInput.parse({
      ...Object.fromEntries(form),
      ...(form.has("clientDetails")
        ? { clientDetails: JSON.parse(String(form.get("clientDetails"))) }
        : {}),
      items: JSON.parse(String(form.get("items") || "[]")),
    });
    const id = String(form.get("budgetId") || "");
    if (id) z.string().uuid().parse(id);
    const { data, error } = await db.rpc("save_client_budget_v3", {
      payload: { ...payload, id: id || null },
    });
    if (error)
      return {
        success: false,
        message: actionError(error, "salvar o orçamento"),
      };
    if (typeof data !== "string")
      return {
        success: false,
        message:
          "O banco não confirmou o orçamento. Atualize a lista antes de tentar novamente.",
      };
    return {
      success: true,
      message:
        "Orçamento salvo. Abra PDF e envio para gerar e conferir a proposta.",
      id: data,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof z.ZodError
          ? "Confira o campo " +
            error.issues[0]?.path.join(" → ") +
            ": " +
            error.issues[0]?.message
          : "Não foi possível confirmar o salvamento. Seus campos foram mantidos. Confira a conexão e atualize a lista antes de repetir.",
    };
  }
}
export async function archiveBudget(
  db: Database,
  id: string,
): Promise<BudgetResult> {
  try {
    if (!z.string().uuid().safeParse(id).success)
      return {
        success: false,
        message: "Orçamento inválido. Atualize a lista.",
      };
    const { error } = await db.rpc("archive_client_budget", { p_id: id });
    if (error)
      return {
        success: false,
        message: actionError(error, "arquivar o orçamento"),
      };
    return {
      success: true,
      message: "Orçamento arquivado. Os documentos foram preservados.",
    };
  } catch {
    return {
      success: false,
      message:
        "A conexão foi interrompida. Atualize a lista para conferir se o orçamento foi arquivado antes de repetir.",
    };
  }
}
export async function changeBudgetStatus(
  db: Database,
  id: string,
  value: string,
): Promise<BudgetResult> {
  try {
    z.string().uuid().parse(id);
    const status = z
      .enum(["rascunho", "aprovado", "recusado", "expirado", "cancelado"])
      .parse(value);
    const { data, error } = await db
      .from("client_budgets")
      .update({
        status,
        approved_at: status === "aprovado" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error)
      return {
        success: false,
        message: actionError(error, "atualizar o orçamento"),
      };
    if (!data)
      return {
        success: false,
        message: "Orçamento não encontrado ou sem permissão.",
      };
    return { success: true, message: "Situação do orçamento atualizada." };
  } catch {
    return {
      success: false,
      message:
        "Não foi possível atualizar o status. Para enviar, use PDF e envio.",
    };
  }
}
