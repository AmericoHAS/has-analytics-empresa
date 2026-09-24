"use client";
import { billingFields } from "@/lib/commercial/billing";
import {
  budgetClientDefaults,
  budgetRequestDefaults,
  requestEstimateFactors,
} from "@/lib/commercial/budget-defaults";
import { proposalIntakeFields, intakeOptions } from "@/lib/commercial/intake";
import BudgetPlanningFields from "./BudgetPlanningFields";
import CommercialDocuments from "@/components/workspace/CommercialDocuments";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  defaultModel,
  money,
  totals,
  estimatedItems,
  type CommercialModel,
} from "@/lib/commercial/model";
import {
  saveBudget,
  archiveBudget,
  changeBudgetStatus,
} from "@/lib/workspace/budget-operations";
import PaymentPreview from "@/components/workspace/PaymentPreview";
type Item = { description: string; quantity: number; unitPrice: number };
type Budget = {
  request_details?: Record<string, string> | null;
  archived_at?: string | null;
  client_details?: Record<string, string> | null;
  publication_partnership?: boolean;
  payment_terms?: string;
  final_due_date?: string | null;
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
  projects: {
    id: string;
    title: string;
    description?: string | null;
    due_date?: string | null;
    archived_at?: string | null;
  }[];
  readOnly?: boolean;
}) {
  type Request = {
    id: string;
    project_id: string | null;
    title: string;
    description: string;
    desired_date: string | null;
    intake: Record<string, string>;
    service_type?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  const [requestDetails, setRequestDetails] = useState<Record<string, string>>(
    {},
  );
  const [formVersion, setFormVersion] = useState(0);
  const [requestsReady, setRequestsReady] = useState(readOnly);
  const [history, setHistory] = useState(false);
  const [clientDetails, setClientDetails] = useState<Record<string, string>>(
    {},
  );
  const [billing, setBilling] = useState<Record<string, string> | null>(null);
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]),
    [source, setSource] = useState<Request | null>(null),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [projectId, setProjectId] = useState(""),
    [partnership, setPartnership] = useState(false);
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
    if (!readOnly)
      supabase
        .from("budget_requests")
        .select(
          "id,project_id,title,description,desired_date,intake,name,email,phone,service_type",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            setMessage(
              "Não foi possível carregar as solicitações. Atualize antes de preparar a proposta.",
            );
            return;
          }
          setRequests(data ?? []);
          setRequestsReady(true);
        });
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
  useEffect(() => {
    if (readOnly) return;
    let active = true;
    void Promise.all([
      supabase
        .from("client_billing_profiles")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase.rpc("budget_client_contact", { p_client: clientId }),
    ]).then(([b, p]) => {
      if (!active) return;
      if (b.error || p.error) {
        setMessage(
          "Não foi possível carregar o cadastro. Atualize antes de preparar a proposta.",
        );
        return;
      }
      setBilling(b.data);
      setProfile(p.data);
      setIdentityReady(true);
    });
    return () => {
      active = false;
    };
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
  const applyProjectDefaults = useCallback(
    (data: Record<string, string | number>) => {
      if (data.estimated_hours) setHours(Number(data.estimated_hours));
      setRequestDetails((current) => ({
        ...current,
        department: current.department || String(data.department ?? ""),
        research_area:
          current.research_area || String(data.research_area ?? ""),
      }));
      if (data.complexity)
        setFactors((current) => ({
          ...current,
          Complexidade: model.coefficients.findIndex(
            (c) => c.group === "Complexidade" && c.label === data.complexity,
          ),
        }));
    },
    [model],
  );
  function applyRequest(r: Request | null) {
    setSource(r);
    setClientDetails(budgetClientDefaults(billing, profile, r));
    const linked = projects.find((p) => p.id === r?.project_id);
    const defaults = budgetRequestDefaults(r, linked, model.title);
    setTitle(defaults.title);
    setDescription(defaults.description);
    setRequestDetails(defaults.details);
    setFactors(requestEstimateFactors(defaults.details, model));
    setHours(8);
    setFormVersion((v) => v + 1);
    setProjectId(r?.project_id ?? "");
  }
  function start() {
    applyRequest(requests[0] ?? null);
    setPartnership(false);
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
      setClientDetails(
        b.client_details ?? budgetClientDefaults(billing, profile, null),
      );
      const { data: planning, error: planningError } = await supabase
        .from("budget_planning")
        .select("request_id,department")
        .eq("budget_id", b.id)
        .maybeSingle();
      if (planningError) throw Error("Planejamento indisponível.");
      const linkedRequest =
        requests.find((r) => r.id === planning?.request_id) ??
        (b.project_id
          ? requests.find((r) => r.project_id === b.project_id)
          : null) ??
        null;
      setSource(linkedRequest);
      setRequestDetails(
        b.request_details ?? {
          ...(linkedRequest?.intake ?? {}),
          ...(linkedRequest?.service_type
            ? { service_type: linkedRequest.service_type }
            : {}),
          ...(planning?.department ? { department: planning.department } : {}),
        },
      );
      setFormVersion((v) => v + 1);
      setTitle(b.title);
      setDescription(b.description);
      setProjectId(b.project_id ?? "");
      setPartnership(b.publication_partnership ?? false);
      setDiscount(Number(b.discount_percent));
      setOpen(true);
    } catch {
      setMessage("Não foi possível abrir o orçamento.");
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("Salvando orçamento…");
    const f = new FormData(e.currentTarget);
    f.set("clientId", clientId);
    f.set("clientDetails", JSON.stringify(clientDetails));
    f.set("requestDetails", JSON.stringify(requestDetails));
    f.set("budgetId", edit?.id ?? "");
    f.set("items", JSON.stringify(items));
    f.set("discountPercent", String(discount));
    f.set("publicationPartnership", String(partnership));
    try {
      const result = await saveBudget(supabase, f);
      setMessage(result.message);
      if (result.success) {
        setOpen(false);
        setDetail(null);
        if (result.id) setDocumentBudget(result.id);
        window.dispatchEvent(new Event("has-workflow-updated"));
        await load();
      }
    } catch {
      setMessage(
        "Falha de comunicação ao salvar. Atualize a página e tente novamente; se persistir, entre novamente na conta.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function status(b: Budget, value: string) {
    setBusy(true);
    try {
      const result = await changeBudgetStatus(supabase, b.id, value);
      setMessage(result.message);
      if (result.success) {
        window.dispatchEvent(new Event("has-workflow-updated"));
        await load();
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Não foi possível atualizar o status.",
      );
    } finally {
      setBusy(false);
    }
  }
  const [documentBudget, setDocumentBudget] = useState<string | null>(null);
  function updateEstimate(nextHours: number, nextFactors: Record<string, number>) {
    setHours(nextHours);
    setFactors(nextFactors);
    setItems((current) => estimatedItems(model, current, nextHours, nextFactors));
  }
  const sum = totals(items, discount);
  const shownBudgets = budgets.filter((b) =>
    history ? !!b.archived_at : !b.archived_at,
  );
  if (readOnly)
    return <CommercialDocuments clientId={clientId} kind="orcamento" />;
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
            disabled={!modelReady || !identityReady || !requestsReady || busy}
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
          onInvalid={(e) => {
            const field = e.target as HTMLInputElement;
            let details = field.closest("details");
            while (details) {
              details.open = true;
              details = details.parentElement?.closest("details") ?? null;
            }
            setMessage(
              `Confira ${field.closest("label")?.textContent?.trim() || "os campos obrigatórios"}: ${field.validationMessage}`,
            );
          }}
          className="workspace-card stack"
          key={`${edit?.id ?? "new"}:${formVersion}`}
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
          <p className="workflow-notice">
            1. Revise a demanda → 2. Confira os valores → 3. Salve e prepare o
            PDF. Campos internos são opcionais.
          </p>
          {!edit && (
            <label>
              Preencher com a solicitação do cliente
              <select
                value={source?.id ?? ""}
                onChange={(e) =>
                  applyRequest(
                    requests.find((r) => r.id === e.target.value) ?? null,
                  )
                }
              >
                <option value="">Orçamento sem solicitação</option>
                {requests.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
              <small>
                Os dados são copiados para edição. A solicitação original
                permanece preservada.
              </small>
            </label>
          )}
          <details className="budget-identity">
            <summary>
              Dados do cliente ·{" "}
              {clientDetails.legal_name || "conferir cadastro"}
            </summary>
            <p className="muted">
              Preenchidos com o cadastro existente. Alterações aqui ficam nesta
              proposta; revise antes de gerar os documentos.
            </p>
            <div className="form-grid">
              {billingFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type={key === "email" ? "email" : "text"}
                    maxLength={350}
                    value={clientDetails[key] ?? ""}
                    onChange={(e) =>
                      setClientDetails({
                        ...clientDetails,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <details className="budget-section" open>
            <summary>Demanda e escopo</summary>
            <div className="form-grid">
              <label>
                Título
                <input
                  name="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Projeto
                <select
                  name="projectId"
                  value={projectId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const nextRequest = requests.find(
                      (r) => r.project_id === nextId,
                    );
                    if (
                      !edit &&
                      nextRequest &&
                      nextRequest.id !== source?.id &&
                      confirm(
                        "Preencher esta proposta com a solicitação do projeto escolhido? Os campos da demanda serão substituídos.",
                      )
                    ) {
                      applyRequest(nextRequest);
                      return;
                    }
                    setProjectId(nextId);
                    const p = projects.find((p) => p.id === nextId);
                    if (!edit && p) {
                      if (!title || title === model.title) setTitle(p.title);
                      if (!description) setDescription(p.description ?? "");
                    }
                  }}
                >
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
                  defaultValue={edit ? (edit.valid_until ?? "") : validity}
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
              Descrição da demanda
              <textarea
                name="description"
                aria-label="Descrição da demanda"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="form-grid">
              {proposalIntakeFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  {intakeOptions[key] ? (
                    <select
                      aria-label={label}
                      value={requestDetails[key] ?? ""}
                      onChange={(e) => {
                        const next = {
                          ...requestDetails,
                          [key]: e.target.value,
                        };
                        setRequestDetails(next);
                        const mapped = requestEstimateFactors(next, model);
                        setFactors((current) => ({
                          ...mapped,
                          Complexidade: current.Complexidade ?? -1,
                        }));
                      }}
                    >
                      <option value="">A definir</option>
                      {requestDetails[key] &&
                        !intakeOptions[key].includes(requestDetails[key]) && (
                          <option>{requestDetails[key]}</option>
                        )}
                      {intakeOptions[key].map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      maxLength={250}
                      aria-label={label}
                      value={requestDetails[key] ?? ""}
                      onChange={(e) => {
                        const next = {
                          ...requestDetails,
                          [key]: e.target.value,
                        };
                        setRequestDetails(next);
                        const mapped = requestEstimateFactors(next, model);
                        setFactors((current) => ({
                          ...mapped,
                          Complexidade: current.Complexidade ?? -1,
                        }));
                      }}
                    />
                  )}
                </label>
              ))}
            </div>
            <small>
              Opções iguais às da solicitação do cliente. Você pode revisar os
              dados nesta proposta; o pedido original é preservado.
            </small>
          </details>
          <label className="partnership-option">
            <input
              type="checkbox"
              checked={partnership}
              onChange={(e) => {
                setPartnership(e.target.checked);
                setDiscount(e.target.checked ? 30 : model.discount);
              }}
            />{" "}
            Parceria em publicação — aplicar desconto de 30%
          </label>
          {partnership && (
            <p className="muted">
              Desconto editável acima. As condições da colaboração devem ser
              acordadas; a parceria não garante autoria.
            </p>
          )}
          {!edit && (
            <details>
              <summary>Estimar com os critérios da planilha</summary>
              <p>
                Base + horas × valor-hora + base × soma dos coeficientes.
                Ao alterar as horas ou os critérios, os valores dos três itens
                e o total são recalculados automaticamente. As descrições e os
                serviços adicionais são preservados. Salve para registrar a alteração.
              </p>
              <div className="form-grid">
                <label>
                  Horas estimadas
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    value={hours}
                    onChange={(e) => updateEstimate(Number(e.target.value), factors)}
                  />
                </label>
                {Array.from(
                  new Set(model.coefficients.map((c) => c.group)),
                ).map((g) => (
                  <label key={g}>
                    {g}
                    <select
                      aria-label={g}
                      value={factors[g] ?? -1}
                      onChange={(e) =>
                        updateEstimate(hours, { ...factors, [g]: Number(e.target.value) })
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

            </details>
          )}
          <details className="budget-section">
            <summary>Etapas e valores internos · {items.length} itens</summary>
            <p className="muted">
              Preços unitários são usados apenas no cálculo interno. Os
              documentos apresentam os serviços e o valor global da proposta.
            </p>
            {items.map((item, i) => (
              <details className="budget-item" key={i} open={!item.description}>
                <summary>
                  Etapa {i + 1} · {item.description.slice(0, 90) || "Novo item"}
                </summary>
                <div className="service-row">
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
              </details>
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
          </details>
          <details className="budget-section">
            <summary>Observações e pagamento</summary>
            <label>
              Observações e pagamento
              <textarea
                name="notes"
                defaultValue={edit?.notes ?? model.notes}
              />
            </label>
            <PaymentPreview total={sum.total} />
          </details>
          <BudgetPlanningFields
            source={source}
            context={requestDetails}
            onDefaults={edit ? undefined : applyProjectDefaults}
            onPricingChange={(pricing) => {
              setHours(pricing.hours);
              setItems((current) => estimatedItems(
                { ...model, baseValue: pricing.base + pricing.additions, coefficients: [] },
                current, pricing.hours, {},
              ));
            }}
            projectId={projectId}
            key={`${edit?.id ?? "new"}:${source?.id ?? "planning"}:${projectId}`}
            clientId={clientId}
            budgetId={edit?.id}
            payment={edit?.payment_terms ?? model.payment}
            delivery={
              edit
                ? (edit.final_due_date ?? "")
                : (projects.find((p) => p.id === projectId)?.due_date ?? "")
            }
            hours={hours}
            base={model.baseValue}
            additions={
              model.baseValue *
              Object.values(factors)
                .filter((i) => i >= 0)
                .reduce(
                  (sum, i) => sum + (model.coefficients[i]?.coefficient ?? 0),
                  0,
                )
            }
          />
          <div className="total-card">
            <span>
              Subtotal {money(sum.subtotal)} · Desconto {discount}%
            </span>
            <strong>{money(sum.total)}</strong>
          </div>
          {message && (
            <p className="action-feedback" role="status">
              {message}
            </p>
          )}
          <button className="btn primary" disabled={busy || !items.length}>
            {busy ? "Salvando…" : "Salvar orçamento"}
          </button>
        </form>
      )}
      {!shownBudgets.length && !open && (
        <div className="empty-state">Nenhum orçamento disponível.</div>
      )}
      {!open && (
        <label className="filters">
          Lista de orçamentos
          <select
            value={history ? "history" : "active"}
            onChange={(e) => setHistory(e.target.value === "history")}
          >
            <option value="active">Ativos</option>
            <option value="history">Histórico arquivado</option>
          </select>
        </label>
      )}
      {shownBudgets.map((b) => (
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
              className="btn primary"
              aria-expanded={documentBudget === b.id}
              onClick={() =>
                setDocumentBudget(documentBudget === b.id ? null : b.id)
              }
            >
              PDF e envio
            </button>
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
                  disabled={busy || !!b.archived_at}
                  onClick={() => editing(b)}
                >
                  Editar
                </button>
                <select
                  aria-label={`Status de ${b.budget_number}`}
                  disabled={busy || !!b.archived_at}
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
                    <option key={s} disabled={s === "enviado"}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  className="btn danger-text"
                  disabled={busy || !!b.archived_at}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Arquivar este orçamento? Os documentos já gerados serão preservados.",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      const result = await archiveBudget(supabase, b.id);
                      setMessage(result.message);
                      if (result.success) {
                        window.dispatchEvent(new Event("has-workflow-updated"));
                        await load();
                      }
                    } catch (e) {
                      setMessage(
                        e instanceof Error
                          ? e.message
                          : "Não foi possível arquivar.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Arquivar
                </button>
              </>
            )}
          </div>
          {documentBudget === b.id && (
            <CommercialDocuments
              key={b.id}
              clientId={clientId}
              admin
              kind="orcamento"
              budgetId={b.id}
              compact
              onChange={load}
              refreshKey={`${b.total}:${b.status}`}
            />
          )}
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
