"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  accessEmailConfig,
  sendClientAccessEmail,
} from "@/lib/auth/client-access-email";

export type CreateClientState = {
  success: boolean;
  message: string;
  clientId?: string;
};
async function requireAdmin() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw Error("Entre novamente na conta administrativa.");
  const { data } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin") throw Error("Acesso restrito ao administrador.");
  return db;
}
export async function resendClientAccess(
  clientId: string,
): Promise<CreateClientState> {
  try {
    const db = await requireAdmin();
    const { data, error } = await db
      .from("profiles")
      .select("role")
      .eq("id", clientId)
      .single();
    if (error || data?.role !== "client")
      throw Error("Selecione uma conta de cliente.");
    await sendClientAccessEmail(clientId);
    return {
      success: true,
      message:
        "E-mail de acesso aceito pelo serviço de envio. O cliente poderá definir sua senha.",
      clientId,
    };
  } catch (e) {
    return {
      success: false,
      message:
        e instanceof Error
          ? e.message
          : "Não foi possível enviar o acesso. Tente novamente.",
    };
  }
}
export async function createClientAction(
  _previousState: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  let clientId: string | undefined;
  try {
    const db = await requireAdmin();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const phone = String(formData.get("phone") ?? "").trim();
    const requestId = String(formData.get("requestId") ?? "");
    if (
      fullName.length < 2 ||
      fullName.length > 180 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      phone.length > 30
    )
      throw Error("Confira nome, e-mail e telefone.");
    if (requestId) {
      const { data: request, error } = await db
        .from("budget_requests")
        .select("email,client_id")
        .eq("id", requestId)
        .single();
      if (error || !request || request.email.trim().toLowerCase() !== email)
        throw Error(
          "Use o mesmo e-mail da solicitação para preparar o acesso.",
        );
      if (request.client_id)
        throw Error("Esta solicitação já possui cliente. Use Reenviar acesso.");
    }
    accessEmailConfig();
    const privileged = createAdminClient();
    const { data, error } = await privileged.auth.admin.createUser({
      email,
      password: randomUUID() + randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user)
      throw Error(
        error?.message?.match(/already|registered/i)
          ? "Este e-mail já possui conta. Use Vincular ao cliente e depois Reenviar acesso."
          : "Não foi possível cadastrar a conta. Confira os dados e tente novamente.",
      );
    clientId = data.user.id;
    const { error: profileError } = await privileged
      .from("profiles")
      .upsert({
        id: clientId,
        full_name: fullName,
        phone: phone || null,
        role: "client",
      });
    if (profileError)
      throw Error(
        "Conta criada, mas o perfil precisa ser conferido antes de reenviar o acesso.",
      );
    let warning = "";
    if (requestId) {
      const { error: linkError } = await db.rpc(
        "link_budget_request_by_email",
        { p_request_id: requestId },
      );
      if (linkError)
        warning =
          " O vínculo do projeto ficou pendente: aplique ATUALIZAR-PRIMEIRO-ACESSO.sql e use Vincular ao cliente.";
    }
    await sendClientAccessEmail(clientId);
    revalidatePath("/admin");
    return {
      success: true,
      clientId,
      message:
        "Cliente cadastrado. O serviço de e-mail aceitou o link para definir a senha." +
        warning,
    };
  } catch (e) {
    return {
      success: false,
      clientId,
      message:
        (clientId ? "A conta foi criada; não cadastre novamente. " : "") +
        (e instanceof Error
          ? e.message
          : "Falha de comunicação. Tente novamente."),
    };
  }
}
