"use client";

import Link from "next/link";
import { splitProjectTags, safeProjectUrl } from "@/lib/project-metadata";
import type { PublicProject } from "@/lib/projects-db";

type ProjectRailProps = {
  projects: PublicProject[];
};

export function ProjectRail({ projects }: ProjectRailProps) {
  function getCoverUrl(coverPath: string | null) {
    if (!coverPath) {
      return null;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!url) {
      return null;
    }

    return `${url}/storage/v1/object/public/project-covers/${coverPath}`;
  }

  if (projects.length === 0) {
    return <p>Nenhum projeto publicado no momento.</p>;
  }

  return (
    <div className="rail">
      {projects.map((project) => {
        const coverUrl = getCoverUrl(project.cover_path);

        return (
          <article className="project" key={project.id}>
            <div className="project-image">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={`Capa do projeto ${project.title}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  HAS Analytics
                </div>
              )}
            </div>

            <div className="project-body">
              <div className="chips project-categories">
                {splitProjectTags(project.category).map((category) => (
                  <span key={category}>{category}</span>
                ))}
              </div>
              {project.project_type && <p className="project-type">{project.project_type}</p>}
              {project.publication_status && (
                <p className="project-publication">
                  {project.publication_status}
                </p>
              )}

              <h3>{project.title}</h3>

              <p>{project.summary}</p>

              {project.technologies.length > 0 && (
                <div className="chips">
                  {project.technologies.slice(0, 3).map((technology) => (
                    <span key={technology}>{technology}</span>
                  ))}
                </div>
              )}

              <Link
                className="text-link project-more"
                href={`/projetos/${encodeURIComponent(project.slug)}`}
              >
                Ver mais →
              </Link>
              {project.availability && (
                <small className="project-availability">
                  {project.availability}
                </small>
              )}
              {safeProjectUrl(project.external_url) && (
                <a
                  className="text-link"
                  href={safeProjectUrl(project.external_url)!}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver projeto →
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
