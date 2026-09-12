"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateClientState = {
  success: boolean;
  message: string;
};

export async function createClientAction(
  _previousState: CreateClientState,
  formData: FormData
): Promise<CreateClientState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return {
      success: false,
      message: "Preencha nome, e-mail e senha.",
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "A senha inicial deve possuir pelo menos 8 caracteres.",
    };
  }

  // Verifica a sessão de quem está executando a operação.
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const adminId = claimsData?.claims?.sub;

  if (claimsError || !adminId) {
    return {
      success: false,
      message: "Sessão administrativa inválida.",
    };
  }

  // Confirma no banco que o usuário realmente é administrador.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminId)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      success: false,
      message: "Você não possui permissão para cadastrar clientes.",
    };
  }

  // Somente depois das verificações utilizamos o cliente privilegiado.
  const adminSupabase = createAdminClient();

  const {
    data: createdUser,
    error: createError,
  } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createError) {
    if (
      createError.message.toLowerCase().includes("already") ||
      createError.message.toLowerCase().includes("registered")
    ) {
      return {
        success: false,
        message: "Já existe um usuário cadastrado com este e-mail.",
      };
    }

    return {
      success: false,
      message: `Não foi possível criar o cliente: ${createError.message}`,
    };
  }

  if (!createdUser.user) {
    return {
      success: false,
      message: "O Supabase não retornou o usuário criado.",
    };
  }

  /*
   * O trigger criado anteriormente gera automaticamente o registro
   * em public.profiles. Aqui atualizamos os dados complementares.
   */
  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
      role: "client",
    })
    .eq("id", createdUser.user.id);

  if (updateError) {
    /*
     * Evita deixar um usuário incompleto no Authentication
     * caso a criação do perfil falhe.
     */
    await adminSupabase.auth.admin.deleteUser(createdUser.user.id);

    return {
      success: false,
      message: `O usuário foi criado, mas o perfil não pôde ser configurado: ${updateError.message}`,
    };
  }

  revalidatePath("/admin");

  return {
    success: true,
    message: `${fullName} foi cadastrado com sucesso.`,
  };
}