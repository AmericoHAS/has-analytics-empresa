"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function RedefinirSenha() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(
    "Validando link de recuperação..."
  );
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setMessage("");
        return;
      }

      if (event === "SIGNED_IN" && session) {
        setRecoveryReady(true);
        setMessage("");
      }
    });

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setRecoveryReady(true);
        setMessage("");
      }
    }

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setMessage("");

    if (!recoveryReady) {
      setMessage(
        "O link de recuperação não foi validado. Solicite um novo link."
      );
      return;
    }

    if (password.length < 8) {
      setMessage("A senha deve possuir pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(`Erro ao alterar senha: ${error.message}`);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    setMessage("Senha redefinida com sucesso.");

    setTimeout(() => {
      router.push("/login");
    }, 1200);
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

        <h1>Defina sua nova senha de acesso.</h1>
      </section>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
      >
        <span className="eyebrow">Área segura</span>

        <h2>Redefinir senha</h2>

        <label>
          Nova senha
          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Mínimo de 8 caracteres"
            minLength={8}
            required
            disabled={!recoveryReady || loading}
          />
        </label>

        <label>
          Confirmar nova senha
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            placeholder="Digite novamente a senha"
            minLength={8}
            required
            disabled={!recoveryReady || loading}
          />
        </label>

        <button
          type="submit"
          className="btn primary"
          disabled={!recoveryReady || loading}
        >
          {loading
            ? "Atualizando..."
            : "Redefinir senha"}
        </button>

        {message && <p>{message}</p>}
      </form>
    </main>
  );
}