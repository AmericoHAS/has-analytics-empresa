"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function authorize(clientId: string) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw Error("Entre novamente na conta administrativa.");
  const { data: actor } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (actor?.role !== "admin") throw Error("Acesso restrito ao administrador.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw Error("Cliente inválido.");
  const { data: client, error: clientError } = await db.from("profiles").select("role").eq("id", clientId).single();
  if (clientError || client?.role !== "client") throw Error("Selecione uma conta de cliente.");
  return { privileged: createAdminClient(), actorId: user.id };
}

export async function getClientAccessEmail(clientId: string) {
  try {
    const { privileged } = await authorize(clientId);
    const { data, error } = await privileged.auth.admin.getUserById(clientId);
    if (error || !data.user?.email) throw Error("Não foi possível consultar o e-mail de acesso.");
    return { success: true, email: data.user.email, message: "" };
  } catch (error) {
    return { success: false, email: "", message: error instanceof Error ? error.message : "Falha ao consultar a conta." };
  }
}

export async function changeClientAccessEmail(clientId: string, form: FormData) {
  let changedEmail = "";
  try {
    const { privileged, actorId } = await authorize(clientId);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const confirmation = String(form.get("confirmation") ?? "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("Informe um e-mail válido.");
    if (email !== confirmation) throw Error("Os e-mails informados precisam ser iguais.");
    if (form.get("confirmed") !== "yes") throw Error("Confirme a alteração antes de continuar.");
    const { data: current, error: readError } = await privileged.auth.admin.getUserById(clientId);
    if (readError || !current.user?.email) throw Error("Não foi possível consultar a conta. Tente novamente.");
    if (current.user.email.toLowerCase() === email) throw Error("Informe um e-mail diferente do atual.");
    if (current.user.email.toLowerCase() !== String(form.get("currentEmail") ?? "").toLowerCase()) throw Error("O e-mail foi alterado. Feche e abra esta opção novamente.");
    const { data, error } = await privileged.auth.admin.updateUserById(clientId, { email });
    if (error) {
      if (["email_exists", "user_already_exists"].includes(error.code ?? "") || /already.*(registered|exists)/i.test(error.message)) throw Error("Este e-mail já pertence a outra conta.");
      throw Error("Não foi possível alterar o e-mail. Confira os dados e tente novamente.");
    }
    if (data.user?.id !== clientId || data.user.email?.toLowerCase() !== email) throw Error("A alteração não foi confirmada pelo Supabase. Consulte novamente a conta.");
    changedEmail = data.user.email;
    // Billing contact and historical requests are independently editable records, not login mirrors.
    const { error: auditError } = await privileged.from("audit_log").insert({ actor_id: actorId, action: "client_access_email_changed", entity_type: "client", entity_id: clientId });
    revalidatePath("/admin");
    return { success: true, email: changedEmail, message: auditError ? "E-mail alterado. Não foi possível registrar a auditoria; confira o registro administrativo. Não repita a troca." : "E-mail de acesso alterado. A senha, o usuário e seus vínculos foram preservados." };
  } catch (error) {
    return { success: !!changedEmail, email: changedEmail, message: changedEmail ? "E-mail alterado, mas a atualização da tela ou auditoria falhou. Atualize a página; não repita a troca." : error instanceof Error ? error.message : "Falha de comunicação. Consulte o e-mail atual antes de tentar novamente." };
  }
}
