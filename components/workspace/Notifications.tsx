"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
type Notice = {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  email_status: string;
  whatsapp_status: string;
  whatsapp_error: string | null;
  last_error: string | null;
};
export default function Notifications({
  clientId,
  admin = false,
}: {
  clientId?: string;
  admin?: boolean;
}) {
  const [rows, setRows] = useState<Notice[]>([]),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    let q = supabase
      .from("notifications")
      .select(
        "id,recipient_id,title,body,read_at,created_at,email_status,last_error,whatsapp_status,whatsapp_error",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) setMessage("Não foi possível carregar os avisos.");
    else setRows(data ?? []);
  }, [clientId]);
  useEffect(() => {
    let q = supabase
      .from("notifications")
      .select(
        "id,recipient_id,title,body,read_at,created_at,email_status,last_error,whatsapp_status,whatsapp_error",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (clientId) q = q.eq("client_id", clientId);
    q.then(({ data, error }) => {
      if (error) setMessage("Não foi possível carregar os avisos.");
      else setRows(data ?? []);
    });
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, [load, clientId]);
  return (
    <div className="stack">
      <div className="row">
        <div>
          <span className="eyebrow">Central de avisos</span>
          <h2>O que precisa de atenção</h2>
        </div>
        <button className="btn" onClick={load}>
          Atualizar
        </button>
      </div>
      {admin && (
        <p className="muted">
          Os avisos ficam registrados aqui. O envio por e-mail depende da
          ativação do Resend e do agendamento. WhatsApp disponível quando a
          integração oficial e as preferências do destinatário estiverem
          ativadas.
        </p>
      )}
      {admin && clientId && (
        <details className="workspace-card">
          <summary>Criar aviso para este cliente</summary>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const { error } = await supabase.rpc("create_client_notice", {
                p_client: clientId,
                p_title: f.get("title"),
                p_body: f.get("body"),
              });
              setMessage(
                error
                  ? error.message
                  : "Aviso registrado no site e na fila de e-mail.",
              );
              if (!error) {
                form.reset();
                await load();
              }
            }}
          >
            <label>
              Título
              <input name="title" required minLength={3} maxLength={160} />
            </label>
            <label>
              Mensagem
              <textarea name="body" required maxLength={4000} />
            </label>
            <button className="btn">Enviar aviso</button>
          </form>
        </details>
      )}
      <p role="status">{message}</p>
      {!rows.length && (
        <div className="empty-state">Nenhum aviso por enquanto.</div>
      )}
      {rows.map((n) => (
        <article key={n.id} className="workspace-card">
          <span className="tag">{n.read_at ? "Lido" : "Novo aviso"}</span>
          <h3>{n.title}</h3>
          <p>{n.body}</p>
          <small>
            {new Date(n.created_at).toLocaleString("pt-BR")}
            {admin
              ? ` · E-mail: ${n.email_status === "sent" ? "aceito pelo provedor" : n.email_status} · WhatsApp: ${n.whatsapp_status ?? "não configurado"}`
              : ""}
          </small>
          {admin && n.last_error && <p>{n.last_error}</p>}
          {admin && n.whatsapp_error && <p>{n.whatsapp_error}</p>}
          {!n.read_at && (
            <button
              className="btn"
              onClick={async () => {
                const { error } = await supabase.rpc("mark_notification_read", {
                  notice_id: n.id,
                });
                if (error) setMessage("Não foi possível marcar como lido.");
                else await load();
              }}
            >
              Marcar como lido
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
