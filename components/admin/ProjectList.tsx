"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import EditProjectForm from "@/components/admin/EditProjectForm";
import { deleteProjectAction } from "../../app/admin/project-actions";

type Project = {
  id: string;
  title: string;
  category: string;
  summary: string;
  details: string | null;
  cover_path: string | null;
  external_url: string | null;
  technologies: string[];
  published: boolean;
  display_order: number;
};

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  async function loadProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        id,
        title,
        category,
        summary,
        details,
        cover_path,
        external_url,
        technologies,
        published,
        display_order
        `,
      )
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Não foi possível carregar os projetos.");
      setLoading(false);
      return;
    }

    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      {
        const { data, error } = await supabase
          .from("projects")
          .select(
            `
        id,
        title,
        category,
        summary,
        details,
        cover_path,
        external_url,
        technologies,
        published,
        display_order
        `,
          )
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (error) {
          setMessage("Não foi possível carregar os projetos.");
          setLoading(false);
          return;
        }

        setProjects((data ?? []) as Project[]);
        setLoading(false);
      }
    })();
  }, []);

  function getCoverUrl(coverPath: string | null) {
    if (!coverPath) {
      return null;
    }

    const { data } = supabase.storage
      .from("project-covers")
      .getPublicUrl(coverPath);

    return data.publicUrl;
  }

  async function confirmDelete() {
    if (!projectToDelete) {
      return;
    }

    setDeletingId(projectToDelete.id);
    setMessage("");

    const result = await deleteProjectAction(projectToDelete.id);

    if (!result.success) {
      setMessage(result.message);
      setDeletingId(null);
      setProjectToDelete(null);
      return;
    }

    setProjects((current) =>
      current.filter((item) => item.id !== projectToDelete.id),
    );

    setMessage(result.message);
    setDeletingId(null);
    setProjectToDelete(null);
  }

  async function handleEditSuccess() {
    setProjectToEdit(null);

    await loadProjects();

    setMessage("Projeto atualizado com sucesso.");
  }

  if (loading) {
    return <p>Carregando projetos...</p>;
  }

  return (
    <>
      {message && <p className="admin-client-message success">{message}</p>}

      {projects.length === 0 ? (
        <p>Nenhum projeto cadastrado.</p>
      ) : (
        <div className="doc-list">
          {projects.map((project) => {
            const coverUrl = getCoverUrl(project.cover_path);

            return (
              <article key={project.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  {coverUrl && (
                    <img
                      src={coverUrl}
                      alt={`Capa de ${project.title}`}
                      style={{
                        width: "90px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                  )}

                  <div>
                    <strong>{project.title}</strong>

                    <small>
                      {project.category} ·{" "}
                      {project.published ? "Publicado" : "Rascunho"}
                    </small>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setProjectToEdit(project)}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectToDelete(project)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {projectToEdit && (
        <div className="admin-delete-confirmation">
          <div className="admin-delete-confirmation-box">
            <div className="admin-client-form-header">
              <h3>Editar projeto</h3>

              <button
                type="button"
                className="btn"
                onClick={() => setProjectToEdit(null)}
              >
                Fechar
              </button>
            </div>

            {getCoverUrl(projectToEdit.cover_path) && (
              <img
                src={getCoverUrl(projectToEdit.cover_path) ?? ""}
                alt={`Capa de ${projectToEdit.title}`}
                style={{
                  width: "100%",
                  maxHeight: "220px",
                  objectFit: "cover",
                  borderRadius: "12px",
                  marginBottom: "1.5rem",
                }}
              />
            )}

            <EditProjectForm
              project={projectToEdit}
              onSuccess={handleEditSuccess}
            />
          </div>
        </div>
      )}

      {projectToDelete && (
        <div className="admin-delete-confirmation">
          <div className="admin-delete-confirmation-box">
            <h3>Excluir projeto?</h3>

            <p>
              Tem certeza de que deseja excluir{" "}
              <strong>{projectToDelete.title}</strong>?
            </p>

            <p>Esta ação não poderá ser desfeita.</p>

            <div className="admin-delete-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setProjectToDelete(null)}
                disabled={deletingId !== null}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={confirmDelete}
                disabled={deletingId !== null}
              >
                {deletingId ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
