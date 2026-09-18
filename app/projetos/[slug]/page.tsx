import Image from "next/image";
import { getProjectCoverUrl } from "@/lib/projects-db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PublicExperience } from "@/components/public/PublicExperience";
import { safeProjectUrl, splitProjectTags } from "@/lib/project-metadata";
import type { PublicProject } from "@/lib/projects-db";
export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await createClient();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error)
    throw new Error("Não foi possível carregar o projeto. Tente novamente.");
  if (!data) notFound();
  const project = data as PublicProject;
  const url = safeProjectUrl(project.external_url);
  const cover = getProjectCoverUrl(project.cover_path);
  return (
    <PublicExperience>
      <Header />
      <main className="project-detail-page">
        <div className="container">
          <Link className="text-link" href="/projetos">
            ← Voltar aos projetos
          </Link>
          <article className="project-detail-card">
            {cover && <div className="project-detail-cover"><Image src={cover} alt={`Capa do projeto ${project.title}`} width={1200} height={675} unoptimized priority /></div>}
            {project.project_type && <p className="project-type">{project.project_type}</p>}
            <div className="chips project-categories">
              {splitProjectTags(project.category).map((category) => (
                <span key={category}>{category}</span>
              ))}
            </div>
            {project.publication_status && (
              <p className="eyebrow">{project.publication_status}</p>
            )}
            <h1>{project.title}</h1>
            <p className="project-detail-summary">{project.summary}</p>
            {url && <a className="btn primary project-access" href={url} target="_blank" rel="noopener noreferrer">Acessar projeto ↗</a>}
            {project.details && (
              <div className="project-detail-text">{project.details}</div>
            )}
            <div className="chips">
              {project.technologies.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            {!!project.researchers?.length && (
              <section className="project-researchers">
                <h2>Pesquisadores e colaboradores</h2>
                <ul>
                  {project.researchers.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </section>
            )}
            {project.availability && (
              <p className="project-availability">{project.availability}</p>
            )}

          </article>
          <Link className="text-link" href="/">
            ← Voltar ao início
          </Link>
        </div>
      </main>
      <Footer />
    </PublicExperience>
  );
}
