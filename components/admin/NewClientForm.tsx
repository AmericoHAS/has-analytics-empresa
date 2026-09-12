"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createClientAction,
  type CreateClientState,
} from "../../app/admin/actions";

const initialState: CreateClientState = {
  success: false,
  message: "",
};

export default function NewClientForm() {
  const [state, formAction, pending] = useActionState(
    createClientAction,
    initialState
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="admin-client-form">
      <div className="admin-client-field">
        <label htmlFor="fullName">Nome completo</label>
        <input
          id="fullName"
          name="fullName"
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
          type="tel"
          placeholder="(00) 00000-0000"
        />
      </div>

      <div className="admin-client-field">
        <label htmlFor="password">Senha inicial</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo de 8 caracteres"
          minLength={8}
          required
        />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "Cadastrando..." : "Cadastrar cliente"}
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