"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { actionError } from "@/lib/workspace/action-errors";
export type BudgetActionState = { success: boolean; message: string };
const input = z.object({
  publicationPartnership: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  requestId: z.union([z.string().uuid(), z.literal("")]).default(""),
  paymentTerms: z.string().max(3000).default(""),
  finalDueDate: z.union([z.string().date(), z.literal("")]).default(""),
  dataAssessment: z.string().max(3000).default(""),
  complexity: z.string().max(200).default(""),
  internalNotes: z.string().max(15000).default(""),
  department: z.string().max(250).default(""),
  estimatedHours: z.coerce.number().min(0).max(100000).default(0),
  baseValue: z.coerce.number().min(0).max(10000000).default(0),
  additions: z.coerce.number().min(0).max(10000000).default(0),
  clientId: z.string().uuid(),
  projectId: z.union([z.string().uuid(), z.literal("")]),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(15000),
  notes: z.string().max(15000),
  validUntil: z.union([z.string().date(), z.literal("")]),
  discountPercent: z.coerce.number().finite().min(0).max(100),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(3000),
        quantity: z.number().finite().positive().max(100000).multipleOf(0.01),
        unitPrice: z.number().finite().min(0).max(1000000).multipleOf(0.01),
      }),
    )
    .min(1)
    .max(100),
});
async function admin() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw Error("Entre novamente para continuar.");
  const { data } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin") throw Error("Acesso restrito.");
  return db;
}
export async function createBudgetAction(
  _previous: BudgetActionState,
  form: FormData,
): Promise<BudgetActionState> {
  try {
    const db = await admin();
    const data = input.parse({
      ...Object.fromEntries(form),
      items: JSON.parse(String(form.get("items") || "[]")),
    });
    const id = String(form.get("budgetId") || "");
    if (id) z.string().uuid().parse(id);
    const { error } = await db.rpc("save_client_budget_v3", {
      payload: { ...data, id: id || null },
    });
    if (error)
      return {
        success: false,
        message: actionError(error, "salvar o orçamento"),
      };
    revalidatePath("/admin");
    return { success: true, message: "Orçamento salvo com sucesso." };
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof z.ZodError
          ? "Confira o campo " +
            (e.issues[0]?.path.join(" → ") || "do orçamento") +
            ": " +
            (e.issues[0]?.message || "valor inválido")
          : e instanceof Error
            ? e.message
            : "Não foi possível salvar.",
    };
  }
}
export async function updateBudgetStatusAction(
  form: FormData,
): Promise<BudgetActionState> {
  try {
    const db = await admin();
    const id = z.string().uuid().parse(form.get("budgetId"));
    const status = z
      .enum([
        "rascunho",
        "enviado",
        "aprovado",
        "recusado",
        "expirado",
        "cancelado",
      ])
      .parse(form.get("status"));
    if (status === "enviado")
      return {
        success: false,
        message:
          "Confira o PDF e use Enviar ao cliente no orçamento para disponibilizar a proposta.",
      };
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
    revalidatePath("/admin");
    return { success: true, message: "Situação do orçamento atualizada." };
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar. Entre novamente.",
    };
  }
}
export async function deleteBudgetAction(
  form: FormData,
): Promise<BudgetActionState> {
  try {
    const db = await admin();
    const id = z.string().uuid().parse(form.get("budgetId"));
    const { error } = await db.rpc("archive_client_budget", { p_id: id });
    if (error)
      return {
        success: false,
        message: actionError(error, "arquivar o orçamento"),
      };
    revalidatePath("/admin");
    revalidatePath("/area-cliente");
    return {
      success: true,
      message: "Orçamento arquivado. Os documentos foram preservados.",
    };
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof Error
          ? e.message
          : "Não foi possível arquivar. Entre novamente.",
    };
  }
}
