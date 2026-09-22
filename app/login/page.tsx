"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandOrbit } from "@/components/public/BrandOrbit";
import { supabase } from "@/lib/supabase";
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMsg(
          error.code === "email_not_confirmed"
            ? "Confirme seu e-mail para entrar."
            : error.code === "invalid_credentials"
              ? "E-mail ou senha inválidos."
              : "Não foi possível conectar. Tente novamente em instantes.",
        );
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) {
        setMsg(
          "Seu acesso foi autenticado, mas não foi possível carregar o perfil. Tente novamente.",
        );
        return;
      }
      router.push(
        !profile
          ? "/orcamento/acesso"
          : profile.role === "admin"
            ? "/admin"
            : "/area-cliente",
      );
      router.refresh();
    } catch {
      setMsg("Não foi possível conectar. Confira sua conexão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page compact-login">
      <section className="auth-brand">
        <Link className="login-home" href="/">
          ← HAS Analytics
        </Link>
        <BrandOrbit />
        <h1>Seu projeto, documentos e resultados em um só lugar.</h1>
      </section>
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">Área segura</span>
        <h2>Entrar</h2>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? "Entrando…" : "Acessar"}
        </button>
        <Link className="text-link" href="/esqueci-senha">
          Esqueci minha senha
        </Link>
        {msg && <p role="alert">{msg}</p>}
      </form>
    </main>
  );
}
