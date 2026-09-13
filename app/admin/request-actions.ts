"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["nova", "em_analise", "respondida", "concluida"]),
});

export async function updateRequestStatus(
  id: string,
  status: string,
): Promise<{ success: boolean; message: string }> {
  const input = updateSchema.safeParse({ id, status });
  if (!input.success)
    return { success: false, message: "Solicitação ou situação inválida." };
  try {
    const session = await createClient();
    const { data, error } = await session.auth.getClaims();
    const adminId = data?.claims?.sub;
    if (error || !adminId)
      return {
        success: false,
        message: "Entre novamente com seu acesso administrativo.",
      };
    const { data: profile, error: profileError } = await session
      .from("profiles")
      .select("role")
      .eq("id", adminId)
      .single();
    if (profileError || profile?.role !== "admin")
      return {
        success: false,
        message: "Apenas o administrador pode atualizar solicitações.",
      };
    const admin = createAdminClient();
    const { data: changed, error: updateError } = await admin
      .from("budget_requests")
      .update({ status: input.data.status })
      .eq("id", input.data.id)
      .select("id")
      .single();
    if (updateError || !changed)
      return {
        success: false,
        message: "Não foi possível atualizar a solicitação.",
      };
    revalidatePath("/admin");
    return { success: true, message: "Situação atualizada." };
  } catch {
    return {
      success: false,
      message: "Não foi possível atualizar agora. Tente novamente.",
    };
  }
}
