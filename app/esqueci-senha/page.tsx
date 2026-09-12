"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

  const redirectTo =
  `${window.location.origin}/auth/callback?next=/redefinir-senha`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setMessage("Não foi possível enviar o link de recuperação.");
      setLoading(false);
      return;
    }

    setMessage(
      "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha."
    );

    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Image
          src="/logo-has.analytics.png"
          alt="HAS Analytics"
          width={250}
          height={250}
        />

        <h1>Recupere o acesso à sua área de cliente.</h1>
      </section>

      <form className="auth-form" onSubmit={handleSubmit}>
        <span className="eyebrow">Área segura</span>

        <h2>Recuperar senha</h2>

        <p>
          Informe o e-mail utilizado no seu cadastro. Enviaremos um
          link para você definir uma nova senha.
        </p>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            required
          />
        </label>

        <button
          type="submit"
          className="btn primary"
          disabled={loading}
        >
          {loading ? "Enviando..." : "Enviar link de recuperação"}
        </button>

        {message && <p>{message}</p>}

        <Link href="/login">
          Voltar para o login
        </Link>
      </form>
    </main>
  );
}