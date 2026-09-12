"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateClientProjectState = {
  message: string;
  success: boolean;
};

export async function createClientProjectAction(
  _previousState: CreateClientProjectState,
  formData: FormData
): Promise<CreateClientProjectState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: "Usuário não autenticado.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      success: false,
      message: "Acesso não autorizado.",
    };
  }

  const clientId = String(
    formData.get("clientId") ?? ""
  );

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const status = String(
    formData.get("status") ?? "solicitado"
  );

  const progressValue = Number(
    formData.get("progress") ?? 0
  );

  const startDate = String(
    formData.get("startDate") ?? ""
  );

  const dueDate = String(
    formData.get("dueDate") ?? ""
  );

  const adminNotes = String(
    formData.get("adminNotes") ?? ""
  ).trim();

  if (!clientId) {
    return {
      success: false,
      message: "Selecione um cliente.",
    };
  }

  if (!title) {
    return {
      success: false,
      message: "Informe o título do projeto.",
    };
  }

  const progress = Math.min(
    100,
    Math.max(
      0,
      Number.isFinite(progressValue)
        ? Math.floor(progressValue)
        : 0
    )
  );

  const { error } = await supabase
    .from("client_projects")
    .insert({
      client_id: clientId,
      title,
      description: description || null,
      status,
      progress,
      start_date: startDate || null,
      due_date: dueDate || null,
      admin_notes: adminNotes || null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error(error);

    return {
      success: false,
      message: `Erro ao cadastrar projeto: ${error.message}`,
    };
  }

  revalidatePath("/admin");

  return {
    success: true,
    message: "Projeto cadastrado com sucesso.",
  };
}

export type UpdateClientProjectState = {
  success: boolean;
  message: string;
};

export async function updateClientProjectAction(
  _previousState: UpdateClientProjectState,
  formData: FormData
): Promise<UpdateClientProjectState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: "Usuário não autenticado.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      success: false,
      message: "Acesso não autorizado.",
    };
  }

  const projectId = String(
    formData.get("projectId") ?? ""
  );

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const status = String(
    formData.get("status") ?? "solicitado"
  );

  const progressValue = Number(
    formData.get("progress") ?? 0
  );

  const startDate = String(
    formData.get("startDate") ?? ""
  );

  const dueDate = String(
    formData.get("dueDate") ?? ""
  );

  const adminNotes = String(
    formData.get("adminNotes") ?? ""
  ).trim();

  if (!projectId) {
    return {
      success: false,
      message: "Projeto não identificado.",
    };
  }

  if (!title) {
    return {
      success: false,
      message: "Informe o título do projeto.",
    };
  }

  const progress = Math.min(
    100,
    Math.max(
      0,
      Number.isFinite(progressValue)
        ? Math.floor(progressValue)
        : 0
    )
  );

  const { error } = await supabase
    .from("client_projects")
    .update({
      title,
      description: description || null,
      status,
      progress,
      start_date: startDate || null,
      due_date: dueDate || null,
      admin_notes: adminNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    console.error(error);

    return {
      success: false,
      message: `Erro ao atualizar projeto: ${error.message}`,
    };
  }

  revalidatePath("/admin");

  return {
    success: true,
    message: "Projeto atualizado com sucesso.",
  };
}