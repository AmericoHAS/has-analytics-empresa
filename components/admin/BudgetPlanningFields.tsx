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
        setRequest(data?.request_id ?? source?.id ?? "");
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
      <div className="form-grid">
        {[
          ["dataAssessment", "Avaliação técnica do banco", "data_assessment"],
          ["complexity", "Complexidade da análise", "complexity"],
        ].map(([name, label, key]) => (
          <label key={name}>
            {label}
            <PresetField
              name={name}
              value={String(values[key] ?? "")}
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
                setValues((v) => ({ ...v, [String(key)]: e.target.value }))
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
  );
}
