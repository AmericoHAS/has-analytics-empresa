import type { SupabaseClient } from "@supabase/supabase-js";
import { actionError } from "./action-errors";

// Uses the signed-in browser session. The RPC enforces admin authorization and
// preserves linked documents/budgets transactionally; never fall back to DELETE.
export async function deleteProject(
  db: Pick<SupabaseClient, "rpc">,
  projectId: string,
  clientId: string,
) {
  try {
    const { data, error } = await db.rpc("delete_client_project", {
      p_project_id: projectId,
      p_client_id: clientId,
    });
    if (error)
      return {
        success: false,
        message: actionError(error, "excluir o projeto"),
      };
    if (data !== true)
      return {
        success: false,
        message:
          "O projeto não foi encontrado para este cliente. Atualize a lista para conferir.",
      };
    return {
      success: true,
      message: "Projeto excluído. Documentos e orçamentos foram preservados.",
    };
  } catch {
    return {
      success: false,
      message:
        "A conexão foi interrompida e não foi possível confirmar o resultado. Atualize a lista antes de tentar excluir novamente.",
    };
  }
}
