export const intakeFields = [
 ["research_area", "Área da pesquisa"], ["data_status", "Situação do banco de dados"], ["urgency", "Urgência"], ["purpose", "Finalidade do trabalho"], ["delivery_model", "Modelo de entrega"], ["department", "Departamento / instituição"],
] as const;
export const intakeOptions: Record<string, string[]> = {
 data_status: ["Ainda não coletado", "Em coleta", "Planilha organizada", "Dados precisam de organização", "Preciso de avaliação"],
 urgency: ["Prazo flexível", "Prazo definido", "Urgente — sujeito à disponibilidade"],
 purpose: ["Artigo científico", "TCC", "Dissertação", "Tese", "Relatório técnico", "Projeto empresarial", "Outro"],
 delivery_model: ["Relatório PDF", "Relatório + tabelas e gráficos", "Relatório reproduzível em R Markdown", "Dashboard / aplicativo", "A combinar"],
};
