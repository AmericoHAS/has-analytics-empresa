import { budgetServices } from "../budget-request";
export const intakeFields = [
  ["research_area", "Área da pesquisa"],
  ["data_status", "Situação do banco de dados"],
  ["urgency", "Urgência"],
  ["purpose", "Finalidade do trabalho"],
  ["delivery_model", "Modelo de entrega"],
  ["department", "Departamento / instituição"],
] as const;
export const proposalIntakeFields = [
  ["service_type", "Tipo de serviço"],
  ...intakeFields,
] as const;
export const intakeOptions: Record<string, string[]> = {
  service_type: [...budgetServices],
  data_status: [
    "Ainda não coletado",
    "Em coleta",
    "Planilha organizada",
    "Dados precisam de organização",
    "Preciso de avaliação",
  ],
  urgency: [
    "Prazo flexível",
    "Prazo definido",
    "Urgente — sujeito à disponibilidade",
  ],
  purpose: [
    "Artigo científico",
    "TCC",
    "Dissertação",
    "Tese",
    "Relatório técnico",
    "Projeto empresarial",
    "Outro",
  ],
  delivery_model: [
    "Relatório PDF",
    "Relatório + tabelas e gráficos",
    "Relatório reproduzível em R Markdown",
    "Dashboard / aplicativo",
    "A combinar",
  ],
};

export function intakeDescription(
  values: Record<string, string>,
  description = "",
) {
  const text = description
    .split("\n")
    .filter(
      (line) =>
        !proposalIntakeFields.some(
          ([key, label]) =>
            Object.prototype.hasOwnProperty.call(values, key) &&
            line.startsWith(`${label}: `),
        ),
    )
    .join("\n");
  return [
    text,
    ...proposalIntakeFields
      .filter(([key]) => values[key])
      .map(([key, label]) => `${label}: ${values[key]}`),
  ]
    .filter(Boolean)
    .join("\n");
}

// Older public submissions append this exact system-generated consent marker.
// Keep the stored request untouched; remove only that suffix for document display.
export function originalRequestDescription(description: string | null | undefined) {
  return (description ?? "").split("\n\n[Solicita orçamento e acesso à área do cliente. Autoriza contato sobre esta demanda.]")[0];
}
