"use client";

import type { PublicProject } from "@/lib/projects-db";

type ProjectRailProps = {
  projects: PublicProject[];
};

export function ProjectRail({
  projects,
}: ProjectRailProps) {
  function getCoverUrl(
    coverPath: string | null
  ) {
    if (!coverPath) {
      return null;
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!url) {
      return null;
    }

    return `${url}/storage/v1/object/public/project-covers/${coverPath}`;
  }

  if (projects.length === 0) {
    return (
      <p>
        Nenhum projeto publicado no momento.
      </p>
    );
  }

  return (
    <div className="rail">
      {projects.map((project) => {
        const coverUrl = getCoverUrl(
          project.cover_path
        );

        return (
          <article
            className="project"
            key={project.id}
          >
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
              <span className="tag">
                {project.category}
              </span>

              <h3>
                {project.title}
              </h3>

              <p>
                {project.summary}
              </p>

              {project.technologies.length > 0 && (
                <div className="chips">
                  {project.technologies
                    .slice(0, 3)
                    .map((technology) => (
                      <span key={technology}>
                        {technology}
                      </span>
                    ))}
                </div>
              )}

              {project.external_url && (
                <a
                  className="text-link"
                  href={project.external_url}
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