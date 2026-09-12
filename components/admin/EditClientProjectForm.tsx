"use client";

import { useActionState, useEffect } from "react";
import {
  updateClientProjectAction,
  type UpdateClientProjectState,
} from "../../app/admin/client-project-actions";

type ClientProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  admin_notes: string | null;
};

type Props = {
  project: ClientProject;
  onSuccess?: () => void;
};

const initialState: UpdateClientProjectState = {
  success: false,
  message: "",
};

export default function EditClientProjectForm({
  project,
  onSuccess,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateClientProjectAction,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      onSuccess?.();
    }
  }, [state.success, onSuccess]);

  return (
    <form
      action={formAction}
      className="admin-client-form"
    >
      <input
        type="hidden"
        name="projectId"
        value={project.id}
      />

      <label>
        Título da análise/projeto
        <input
          type="text"
          name="title"
          defaultValue={project.title}
          required
        />
      </label>

      <label>
        Descrição
        <textarea
          name="description"
          defaultValue={project.description ?? ""}
        />
      </label>

      <label>
        Status
        <select
          name="status"
          defaultValue={project.status}
        >
          <option value="solicitado">
            Solicitado
          </option>

          <option value="aguardando_dados">
            Aguardando dados
          </option>

          <option value="em_analise">
            Em análise
          </option>

          <option value="em_revisao">
            Em revisão
          </option>

          <option value="aguardando_cliente">
            Aguardando cliente
          </option>

          <option value="concluido">
            Concluído
          </option>

          <option value="cancelado">
            Cancelado
          </option>
        </select>
      </label>

      <label>
        Progresso (%)
        <input
          type="number"
          name="progress"
          min={0}
          max={100}
          defaultValue={project.progress}
        />
      </label>

      <label>
        Data de início
        <input
          type="date"
          name="startDate"
          defaultValue={project.start_date ?? ""}
        />
      </label>

      <label>
        Prazo previsto
        <input
          type="date"
          name="dueDate"
          defaultValue={project.due_date ?? ""}
        />
      </label>

      <label>
        Observações administrativas
        <textarea
          name="adminNotes"
          defaultValue={project.admin_notes ?? ""}
          placeholder="Informações internas que não serão exibidas ao cliente."
        />
      </label>

      <button
        type="submit"
        className="btn primary"
        disabled={pending}
      >
        {pending
          ? "Salvando..."
          : "Salvar alterações"}
      </button>

      {state.message && (
        <p
          className={
            state.success
              ? "form-message success"
              : "form-message"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}