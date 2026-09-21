"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { saveDocumentTemplate } from "@/app/admin/commercial-actions";
type Template = {
  kind: string;
  native_body: string;
  provider_name: string;
  provider_tax_id: string;
  provider_address: string;
  provider_contact: string;
};
export default function DocumentTemplateSettings() {
  const [templates, setTemplates] = useState<Template[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase
      .from("document_templates")
      .select(
        "kind,native_body,provider_name,provider_tax_id,provider_address,provider_contact",
      )
      .in("kind", ["orcamento", "contrato"])
      .then(({ data, error }) => {
        if (error) setMessage("Não foi possível carregar os modelos.");
        else setTemplates(data ?? []);
      });
  }, []);
  return (
    <section className="workspace-card stack">
      <h3>Modelos de documentos e dados da HAS</h3>
      <p className="muted">
        Configurações para as próximas versões de orçamento e contrato.
      </p>
      {templates.map((t) => (
        <details key={t.kind}>
          <summary>{t.kind === "contrato" ? "Contrato" : "Orçamento"}</summary>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              f.set("kind", t.kind);
              setBusy(true);
              try {
                const r = await saveDocumentTemplate(f);
                setMessage(r.message);
              } catch {
                setMessage("Não foi possível salvar. Tente novamente.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              {[
                ["provider_name", "Nome / razão social"],
                ["provider_tax_id", "CPF / CNPJ"],
                ["provider_address", "Endereço"],
                ["provider_contact", "Contato"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    defaultValue={t[key as keyof Template]}
                    maxLength={key === "provider_address" ? 500 : 300}
                  />
                </label>
              ))}
            </div>
            <label>
              Condições adicionais padrão
              <textarea
                name="body"
                defaultValue={t.native_body}
                maxLength={20000}
              />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar modelo"}
            </button>
          </form>
        </details>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
