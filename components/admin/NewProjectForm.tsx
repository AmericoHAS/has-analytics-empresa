"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createProjectAction,
  type CreateProjectState,
} from "../../app/admin/project-actions";

const initialState: CreateProjectState = {
  success: false,
  message: "",
};

export default function NewProjectForm() {
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="admin-project-form">
      <div className="admin-client-field">
        <label htmlFor="title">Título do projeto</label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="Ex.: Análise de adesão medicamentosa"
          required
        />
      </div>

      <div className="admin-client-field">
        <label htmlFor="category">Categoria</label>
        <input
          id="category"
          name="category"
          type="text"
          placeholder="Ex.: Bioestatística"
          required
        />
      </div>

      <div className="admin-client-field">
        <label htmlFor="summary">Resumo</label>
        <textarea
          id="summary"
          name="summary"
          placeholder="Breve descrição do projeto"
          rows={4}
          required
        />
      </div>

      <div className="admin-client-field">
        <label htmlFor="details">Detalhes</label>
        <textarea
          id="details"
          name="details"
          placeholder="Descrição mais completa do projeto"
          rows={6}
        />
      </div>

      <div className="admin-client-field">
        <label htmlFor="technologies">Tecnologias</label>
        <input
          id="technologies"
          name="technologies"
          type="text"
          placeholder="R, Shiny, Supabase, Next.js"
        />
        <small>Separe as tecnologias por vírgulas.</small>
      </div>

      <div className="admin-client-field">
        <label htmlFor="externalUrl">Link externo</label>
        <input
          id="externalUrl"
          name="externalUrl"
          type="url"
          placeholder="https://..."
        />
      </div>
<div className="admin-client-field">
  <label htmlFor="displayOrder">
    Ordem de exibição
  </label>

  <input
    id="displayOrder"
    name="displayOrder"
    type="number"
    min="0"
    defaultValue="0"
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
          />
          Publicar projeto imediatamente
        </label>
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "Cadastrando..." : "Cadastrar projeto"}
      </button>

      {state.message && (
        <p
          role="status"
          className={
            state.success
              ? "admin-client-message success"
              : "admin-client-message error"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}