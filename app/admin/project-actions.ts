"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateProjectState = {
  success: boolean;
  message: string;
};

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createProjectAction(
  _previousState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return {
      success: false,
      message: "Sessão administrativa inválida.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      success: false,
      message: "Você não possui permissão para cadastrar projetos.",
    };
  }

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const externalUrl = String(formData.get("externalUrl") ?? "").trim();
  const technologiesRaw = String(
    formData.get("technologies") ?? ""
  ).trim();
  const published = formData.get("published") === "on";
const displayOrder = Number(
  formData.get("displayOrder") ?? 0
);

  if (!title || !category || !summary) {
    return {
      success: false,
      message: "Preencha título, categoria e resumo.",
    };
  }

  const slug = makeSlug(title);

  const technologies = technologiesRaw
    ? technologiesRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const { error } = await supabase.from("projects").insert({
    slug,
    title,
    category,
    summary,
    details: details || null,
    external_url: externalUrl || null,
    technologies,
    published,
    display_order:
  Number.isFinite(displayOrder) && displayOrder >= 0
    ? Math.floor(displayOrder)
    : 0,
  });

  if (error) {
    if (
      error.message.toLowerCase().includes("duplicate") ||
      error.code === "23505"
    ) {
      return {
        success: false,
        message:
          "Já existe um projeto com este título ou slug semelhante.",
      };
    }

    return {
      success: false,
      message: `Não foi possível cadastrar o projeto: ${error.message}`,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/projetos");

  return {
    success: true,
    message: "Projeto cadastrado com sucesso.",
  };
}   

export async function deleteProjectAction(id: string) {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return {
      success: false,
      message: "Sessão administrativa inválida.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      success: false,
      message: "Você não possui permissão para excluir projetos.",
    };
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    return {
      success: false,
      message: `Não foi possível excluir o projeto: ${error.message}`,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/projetos");

  return {
    success: true,
    message: "Projeto excluído com sucesso.",
  };
}

export type UpdateProjectState = {
  success: boolean;
  message: string;
};

export async function updateProjectAction(
  _previousState: UpdateProjectState,
  formData: FormData
): Promise<UpdateProjectState> {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return {
      success: false,
      message: "Sessão administrativa inválida.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      success: false,
      message: "Você não possui permissão para editar projetos.",
    };
  }

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const externalUrl = String(formData.get("externalUrl") ?? "").trim();

  const technologiesRaw = String(
    formData.get("technologies") ?? ""
  ).trim();

  const published = formData.get("published") === "on";
const displayOrder = Number(
  formData.get("displayOrder") ?? 0
);

  if (!id || !title || !category || !summary) {
    return {
      success: false,
      message: "Preencha título, categoria e resumo.",
    };
  }

  const slug = makeSlug(title);

  const technologies = technologiesRaw
    ? technologiesRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const { error } = await supabase
    .from("projects")
    .update({
      slug,
      title,
      category,
      summary,
      details: details || null,
      external_url: externalUrl || null,
      technologies,
      published,
      display_order:
  Number.isFinite(displayOrder) && displayOrder >= 0
    ? Math.floor(displayOrder)
    : 0,
    })
    .eq("id", id);

  if (error) {
    if (
      error.message.toLowerCase().includes("duplicate") ||
      error.code === "23505"
    ) {
      return {
        success: false,
        message:
          "Já existe outro projeto com este título ou slug.",
      };
    }

    return {
      success: false,
      message: `Não foi possível atualizar o projeto: ${error.message}`,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/projetos");

  return {
    success: true,
    message: "Projeto atualizado com sucesso.",
  };
}

export type UploadProjectCoverState = {
  success: boolean;
  message: string;
  coverPath?: string;
};

export async function uploadProjectCoverAction(
  _previousState: UploadProjectCoverState,
  formData: FormData
): Promise<UploadProjectCoverState> {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return {
      success: false,
      message: "Sessão administrativa inválida.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      success: false,
      message: "Você não possui permissão para enviar imagens.",
    };
  }

  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const file = formData.get("cover");

  if (!projectId) {
    return {
      success: false,
      message: "Projeto não identificado.",
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      success: false,
      message: "Selecione uma imagem.",
    };
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      message: "Utilize uma imagem JPG, PNG ou WebP.",
    };
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    return {
      success: false,
      message: "A imagem deve possuir no máximo 5 MB.",
    };
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase() ?? "jpg";

  const filePath =
    `${projectId}/cover-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("project-covers")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      message:
        `Não foi possível enviar a imagem: ${uploadError.message}`,
    };
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      cover_path: filePath,
    })
    .eq("id", projectId);

  if (updateError) {
    await supabase.storage
      .from("project-covers")
      .remove([filePath]);

    return {
      success: false,
      message:
        `A imagem foi enviada, mas não pôde ser vinculada ao projeto: ${updateError.message}`,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/projetos");

  return {
    success: true,
    message: "Capa atualizada com sucesso.",
    coverPath: filePath,
  };
}