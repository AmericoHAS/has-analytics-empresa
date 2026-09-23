"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createClientAction,
  resendClientAccess,
  type CreateClientState,
} from "../../app/admin/actions";

const initialState: CreateClientState = {
  success: false,
  message: "",
};

export default function NewClientForm({
  initialValues,
  requestId,
  onCreated,
}: {
  requestId?: string;
  onCreated?: (message: string) => void;
  initialValues?: { fullName: string; email: string; phone: string };
}) {
  const [state, formAction, pending] = useActionState(
    createClientAction,
    initialState,
  );

  const [retryMessage, setRetryMessage] = useState("");
  const [sending, setSending] = useState(false);
  const notified = useRef<string | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.clientId && notified.current !== state.clientId) {
      notified.current = state.clientId;
      onCreated?.(state.message);
      window.dispatchEvent(new Event("has-workflow-updated"));
    }
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success, state.clientId, state.message, onCreated]);

  return (
    <form ref={formRef} action={formAction} className="admin-client-form">
      <div className="admin-client-field">
        <label htmlFor="fullName">Nome completo</label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={initialValues?.fullName}
          type="text"
          placeholder="Nome do cliente"
          required
        />
      </div>

      <div className="admin-client-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          defaultValue={initialValues?.email}
          type="email"
          placeholder="cliente@email.com"
          required
        />
      </div>

      <div className="admin-client-field">
        <label htmlFor="phone">WhatsApp / telefone</label>
        <input
          id="phone"
          name="phone"
          defaultValue={initialValues?.phone}
          type="tel"
          placeholder="(00) 00000-0000"
        />
      </div>

      <input type="hidden" name="requestId" value={requestId ?? ""} />
      <p>
        O cliente receberá um link seguro por e-mail para definir a senha e
        completar o cadastro no primeiro acesso.
      </p>
      <button type="submit" disabled={pending || !!state.clientId}>
        {pending ? "Preparando acesso…" : "Aprovar cadastro e enviar acesso"}
      </button>
      {state.clientId && (
        <button
          type="button"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            try {
              const result = await resendClientAccess(state.clientId!);
              setRetryMessage(result.message);
            } catch {
              setRetryMessage(
                "Falha de comunicação ao enviar o acesso. Tente novamente.",
              );
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? "Enviando…" : "Reenviar e-mail de acesso"}
        </button>
      )}
      {retryMessage && <p role="status">{retryMessage}</p>}

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
