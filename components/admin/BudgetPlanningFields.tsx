"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PresetField, {
  projectPresets,
} from "@/components/workspace/PresetField";
export default function BudgetPlanningFields({
  source,
  context,
  projectId,
  clientId,
  budgetId,
  payment,
  delivery,
  hours,
  base,
  additions,
  onDefaults,
  onPricingChange,
  rate, complexity, onComplexityChange,
}: {
  source?: {
    id: string;
    desired_date: string | null;
    intake: Record<string, string>;
  } | null;
  context: Record<string, string>;
  projectId?: string;
  clientId: string;
  budgetId?: string;
  payment: string;
  delivery: string;
  hours: number;
  base: number;
  additions: number;
  onDefaults?: (data: Record<string, string | number>) => void;
  onPricingChange: (pricing: { hours: number; base: number; additions: number; rate: number }) => void;
  rate: number; complexity: string; onComplexityChange: (value: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [request, setRequest] = useState(source?.id ?? "");
  const [ready, setReady] = useState(!budgetId && !projectId);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!budgetId && !projectId) return;
    let active = true;
    void (async () => {
      const query = budgetId
        ? supabase.from("budget_planning").select("*").eq("budget_id", budgetId)
        : supabase
            .from("project_private")
            .select(
              "department,research_area,data_assessment,complexity,estimated_hours,admin_notes",
            )
            .eq("project_id", projectId!);
      const { data, error } = await query.maybeSingle();
      if (!active) return;
      if (error) {
        setMessage(
          "Não foi possível carregar o planejamento. Feche e reabra a proposta para tentar novamente.",
        );
        return;
      }
      if (budgetId) {
        setValues(data ?? {});
        setRequest(data && "request_id" in data ? String(data.request_id ?? source?.id ?? "") : source?.id ?? "");
      } else {
        const defaults = Object.fromEntries(
          Object.entries(data ?? {}).filter(
            ([, v]) => v !== "" && v !== 0 && v !== null,
          ),
        ) as Record<string, string | number>;
        setValues({ ...defaults, internal_notes: defaults.admin_notes ?? "" });
        onDefaults?.(defaults);
      }
      setReady(true);
    })().catch(() => {
      if (active)
        setMessage(
          "Falha de conexão ao carregar o planejamento. Feche e reabra a proposta.",
        );
    });
    return () => {
      active = false;
    };
  }, [clientId, budgetId, projectId, source?.id, onDefaults]);
  if (!ready)
    return (
      <fieldset>
        <legend>Planejamento</legend>
        <p role="status">{message || "Carregando dados do projeto…"}</p>
        <input
          required
          value=""
          onChange={() => {}}
          aria-label="Aguarde os campos comerciais"
        />
      </fieldset>
    );
  return (
    <details className="budget-section">
      <summary>Prazo e planejamento interno</summary>
      <input type="hidden" name="requestId" value={request} />
      <input
        type="hidden"
        name="department"
        value={context.department ?? String(values.department ?? "")}
      />
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
            defaultValue={
              budgetId ? delivery : delivery || source?.desired_date || ""
            }
          />
        </label>
      </div>
      <p className="muted">
        As respostas do cliente estão em Demanda e escopo. A avaliação técnica
        abaixo é interna e não aparece no documento. Os valores das etapas ficam
        apenas no cálculo administrativo.
      </p>
      <p className="muted">Alterar horas, valor base ou acréscimos recalcula o valor final do orçamento.</p>
      <div className="form-grid">
        {[
          ["dataAssessment", "Avaliação técnica do banco", "data_assessment"],
          ["complexity", "Complexidade da análise", "complexity"],
        ].map(([name, label, key]) => (
          <label key={name}>
            {label}
            {key === "complexity" ? <select name={name} value={complexity} onChange={e => onComplexityChange(e.target.value)}>
              <option value="">Sem acréscimo</option>
              {Array.from(new Set([...projectPresets.complexity, ...(complexity ? [complexity] : [])])).map(v => <option key={v}>{v}</option>)}
            </select> : <PresetField
              name={name}
              value={String(values[key] ?? "")}
              options={projectPresets[key] ?? []}
            />}
          </label>
        ))}
        {[
          ["estimatedHours", "Horas estimadas", "estimated_hours", hours],
          ["hourlyRate", "Valor-hora (R$)", "hourly_rate", rate],
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
                Math.round(Number(value) * 100) / 100
              }
              onChange={(e) => {
                const next = { estimated_hours: hours, base_value: base, additions, hourly_rate: rate, [String(key)]: Number(e.target.value) };
                onPricingChange({ hours: next.estimated_hours, base: next.base_value, additions: next.additions, rate: next.hourly_rate });
              }}
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
  );
}
