"use client";
import IntakeFields from "@/components/public/IntakeFields";
import { intakeFields } from "@/lib/commercial/intake";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
export default function QuoteRequest() {
  const [ready, setReady] = useState(false),
    [signed, setSigned] = useState(false),
    [mode, setMode] = useState("signup"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setSigned(!!data.user);
        setEmail(data.user?.email ?? "");
        setName(data.user?.user_metadata?.full_name ?? "");
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setMessage(
            "Não foi possível verificar a sessão. Entre novamente para continuar.",
          );
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSigned(!!session?.user);
      if (session?.user) setEmail(session.user.email ?? "");
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  async function authenticate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/orcamento/acesso`,
          },
        });
        if (error) {
          setMessage(
            "Não foi possível criar o acesso. Confira os dados e tente novamente. Se já tem uma conta, selecione Entrar.",
          );
          return;
        }
        if (data.session) {
          setSigned(true);
          setPassword("");
        } else
          setMessage(
            "Confira seu e-mail para confirmar o acesso e voltar ao orçamento. Se você já tem uma conta, use Entrar ou recuperar senha.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setMessage(
            error.code === "email_not_confirmed"
              ? "Confirme seu e-mail antes de entrar."
              : error.code === "invalid_credentials"
                ? "E-mail ou senha não conferem. Você pode recuperar a senha abaixo."
                : "Não foi possível conectar sua conta. Tente novamente em instantes.",
          );
          return;
        }
        setSigned(true);
        setPassword("");
      }
    } catch {
      setMessage(
        "Não foi possível conectar. Confira sua conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("submit_quote_request_v2", {
        p_request_id: requestId,
        p_intake: Object.fromEntries(intakeFields.map(([key]) => [key, String(form.get(key) ?? "")])),
        p_name: String(form.get("name") ?? "").trim(),
        p_phone: String(form.get("phone") ?? "").trim(),
        p_service: String(form.get("service")),
        p_title: String(form.get("title") ?? "").trim(),
        p_description: String(form.get("description") ?? "").trim(),
        p_desired_date: form.get("date") || null,
      });
      if (error) {
        setMessage(
          error.message.includes("Aguarde")
            ? "Aguarde alguns minutos antes de enviar outra solicitação."
            : "Não foi possível enviar a solicitação. Seus campos foram mantidos; tente novamente ou fale conosco pelo WhatsApp.",
        );
        return;
      }
      setDone(true);
    } catch {
      setMessage(
        "Falha de conexão. Seus campos foram mantidos; tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <div className="quote-form" role="status">
        Preparando seu acesso…
      </div>
    );
  if (done)
    return (
      <section className="quote-form">
        <span className="eyebrow">Solicitação recebida</span>
        <h2>Vamos conhecer seu projeto.</h2>
        <p>
          Seu pedido está disponível para avaliação da HAS Analytics e o projeto
          já aparece na sua área privada.
        </p>
        <Link href="/area-cliente" className="btn primary">
          Acessar minha área do cliente ↗
        </Link>
        <button
          className="btn"
          onClick={() => {
            setRequestId(crypto.randomUUID());
            setDone(false);
          }}
        >
          Solicitar outro orçamento
        </button>
      </section>
    );
  if (!signed)
    return (
      <form className="quote-form" onSubmit={authenticate}>
        <span className="eyebrow">01 · Seu acesso</span>
        <h2>
          {mode === "signup"
            ? "Crie sua conta de cliente"
            : "Entre na sua conta"}
        </h2>
        {mode === "signup" && (
          <label>
            Nome completo
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              minLength={2}
              maxLength={150}
            />
          </label>
        )}
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            minLength={mode === "signup" ? 8 : 1}
          />
        </label>
        {mode === "signup" && (
          <small>
            Use pelo menos 8 caracteres. Você poderá precisar confirmar o e-mail
            antes de preencher o projeto.
          </small>
        )}
        <button className="btn primary" disabled={busy}>
          {busy
            ? "Aguarde…"
            : mode === "signup"
              ? "Criar acesso e continuar"
              : "Entrar e continuar"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setMessage("");
          }}
        >
          {mode === "signup"
            ? "Já tenho conta — entrar"
            : "Ainda não tenho conta"}
        </button>
        <Link className="text-link" href="/esqueci-senha">
          Esqueci minha senha
        </Link>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </form>
    );
  return (
    <form className="quote-form" onSubmit={submit}>
      <span className="eyebrow">02 · Conte seu projeto</span>
      <p>
        Conectado como <strong>{email}</strong>
      </p>
      <fieldset disabled={busy}>
        <legend>Informações para a proposta</legend>
        <label>
          Nome completo
          <input
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={150}
            autoComplete="name"
          />
        </label>
        <label>
          WhatsApp (opcional)
          <input name="phone" type="tel" maxLength={30} autoComplete="tel" />
        </label>
        <label>
          Como podemos ajudar?
          <select name="service" required>
            <option>Bioestatística e pesquisa</option>
            <option>Análises reproduzíveis</option>
            <option>Dados e soluções digitais</option>
            <option>Orientação sobre meu projeto</option>
          </select>
        </label>
        <label>
          Título do projeto
          <input name="title" required minLength={5} maxLength={200} />
        </label>
        <label>
          Objetivos e necessidades
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={5000}
            placeholder="O que você quer investigar? Já tem dados? Quais entregas precisa?"
          />
        </label>
        <small>
          Descreva o escopo sem incluir dados pessoais de participantes. Os
          arquivos serão compartilhados na área privada.
        </small>
        <label>
          Prazo desejado (opcional)
          <input
            name="date"
            type="date"
            min={new Date().toLocaleDateString("en-CA")}
          />
        </label>
        <label className="choice">
          <input type="checkbox" required />
          Autorizo o uso dessas informações para avaliar minha solicitação e
          entrar em contato sobre o projeto.
        </label>
        <IntakeFields />
      <button className="btn primary" disabled={busy}>
          {busy ? "Enviando…" : "Enviar solicitação de orçamento ↗"}
        </button>
      </fieldset>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
