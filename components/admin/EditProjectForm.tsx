"use client";

import { useActionState, useEffect } from "react";
import {
  updateProjectAction,
  uploadProjectCoverAction,
  type UpdateProjectState,
  type UploadProjectCoverState,
} from "../../app/admin/project-actions";

type Project = {
  id: string;
  title: string;
  category: string;
  summary: string;
  details: string | null;
  external_url: string | null;
  technologies: string[];
  published: boolean;
  display_order: number;
};

type EditProjectFormProps = {
  project: Project;
  onSuccess?: () => void;
};

const initialUpdateState: UpdateProjectState = {
  success: false,
  message: "",
};

const initialCoverState: UploadProjectCoverState = {
  success: false,
  message: "",
};

export default function EditProjectForm({
  project,
  onSuccess,
}: EditProjectFormProps) {
  const [updateState, updateFormAction, updatePending] =
    useActionState(
      updateProjectAction,
      initialUpdateState
    );

  const [coverState, coverFormAction, coverPending] =
    useActionState(
      uploadProjectCoverAction,
      initialCoverState
    );

  useEffect(() => {
    if (updateState.success) {
      onSuccess?.();
    }
  }, [updateState.success, onSuccess]);

  useEffect(() => {
    if (coverState.success) {
      onSuccess?.();
    }
  }, [coverState.success, onSuccess]);

  return (
    <div>
      <form
        action={coverFormAction}
        className="admin-project-form"
      >
        <input
          type="hidden"
          name="projectId"
          value={project.id}
        />

        <div className="admin-client-field">
          <label htmlFor={`cover-${project.id}`}>
            Capa do projeto
          </label>

          <input
            id={`cover-${project.id}`}
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />

          <small>
            Formatos aceitos: JPG, PNG ou WebP. Máximo de 5 MB.
          </small>
        </div>

        <button
          type="submit"
          disabled={coverPending}
        >
          {coverPending
            ? "Enviando..."
            : "Enviar nova capa"}
        </button>

        {coverState.message && (
          <p
            role="status"
            className={
              coverState.success
                ? "admin-client-message success"
                : "admin-client-message error"
            }
          >
            {coverState.message}
          </p>
        )}
      </form>

      <hr style={{ margin: "2rem 0" }} />

      <form
        action={updateFormAction}
        className="admin-project-form"
      >
        <input
          type="hidden"
          name="id"
          value={project.id}
        />

        <div className="admin-client-field">
          <label htmlFor={`title-${project.id}`}>
            Título do projeto
          </label>

          <input
            id={`title-${project.id}`}
            name="title"
            type="text"
            defaultValue={project.title}
            required
          />
        </div>

        <div className="admin-client-field">
          <label htmlFor={`category-${project.id}`}>
            Categoria
          </label>

          <input
            id={`category-${project.id}`}
            name="category"
            type="text"
            defaultValue={project.category}
            required
          />
        </div>

        <div className="admin-client-field">
          <label htmlFor={`summary-${project.id}`}>
            Resumo
          </label>

          <textarea
            id={`summary-${project.id}`}
            name="summary"
            rows={4}
            defaultValue={project.summary}
            required
          />
        </div>

        <div className="admin-client-field">
          <label htmlFor={`details-${project.id}`}>
            Detalhes
          </label>

          <textarea
            id={`details-${project.id}`}
            name="details"
            rows={6}
            defaultValue={project.details ?? ""}
          />
        </div>

        <div className="admin-client-field">
          <label htmlFor={`technologies-${project.id}`}>
            Tecnologias
          </label>

          <input
            id={`technologies-${project.id}`}
            name="technologies"
            type="text"
            defaultValue={project.technologies.join(", ")}
          />

          <small>
            Separe as tecnologias por vírgulas.
          </small>
        </div>

        <div className="admin-client-field">
          <label htmlFor={`externalUrl-${project.id}`}>
            Link externo
          </label>

          <input
            id={`externalUrl-${project.id}`}
            name="externalUrl"
            type="url"
            defaultValue={project.external_url ?? ""}
            placeholder="https://..."
          />
        </div>
<div className="admin-client-field">
  <label htmlFor={`displayOrder-${project.id}`}>
    Ordem de exibição
  </label>

  <input
    id={`displayOrder-${project.id}`}
    name="displayOrder"
    type="number"
    min="0"
    defaultValue={project.display_order}
  />

  <small>
    Números menores aparecem primeiro.
  </small>
</div>
        <div className="admin-client-field">
          <label>
            <input
              type="checkbox"
              name="published"
              defaultChecked={project.published}
            />

            Publicado
          </label>
        </div>

        <button
          type="submit"
          disabled={updatePending}
        >
          {updatePending
            ? "Salvando..."
            : "Salvar alterações"}
        </button>

        {updateState.message && (
          <p
            role="status"
            className={
              updateState.success
                ? "admin-client-message success"
                : "admin-client-message error"
            }
          >
            {updateState.message}
          </p>
        )}
      </form>
    </div>
  );
}