"use client";

import { useState } from "react";
import { changeClientAccessEmail, getClientAccessEmail } from "@/app/admin/client-email-actions";

export default function ClientAccessEmail({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  async function show() {
    setOpen(true);
    setBusy(true);
    setEmail("");
    setMessage("");
    try {
      const result = await getClientAccessEmail(clientId);
      setEmail(result.email);
      setMessage(result.message);
    } catch { setMessage("Não foi possível consultar a conta. Feche e tente novamente."); }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" className="btn" disabled={busy} onClick={() => open ? setOpen(false) : void show()}>{open ? "Fechar alteração de e-mail" : "Alterar e-mail de acesso"}</button>
    {open && <form className="workspace-card stack" onSubmit={async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      if (!window.confirm("Confirma a alteração do e-mail de acesso deste cliente? O usuário continuará sendo o mesmo e todos os projetos e documentos permanecerão vinculados à conta.")) return;
      form.set("confirmed", "yes");
      form.set("currentEmail", email);
      setBusy(true);
      setMessage("");
      try {
        const result = await changeClientAccessEmail(clientId, form);
        setMessage(result.message);
        if (result.success) { setEmail(result.email); formElement.reset(); }
      } catch { setMessage("Falha de comunicação. Feche e reabra esta opção para conferir o e-mail atual antes de tentar novamente."); }
      finally { setBusy(false); }
    }}>
      <p>E-mail atual: <strong>{email || (busy ? "Carregando…" : "Não disponível")}</strong></p>
      <fieldset disabled={busy || !email} className="stack">
        <label>Novo e-mail<input name="email" type="email" maxLength={254} required autoComplete="off" /></label>
        <label>Confirmar novo e-mail<input name="confirmation" type="email" maxLength={254} required autoComplete="off" /></label>
        <button className="btn" type="submit">{busy ? "Aguarde…" : "Alterar e-mail"}</button>
      </fieldset>
      <p role="status" aria-live="polite">{message}</p>
    </form>}
  </div>;
}
