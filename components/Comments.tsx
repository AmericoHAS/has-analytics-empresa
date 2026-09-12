"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/lib/types";

export function Comments() {
  const [items, setItems] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase
      .from("comments")
      .select(
        "id,author_name,author_role,content,created_at"
      )
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as Comment[]);
      });
  }, []);

  async function submit(e: FormEvent) {
  e.preventDefault();

  setMessage("");

  if (content.trim().length < 10) {
    setMessage(
      "O comentário deve ter pelo menos 10 caracteres."
    );
    return;
  }

  const { error } = await supabase
    .from("comments")
    .insert({
      author_name: name.trim(),
      author_role: role.trim() || null,
      content: content.trim(),
      approved: false,
    });

  if (error) {
    console.error("Erro ao enviar comentário:", error);

    setMessage(
      `Não foi possível enviar: ${error.message}`
    );

    return;
  }

  setMessage(
    "Comentário enviado para aprovação."
  );

  setName("");
  setRole("");
  setContent("");
}

  return (
    <section className="comments">
      <div>
        <span className="eyebrow">
          Experiências compartilhadas
        </span>

        <h2>
          O que dizem os pesquisadores
        </h2>

        <div className="comment-list">
          {items.length ? (
            items.map((comment) => (
              <blockquote key={comment.id}>
                <p>
                  “{comment.content}”
                </p>

                <footer>
                  <strong>
                    {comment.author_name}
                  </strong>

                  {comment.author_role && (
                    <span>
                      {comment.author_role}
                    </span>
                  )}
                </footer>
              </blockquote>
            ))
          ) : (
            <p className="muted">
              Os primeiros comentários aprovados aparecerão aqui.
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={submit}
        className="comment-form"
      >
        <h3>
          Deixe seu comentário
        </h3>

        <label>
          Nome
          <input
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            required
          />
        </label>

        <label>
          Instituição ou função
          <input
            value={role}
            onChange={(e) =>
              setRole(e.target.value)
            }
          />
        </label>

        <label>
          Comentário
          <textarea
  value={content}
  onChange={(e) =>
    setContent(e.target.value)
  }
  required
  minLength={10}
  maxLength={900}
/>
        </label>

        <button className="btn primary">
          Enviar para aprovação
        </button>

        {message && (
          <p className="form-message">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}