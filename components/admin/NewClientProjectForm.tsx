"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createClientProjectAction,
  type CreateClientProjectState,
} from "../../app/admin/client-project-actions";

type Props = {
  clientId: string;
  onSuccess?: () => void;
};

const initialState: CreateClientProjectState = {
  success: false,
  message: "",
};

export default function NewClientProjectForm({
  clientId,
  onSuccess,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    createClientProjectAction,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.success, onSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="admin-client-form"
    >
      <input
        type="hidden"
        name="clientId"
        value={clientId}
      />

      <label>
        Título da análise/projeto
        <input
          type="text"
          name="title"
          placeholder="Ex.: Análise estatística do projeto"
          required
        />
      </label>

      <label>
        Descrição
        <textarea
          name="description"
          placeholder="Descreva resumidamente o trabalho solicitado."
        />
      </label>

      <label>
        Status
        <select
          name="status"
          defaultValue="solicitado"
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
          defaultValue={0}
        />
      </label>

      <label>
        Data de início
        <input
          type="date"
          name="startDate"
        />
      </label>

      <label>
        Prazo previsto
        <input
          type="date"
          name="dueDate"
        />
      </label>

      <label>
        Observações administrativas
        <textarea
          name="adminNotes"
          placeholder="Informações internas que não serão exibidas ao cliente."
        />
      </label>

      <button
        type="submit"
        className="btn primary"
        disabled={pending}
      >
        {pending
          ? "Cadastrando..."
          : "Cadastrar projeto"}
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