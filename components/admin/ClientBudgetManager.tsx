"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  defaultModel,
  money,
  totals,
  estimate,
  type CommercialModel,
} from "@/lib/commercial/model";
import {
  createBudgetAction,
  updateBudgetStatusAction,
  deleteBudgetAction,
} from "@/app/admin/budget-actions";
type Item = { description: string; quantity: number; unitPrice: number };
type Budget = {
  id: string;
  budget_number: string;
  title: string;
  description: string;
  notes: string;
  project_id: string | null;
  valid_until: string | null;
  discount_percent: number;
  total: number;
  status: string;
};
export default function ClientBudgetManager({
  clientId,
  projects,
  readOnly = false,
}: {
  clientId: string;
  projects: { id: string; title: string }[];
  readOnly?: boolean;
}) {
  const [budgets, setBudgets] = useState<Budget[]>([]),
    [model, setModel] = useState<CommercialModel>(defaultModel),
    [modelReady, setModelReady] = useState(false),
    [items, setItems] = useState<Item[]>([]),
    [edit, setEdit] = useState<Budget | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [discount, setDiscount] = useState(0),
    [validity, setValidity] = useState(""),
    [hours, setHours] = useState(8),
    [factors, setFactors] = useState<Record<string, number>>({}),
    [detail, setDetail] = useState<{ budget: Budget; items: Item[] } | null>(
      null,
    );
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_budgets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) setMessage("Não foi possível carregar os orçamentos.");
    else setBudgets(data ?? []);
  }, [clientId]);
  useEffect(() => {
    supabase
      .from("client_budgets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage("Não foi possível carregar os orçamentos.");
        else setBudgets(data ?? []);
      });
    if (!readOnly)
      supabase
        .from("commercial_settings")
        .select("model")
        .eq("id", 1)
        .single()
        .then(({ data, error }) => {
          if (data) {
            setModel(data.model);
            setModelReady(true);
          }
          if (error)
            setMessage(
              "Modelos indisponíveis. Confira a migração e recarregue antes de criar uma proposta.",
            );
        });
  }, [clientId, readOnly]);
  async function itemRows(id: string) {
    const { data, error } = await supabase
      .from("client_budget_items")
      .select("description,quantity,unit_price")
      .eq("budget_id", id)
      .order("display_order");
    if (error) throw Error(error.message);
    return (data ?? []).map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    }));
  }
  function start() {
    setValidity(
      new Date(Date.now() + model.validityDays * 86400000)
        .toISOString()
        .slice(0, 10),
    );
    setEdit(null);
    setItems(model.services.filter((s) => s.initial).map((s) => ({ ...s })));
    setDiscount(model.discount);
    setOpen(true);
    setMessage("");
  }
  async function editing(b: Budget) {
    try {
      setItems(await itemRows(b.id));
      setEdit(b);
      setDiscount(Number(b.discount_percent));
      setOpen(true);
    } catch {
      setMessage("Não foi possível abrir o orçamento.");
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    f.set("clientId", clientId);
    f.set("budgetId", edit?.id ?? "");
    f.set("items", JSON.stringify(items));
    f.set("discountPercent", String(discount));
    try {
      const result = await createBudgetAction(
        { success: false, message: "" },
        f,
      );
      setMessage(result.message);
      if (result.success) {
        setOpen(false);
        setDetail(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }
  async function status(b: Budget, value: string) {
    setBusy(true);
    try {
      const f = new FormData();
      f.set("budgetId", b.id);
      f.set("status", value);
      await updateBudgetStatusAction(f);
      await load();
    } catch {
      setMessage("Não foi possível atualizar o status.");
    } finally {
      setBusy(false);
    }
  }
  const sum = totals(items, discount);
  return (
    <div className="stack">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">Comercial</span>
          <h2>Orçamentos</h2>
        </div>
        {!readOnly && !open && (
          <button
            className="btn primary"
            disabled={!modelReady || busy}
            onClick={start}
          >
            Novo orçamento
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      {open && (
        <form
          onSubmit={save}
          className="workspace-card stack"
          key={edit?.id ?? "new"}
        >
          <div className="row">
            <h3>{edit ? "Editar orçamento" : "Nova proposta"}</h3>
            <button
              className="btn"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
          </div>
          <div className="form-grid">
            <label>
              Título
              <input
                name="title"
                required
                defaultValue={edit?.title ?? model.title}
              />
            </label>
            <label>
              Projeto
              <select name="projectId" defaultValue={edit?.project_id ?? ""}>
                <option value="">Geral do cliente</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Validade
              <input
                type="date"
                name="validUntil"
                defaultValue={edit?.valid_until ?? validity}
              />
            </label>
            <label>
              Desconto (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Demanda e escopo
            <textarea
              name="description"
              defaultValue={edit?.description ?? ""}
            />
          </label>
          {!edit && (
            <details>
              <summary>Estimar com os critérios da planilha</summary>
              <p>
                Base + horas × valor-hora + base × soma dos coeficientes.
                Aplicar substitui os valores dos três itens.
              </p>
              <div className="form-grid">
                <label>
                  Horas estimadas
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  />
                </label>
                {Array.from(
                  new Set(model.coefficients.map((c) => c.group)),
                ).map((g) => (
                  <label key={g}>
                    {g}
                    <select
                      value={factors[g] ?? -1}
                      onChange={(e) =>
                        setFactors({ ...factors, [g]: Number(e.target.value) })
                      }
                    >
                      <option value={-1}>Sem acréscimo</option>
                      {model.coefficients.map((c, i) =>
                        c.group === g ? (
                          <option key={i} value={i}>
                            {c.label} ({c.coefficient * 100}%)
                          </option>
                        ) : null,
                      )}
                    </select>
                  </label>
                ))}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  const value = estimate(
                    model,
                    hours,
                    Object.values(factors)
                      .filter((i) => i >= 0)
                      .map((i) => model.coefficients[i].coefficient),
                  );
                  const baseItems = model.services.filter((s) => s.initial);
                  setItems(
                    baseItems.map((s, i) => ({
                      description: s.description,
                      quantity: i === 1 && hours > 0 ? hours : 1,
                      unitPrice:
                        i === 0
                          ? Math.round(
                              (value - hours * model.hourlyRate) * 100,
                            ) / 100
                          : i === 1
                            ? hours > 0
                              ? model.hourlyRate
                              : 0
                            : 0,
                    })),
                  );
                }}
              >
                Aplicar estimativa aos três itens
              </button>
            </details>
          )}
          {items.map((item, i) => (
            <div className="service-row" key={i}>
              <label>
                Item {i + 1}
                <textarea
                  required
                  value={item.description}
                  onChange={(e) =>
                    setItems(
                      items.map((r, j) =>
                        j === i ? { ...r, description: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Quantidade
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems(
                      items.map((r, j) =>
                        j === i
                          ? { ...r, quantity: Number(e.target.value) }
                          : r,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Preço (R$)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) =>
                    setItems(
                      items.map((r, j) =>
                        j === i
                          ? { ...r, unitPrice: Number(e.target.value) }
                          : r,
                      ),
                    )
                  }
                />
              </label>
              <strong>{money(item.quantity * item.unitPrice)}</strong>
              <button
                type="button"
                className="btn"
                onClick={() => setItems(items.filter((_, j) => i !== j))}
              >
                Remover
              </button>
            </div>
          ))}
          <div className="row">
            <select
              aria-label="Adicionar serviço do catálogo"
              value=""
              onChange={(e) => {
                const s = model.services.find((s) => s.id === e.target.value);
                if (s) setItems([...items, { ...s }]);
              }}
            >
              <option value="">Adicionar do catálogo…</option>
              {model.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.description}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={() =>
                setItems([
                  ...items,
                  { description: "", quantity: 1, unitPrice: 0 },
                ])
              }
            >
              Item livre
            </button>
          </div>
          <label>
            Observações e pagamento
            <textarea
              name="notes"
              defaultValue={
                edit?.notes ??
                `${model.notes}\nForma de pagamento: ${model.payment}`
              }
            />
          </label>
          <div className="total-card">
            <span>
              Subtotal {money(sum.subtotal)} · Desconto {discount}%
            </span>
            <strong>{money(sum.total)}</strong>
          </div>
          <button className="btn primary" disabled={busy || !items.length}>
            {busy ? "Salvando…" : "Salvar orçamento"}
          </button>
        </form>
      )}
      {!budgets.length && !open && (
        <div className="empty-state">Nenhum orçamento disponível.</div>
      )}
      {budgets.map((b) => (
        <article key={b.id} className="workspace-card">
          <div className="row">
            <div>
              <span className="eyebrow">{b.budget_number}</span>
              <h3>{b.title}</h3>
              <small>
                {projects.find((p) => p.id === b.project_id)?.title ??
                  "Geral do cliente"}
              </small>
            </div>
            <div>
              <strong className="amount">{money(Number(b.total))}</strong>
              <span className="tag">{b.status}</span>
            </div>
          </div>
          <div className="actions">
            <button
              className="btn"
              onClick={async () => {
                try {
                  setDetail({ budget: b, items: await itemRows(b.id) });
                } catch {
                  setMessage("Erro ao carregar detalhes.");
                }
              }}
            >
              Detalhes
            </button>
            {!readOnly && (
              <>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => editing(b)}
                >
                  Editar
                </button>
                <select
                  aria-label={`Status de ${b.budget_number}`}
                  disabled={busy}
                  value={b.status}
                  onChange={(e) => status(b, e.target.value)}
                >
                  {[
                    "rascunho",
                    "enviado",
                    "aprovado",
                    "recusado",
                    "expirado",
                    "cancelado",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  className="btn danger-text"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm("Excluir este orçamento e seus itens?"))
                      return;
                    setBusy(true);
                    try {
                      const f = new FormData();
                      f.set("budgetId", b.id);
                      await deleteBudgetAction(f);
                      await load();
                    } catch {
                      setMessage("Não foi possível excluir.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Excluir
                </button>
              </>
            )}
          </div>
        </article>
      ))}
      {detail && (
        <div className="workspace-card stack">
          <div className="row">
            <h3>{detail.budget.budget_number} · Detalhes</h3>
            <button className="btn" onClick={() => setDetail(null)}>
              Fechar
            </button>
          </div>
          <p className="preserve">{detail.budget.description}</p>
          {detail.items.map((i, n) => (
            <div className="row" key={n}>
              <p>{i.description}</p>
              <strong>
                {i.quantity} × {money(i.unitPrice)}
              </strong>
            </div>
          ))}
          <p>
            Subtotal: {money(totals(detail.items, 0).subtotal)} · Desconto:{" "}
            {detail.budget.discount_percent}% · Total:{" "}
            {money(Number(detail.budget.total))}
          </p>
          <p>Validade: {detail.budget.valid_until ?? "A combinar"}</p>
          <p className="preserve">{detail.budget.notes}</p>
        </div>
      )}
    </div>
  );
}
