import { createClient } from "@/lib/supabase/server";

export type PublicProject = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  details: string | null;
  cover_path: string | null;
  external_url: string | null;
  technologies: string[];
  display_order: number;
};

export async function getPublishedProjects(): Promise<PublicProject[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      slug,
      title,
      category,
      summary,
      details,
      cover_path,
      external_url,
      technologies,
      display_order
      `
    )
    .eq("published", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar projetos:", error);
    return [];
  }

  return (data ?? []) as PublicProject[];
}

export function getProjectCoverUrl(
  coverPath: string | null
) {
  if (!coverPath) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    return null;
  }

  return `${url}/storage/v1/object/public/project-covers/${coverPath}`;
}


export async function getFeaturedProjects(
  limit = 6
): Promise<PublicProject[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      slug,
      title,
      category,
      summary,
      details,
      cover_path,
      external_url,
      technologies,
      display_order
      `
    )
    .eq("published", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao carregar projetos em destaque:", error);
    return [];
  }

  return (data ?? []) as PublicProject[];
}