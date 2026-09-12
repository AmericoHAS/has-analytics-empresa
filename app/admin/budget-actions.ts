"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
export type BudgetActionState = { success: boolean; message: string };
const input = z.object({
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
    const { error } = await db.rpc("save_client_budget", {
      payload: { ...data, id: id || null },
    });
    if (error) throw Error(error.message);
    revalidatePath("/admin");
    return { success: true, message: "Orçamento salvo com sucesso." };
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof z.ZodError
          ? "Confira os campos e valores do orçamento."
          : e instanceof Error
            ? e.message
            : "Não foi possível salvar.",
    };
  }
}
export async function updateBudgetStatusAction(form: FormData) {
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
  const { error } = await db
    .from("client_budgets")
    .update({
      status,
      approved_at: status === "aprovado" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw Error(error.message);
  revalidatePath("/admin");
}
export async function deleteBudgetAction(form: FormData) {
  const db = await admin();
  const id = z.string().uuid().parse(form.get("budgetId"));
  const { error } = await db.from("client_budgets").delete().eq("id", id);
  if (error) throw Error(error.message);
  revalidatePath("/admin");
}
