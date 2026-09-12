"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { defaultModel, type CommercialModel } from "@/lib/commercial/model";
export default function CommercialSettings() {
  const [model, setModel] = useState<CommercialModel>(defaultModel),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    supabase
      .from("commercial_settings")
      .select("model")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (data) setModel(data.model);
        if (error)
          setMessage(
            "Não foi possível carregar os modelos. Confira a migração.",
          );
        setBusy(false);
      });
  }, []);
  const patch = (value: Partial<CommercialModel>) =>
    setModel((m) => ({ ...m, ...value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("commercial_settings")
      .upsert({ id: 1, model, updated_at: new Date().toISOString() });
    setMessage(
      error
        ? error.message
        : "Modelos salvos. Os próximos orçamentos usarão estes padrões.",
    );
    setBusy(false);
  }
  return (
    <form onSubmit={save} className="workspace-card stack">
      <div>
        <span className="eyebrow">Configurações / modelos comerciais</span>
        <h2>Seu padrão, em cada proposta</h2>
        <p className="muted">
          Baseado no modelo HAS Analytics. Orçamentos já salvos mantêm seus
          valores e textos.
        </p>
      </div>
      <div className="form-grid">
        <label>
          Título padrão
          <input
            required
            value={model.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label>
          Pagamento
          <input
            value={model.payment}
            onChange={(e) => patch({ payment: e.target.value })}
          />
        </label>
        {(["hourlyRate", "baseValue", "discount", "validityDays"] as const).map(
          (key, i) => (
            <label key={key}>
              {
                [
                  "Valor-hora (R$)",
                  "Valor base (R$)",
                  "Desconto (%)",
                  "Validade (dias)",
                ][i]
              }
              <input
                type="number"
                min={key === "validityDays" ? 1 : 0}
                max={
                  key === "discount"
                    ? 100
                    : key === "validityDays"
                      ? 365
                      : 1000000
                }
                step={key === "validityDays" ? 1 : 0.01}
                required
                value={model[key]}
                onChange={(e) => patch({ [key]: Number(e.target.value) })}
              />
            </label>
          ),
        )}
      </div>
      <h3>Tabela de serviços</h3>
      <p className="muted">
        Marque exatamente três serviços como iniciais. Quantidades e preços
        permanecem editáveis na proposta. O relatório inicia incluído no pacote
        (R$ 0), uma adaptação editável, pois a planilha não separa o preço por
        fase.
      </p>
      {model.services.map((s, i) => (
        <div className="service-row" key={s.id}>
          <label>
            Descrição
            <textarea
              required
              value={s.description}
              onChange={(e) =>
                patch({
                  services: model.services.map((r, j) =>
                    j === i ? { ...r, description: e.target.value } : r,
                  ),
                })
              }
            />
          </label>
          <label>
            Quantidade
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={s.quantity}
              onChange={(e) =>
                patch({
                  services: model.services.map((r, j) =>
                    j === i ? { ...r, quantity: Number(e.target.value) } : r,
                  ),
                })
              }
            />
          </label>
          <label>
            Valor unitário
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={s.unitPrice}
              onChange={(e) =>
                patch({
                  services: model.services.map((r, j) =>
                    j === i ? { ...r, unitPrice: Number(e.target.value) } : r,
                  ),
                })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={s.initial}
              onChange={(e) =>
                patch({
                  services: model.services.map((r, j) =>
                    j === i ? { ...r, initial: e.target.checked } : r,
                  ),
                })
              }
            />
            Inicial
          </label>
          <button
            type="button"
            className="btn"
            onClick={() =>
              patch({ services: model.services.filter((_, j) => j !== i) })
            }
          >
            Remover
          </button>
        </div>
      ))}
      <button
        className="btn"
        type="button"
        onClick={() =>
          patch({
            services: [
              ...model.services,
              {
                id: crypto.randomUUID(),
                description: "Novo serviço",
                quantity: 1,
                unitPrice: 0,
                initial: false,
              },
            ],
          })
        }
      >
        Adicionar serviço
      </button>
      <label>
        Observações reutilizáveis
        <textarea
          value={model.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </label>
      <details>
        <summary>Coeficientes de precificação da planilha</summary>
        <div className="form-grid">
          {model.coefficients.map((c, i) => (
            <label key={i}>
              {c.group} · {c.label}
              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={c.coefficient}
                onChange={(e) =>
                  patch({
                    coefficients: model.coefficients.map((r, j) =>
                      j === i
                        ? { ...r, coefficient: Number(e.target.value) }
                        : r,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
      </details>
      <p role="status">{message}</p>
      <button
        className="btn primary"
        disabled={busy || model.services.filter((s) => s.initial).length !== 3}
      >
        {busy ? "Carregando…" : "Salvar modelos"}
      </button>
    </form>
  );
}
