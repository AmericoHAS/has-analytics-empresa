"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { billingFields } from "@/lib/commercial/billing";
import { resendClientAccess } from "@/app/admin/actions";
import { saveBilling } from "@/app/admin/billing-actions";
export default function ClientProfile({
  clientId,
  admin = false,
  expanded = false,
  onboarding = false,
  onSaved,
}: {
  clientId: string;
  admin?: boolean;
  expanded?: boolean;
  onboarding?: boolean;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<Record<string, string> | null>(null),
    [ready, setReady] = useState(false),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: billing, error } = await supabase
        .from("client_billing_profiles")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      let initial = billing;
      if (!billing && !error) {
        const [{ data: profile }, { data: requests }] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name,phone")
            .eq("id", clientId)
            .maybeSingle(),
          supabase
            .from("budget_requests")
            .select("name,email,phone")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);
        const request = requests?.[0];
        initial = {
          legal_name: request?.name ?? profile?.full_name ?? "",
          email: request?.email ?? "",
          phone: request?.phone ?? profile?.phone ?? "",
        };
      }
      if (!alive) return;
      setData(initial);
      setEditing(!billing && !admin);
      setReady(true);
      if (error)
        setMessage(
          "Cadastro indisponível. Confira a atualização comercial do Supabase.",
        );
    })();
    return () => {
      alive = false;
    };
  }, [clientId, admin]);
  if (!ready) return <p>Conferindo cadastro para documentos…</p>;
  if (!expanded && !editing && data) return null;
  return (
    <section className="workspace-card stack">
      <h2>Dados para orçamentos e contratos</h2>
      <p>
        Informe seus dados de identificação e contato. Eles ficam na sua área
        privada e serão usados nos documentos do atendimento.
      </p>
      {!data && !editing && !expanded && (
        <button className="btn" onClick={() => setEditing(true)}>
          Completar cadastro do cliente
        </button>
      )}
      {(expanded || editing) && (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = new FormData(e.currentTarget);
            try {
              const result = await saveBilling(clientId, form);
              if (result.success && onboarding) {
                const { error } = await supabase.rpc(
                  "complete_client_onboarding",
                );
                if (error) {
                  setMessage(
                    "Os dados foram salvos, mas não foi possível liberar o acesso. Tente salvar novamente.",
                  );
                  return;
                }
              }
              setMessage(result.message);
              if (result.success) {
                setData(Object.fromEntries(form) as Record<string, string>);
                setEditing(false);
                onSaved?.();
              }
            } catch {
              setMessage("Falha de conexão. Tente novamente.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            {billingFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type={key === "email" ? "email" : "text"}
                  required={!["institution", "representative"].includes(key)}
                  maxLength={key === "state" ? 2 : key === "tax_id" ? 18 : 350}
                  autoComplete={
                    key === "email"
                      ? "email"
                      : key === "phone"
                        ? "tel"
                        : undefined
                  }
                  defaultValue={data?.[key] ?? ""}
                />
              </label>
            ))}
          </div>
          <button className="btn primary" disabled={busy}>
            {busy
              ? "Salvando…"
              : onboarding
                ? "Salvar e acessar meus projetos"
                : "Salvar dados"}
          </button>
          {!expanded && (
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(false)}
            >
              Preencher depois
            </button>
          )}
        </form>
      )}
      {admin && (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await resendClientAccess(clientId);
              setMessage(result.message);
            } catch {
              setMessage("Falha de comunicação ao reenviar o acesso.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Reenviar e-mail de acesso à conta
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
