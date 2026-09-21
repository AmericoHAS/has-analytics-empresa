"use server";
import { actionError } from "@/lib/workspace/action-errors";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteClientProjectAction(
  projectId: string,
  clientId: string,
) {
  if (
    !z.string().uuid().safeParse(projectId).success ||
    !z.string().uuid().safeParse(clientId).success
  )
    return { success: false, message: "Projeto ou cliente inválido." };
  try {
    const db = await createClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user)
      return { success: false, message: "Entre novamente para continuar." };
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin")
      return { success: false, message: "Acesso não autorizado." };
    const { data, error } = await db.rpc("delete_client_project", {
      p_project_id: projectId,
      p_client_id: clientId,
    });
    if (error)
      return {
        success: false,
        message: actionError(error, "excluir o projeto"),
      };
    if (!data)
      return {
        success: false,
        message: "Projeto não encontrado. Atualize a lista.",
      };
    revalidatePath("/admin");
    revalidatePath("/area-cliente");
    return {
      success: true,
      message:
        "Projeto excluído. Documentos e orçamentos continuam na área do cliente.",
    };
  } catch {
    return {
      success: false,
      message:
        "Não foi possível conectar para excluir. Os dados foram preservados; entre novamente e tente de novo.",
    };
  }
}
