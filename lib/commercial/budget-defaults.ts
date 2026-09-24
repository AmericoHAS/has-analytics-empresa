import type { CommercialModel } from "./model";
import { billingFields } from "./billing";
// Only used when opening a NEW proposal. Saved proposal snapshots always win,
// including intentionally cleared fields, and are never merged with newer profile data.
export function budgetClientDefaults(
  billing: Record<string, string> | null,
  profile: Record<string, string> | null,
  request: Record<string, unknown> | null,
) {
  const intake = (request?.intake ?? {}) as Record<string, string>;
  const fallback: Record<string, string> = {
    legal_name: String(request?.name || profile?.full_name || ""),
    email: String(request?.email || profile?.email || ""),
    phone: String(request?.phone || profile?.phone || ""),
    institution: intake.institution || intake.department || "",
  };
  return Object.fromEntries(
    billingFields.map(([key]) => [key, billing?.[key] ?? fallback[key] ?? ""]),
  );
}

export function budgetRequestDefaults(
  request: {
    intake?: Record<string, string>;
    title?: string;
    service_type?: string;
    description?: string;
    desired_date?: string | null;
  } | null,
  project?: {
    title?: string;
    description?: string | null;
    due_date?: string | null;
  },
  defaultTitle = "",
) {
  return {
    title: request?.title || project?.title || defaultTitle,
    description: request?.description || project?.description || "",
    delivery: project?.due_date || request?.desired_date || "",
    details: {
      ...(request?.intake ?? {}),
      ...(request?.service_type ? { service_type: request.service_type } : {}),
    },
  };
}
// Only equivalent choices are matched. An undefined/ambiguous answer never
// silently becomes a surcharge; the Admin explicitly applies the estimate.
export function requestEstimateFactors(
  details: Record<string, string>,
  model: CommercialModel,
) {
  const groups: Record<string, string> = {
    Complexidade: "complexity",
    Banco: "data_status",
    Urgência: "urgency",
    Responsabilidade: "purpose",
    Modelo: "delivery_model",
  };
  const aliases: Record<string, string> = {
    "Planilha organizada": "Banco limpo e organizado",
    "Prazo flexível": "Prazo normal",
    "Relatório + tabelas e gráficos":
      "Análise dos dados com tabelas e gráficos",
  };
  return Object.fromEntries(
    [...new Set(model.coefficients.map((c) => c.group))].map((group) => {
      const value = details[groups[group]];
      return [
        group,
        value
          ? model.coefficients.findIndex(
              (c) =>
                c.group === group &&
                (c.label === value || c.label === aliases[value]),
            )
          : -1,
      ];
    }),
  );
}
