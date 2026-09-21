"use client";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import IntakeFields from "./IntakeFields";
import { intakeFields } from "@/lib/commercial/intake";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { budgetServices } from "@/lib/budget-request";
import { publicContact } from "@/lib/public-site";

export function BudgetForm({
  initialService = 4,
}: {
  initialService?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch("/api/orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(data),
          intake: Object.fromEntries(
            intakeFields.map(([key]) => [key, String(data.get(key) ?? "")]),
          ),
          id: requestId.current,
          consent: data.get("consent") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.message || "Não foi possível enviar agora. Tente novamente.",
        );
      setDone(true);
      requestAnimationFrame(() => statusRef.current?.focus());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (done)
    return (
      <div
        className="budget-success"
        role="status"
        tabIndex={-1}
        ref={statusRef}
      >
        <CheckCircle2 size={38} />
        <h2>Vamos conhecer seu projeto.</h2>
        <p>
          Sua solicitação de orçamento e acesso foi recebida. Haward entrará em
          contato pelos dados informados para entender a demanda e alinhar os
          próximos passos.
        </p>
        <p>
          O acesso à área do cliente será liberado durante o atendimento. Você
          ainda não precisa de uma senha.
        </p>
        <a
          className="btn primary"
          href={publicContact.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
        >
          Continuar pelo WhatsApp <WhatsAppIcon size={17} />
        </a>
        <Link className="text-link" href="/">
          Voltar ao início
        </Link>
      </div>
    );
  return (
    <form className="budget-form" onSubmit={submit} aria-busy={busy}>
      <h2>Conte um pouco sobre sua ideia.</h2>
      <p>Os campos marcados com * são obrigatórios.</p>
      <fieldset className="request-group">
        <legend>01 · Seu contato</legend>
        <div className="budget-fields">
          <label>
            Seu nome *
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label>
            E-mail *
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
        </div>
        <div className="budget-fields">
          <label>
            WhatsApp (opcional)
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(44) 99955-4888"
              maxLength={30}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="request-group">
        <legend>02 · Sua demanda</legend>
        <div className="budget-fields">
          <label>
            O que você precisa? *
            <select
              name="service_type"
              defaultValue={budgetServices[initialService] ?? budgetServices[4]}
              required
            >
              {budgetServices.map((service) => (
                <option key={service}>{service}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Nome ou assunto do projeto *
          <input
            name="title"
            placeholder="Ex.: análise dos dados da minha pesquisa"
            required
            minLength={5}
            maxLength={180}
          />
        </label>
        <label>
          Em que podemos ajudar? *
          <textarea
            name="description"
            placeholder="Conte seu objetivo, a etapa atual, os dados disponíveis ou as funcionalidades que imagina. Se houver um prazo, explique o contexto."
            required
            minLength={30}
            maxLength={5000}
          />
        </label>
        <label>
          Data desejada para a entrega (opcional)
          <input name="desired_date" type="date" />
          <small className="muted">
            O prazo será confirmado após a avaliação do escopo.
          </small>
        </label>
      </fieldset>
      <details className="request-extra">
        <summary>
          Detalhes complementares <span>Opcional</span>
        </summary>
        <IntakeFields />
      </details>
      <div className="access-note">
        <strong>Orçamento + solicitação de acesso</strong>Este pedido também
        inicia seu atendimento para a área do cliente. A conta será liberada
        após a conferência dos dados; nenhuma senha é solicitada aqui.
      </div>
      <label className="consent">
        <input name="consent" type="checkbox" required />
        <span>
          Autorizo a HAS Analytics a usar os dados informados para responder à
          minha solicitação e organizar meu acesso à área do cliente. *
        </span>
      </label>
      <div className="budget-trap" aria-hidden="true">
        <label>
          Deixe este campo em branco
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? "Enviando solicitação…" : "Solicitar orçamento e acesso"}
        <ArrowUpRight size={18} />
      </button>
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
      <p>
        Prefere conversar primeiro?{" "}
        <a
          className="text-link"
          href={publicContact.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
        >
          Fale pelo WhatsApp <WhatsAppIcon size={17} />
        </a>
      </p>
    </form>
  );
}
