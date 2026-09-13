"use client";

import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { MessageCircle, Pause, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/lib/types";

function CommentCard({ comment }: { comment: Comment }) {
  const initials = comment.author_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <blockquote className="social-card">
      <div className="social-card-header">
        <span className="social-avatar" aria-hidden="true">
          {initials}
        </span>
        <div>
          <strong>{comment.author_name}</strong>
          {comment.author_role && <small>{comment.author_role}</small>}
        </div>
      </div>
      <p>“{comment.content}”</p>
      <footer>
        <MessageCircle size={15} />
        Experiência compartilhada com a HAS Analytics
      </footer>
    </blockquote>
  );
}

export function Comments() {
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("comments")
          .select("id,author_name,author_role,content,created_at")
          .eq("approved", true)
          .order("created_at", { ascending: false });
        if (mounted) {
          setItems((data ?? []) as Comment[]);
          setFailed(Boolean(error));
        }
      } catch {
        if (mounted) setFailed(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const role = String(data.get("role") ?? "").trim();
    const content = String(data.get("content") ?? "").trim();
    if (name.length < 2 || content.length < 10) {
      setMessage(
        "Informe seu nome e um comentário com pelo menos 10 caracteres.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("comments")
        .insert({
          author_name: name,
          author_role: role || null,
          content,
          approved: false,
        });
      if (error) throw error;
      setMessage("Comentário enviado! Ele aparecerá no site após a aprovação.");
      form.reset();
    } catch {
      setMessage(
        "Não foi possível enviar agora. Seus dados continuam no formulário; tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  const scrolls = items.length > 2;
  return (
    <div className="social-comments">
      <div className="comment-heading">
        <div>
          <span className="eyebrow">Experiências compartilhadas</span>
          <h2>
            Conexões que deixam
            <br />a sua marca.
          </h2>
        </div>
        {scrolls && (
          <button
            type="button"
            className="btn"
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
            {paused ? "Retomar comentários" : "Pausar comentários"}
          </button>
        )}
      </div>
      {items.length ? (
        <div
          className={`social-window ${paused || !scrolls ? "is-paused" : ""}`}
          tabIndex={0}
          role="region"
          aria-label="Comentários aprovados. Pause para navegar e ler no seu ritmo."
        >
          <div
            className="social-track"
            style={
              {
                "--marquee-duration": `${Math.max(45, items.length * 14)}s`,
              } as CSSProperties
            }
          >
            <div className="social-group">
              {items.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}
            </div>
            {scrolls && (
              <div className="social-group" aria-hidden="true">
                {items.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="social-empty" role="status">
          {loading
            ? "Carregando experiências compartilhadas…"
            : failed
              ? "Não foi possível carregar os comentários neste momento."
              : "Já trabalhamos juntos? Compartilhe sua experiência. Os comentários aparecem aqui após aprovação."}
        </p>
      )}
      <details className="comment-compose">
        <summary>Quero compartilhar minha experiência</summary>
        <form onSubmit={submit} className="comment-form">
          <label>
            Nome
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </label>
          <label>
            Instituição ou função (opcional)
            <input
              name="role"
              maxLength={120}
              autoComplete="organization-title"
            />
          </label>
          <label>
            Seu comentário
            <textarea name="content" required minLength={10} maxLength={900} />
          </label>
          <small className="muted">
            Ao enviar, você autoriza a publicação do nome, função e comentário
            após a moderação.
          </small>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Enviando…" : "Enviar para aprovação"}
          </button>
          <p className="form-message" role="status">
            {message}
          </p>
        </form>
      </details>
    </div>
  );
}
