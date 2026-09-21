"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PresetField, {
  projectPresets,
} from "@/components/workspace/PresetField";
import { intakeFields } from "@/lib/commercial/intake";
export default function BudgetPlanningFields({
  source,
  clientId,
  budgetId,
  payment,
  delivery,
  hours,
  base,
  additions,
}: {
  source?: {
    id: string;
    desired_date: string | null;
    intake: Record<string, string>;
  } | null;
  clientId: string;
  budgetId?: string;
  payment: string;
  delivery: string;
  hours: number;
  base: number;
  additions: number;
}) {
  const [values, setValues] = useState<Record<string, string | number>>({}),
    [requests, setRequests] = useState<
      { id: string; title: string; intake?: Record<string, string> }[]
    >([]),
    [request, setRequest] = useState(source?.id ?? ""),
    [ready, setReady] = useState(!budgetId),
    [message, setMessage] = useState("");
  useEffect(() => {
    supabase
      .from("budget_requests")
      .select("id,title,intake")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRequests(data ?? []));
    if (budgetId)
      supabase
        .from("budget_planning")
        .select("*")
        .eq("budget_id", budgetId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error)
            setMessage(
              "Não foi possível carregar os campos internos. Reabra após atualizar o banco.",
            );
          else {
            setValues(data ?? {});
            setRequest(data?.request_id ?? "");
            setReady(true);
          }
        });
  }, [clientId, budgetId]);
  if (!ready)
    return (
      <fieldset>
        <legend>Campos comerciais</legend>
        <p>{message || "Carregando…"}</p>
        <input
          required
          value=""
          onChange={() => {}}
          aria-label="Aguarde os campos comerciais"
        />
      </fieldset>
    );
  const selected = requests.find((r) => r.id === request);
  return (
    <fieldset className="project-metadata-fields">
      <legend>Planejamento e condições da proposta</legend>
      <label>
        Solicitação vinculada
        <select
          name="requestId"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
        >
          <option value="">Sem solicitação vinculada</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <dl className="form-grid">
          {intakeFields.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{selected.intake?.[key] || "A definir"}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="form-grid">
        <label>
          Forma / condições de pagamento
          <input name="paymentTerms" defaultValue={payment} maxLength={3000} />
        </label>
        <label>
          Prazo final de entrega
          <input
            name="finalDueDate"
            type="date"
            defaultValue={delivery || source?.desired_date || ""}
          />
        </label>
      </div>
      <details>
        <summary>Planejamento interno (opcional)</summary>
        <p className="muted">
          Somente administração: os campos abaixo não aparecem nos documentos do
          cliente. Base, horas e acréscimos registram a memória do cálculo; o
          total é calculado pelos itens e desconto.
        </p>
        <div className="form-grid">
          {[
            ["dataAssessment", "Avaliação interna do banco", "data_assessment"],
            ["complexity", "Complexidade da análise", "complexity"],
            ["department", "Departamento", "department"],
          ].map(([name, label, key]) => (
            <label key={name}>
              {label}
              <PresetField
                name={name}
                value={String(
                  values[key] ??
                    source?.intake?.[
                      key === "data_assessment" ? "data_status" : key
                    ] ??
                    "",
                )}
                options={projectPresets[key] ?? []}
              />
            </label>
          ))}
          {[
            ["estimatedHours", "Horas estimadas", "estimated_hours", hours],
            ["baseValue", "Valor base (R$)", "base_value", base],
            ["additions", "Acréscimos (R$)", "additions", additions],
          ].map(([name, label, key, value]) => (
            <label key={String(name)}>
              {label}
              <input
                name={String(name)}
                type="number"
                min="0"
                step="0.01"
                value={
                  values[String(key)] ?? Math.round(Number(value) * 100) / 100
                }
                onChange={(e) =>
                  setValues((current) => ({
                    ...current,
                    [String(key)]: e.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <label>
          Observações internas
          <textarea
            name="internalNotes"
            defaultValue={String(values.internal_notes ?? "")}
          />
        </label>
      </details>
    </fieldset>
  );
}
