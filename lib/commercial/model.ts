import reference from "./reference.json";
export type Service = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  initial: boolean;
};
export type CommercialModel = {
  title: string;
  notes: string;
  payment: string;
  validityDays: number;
  discount: number;
  hourlyRate: number;
  baseValue: number;
  services: Service[];
  coefficients: { group: string; label: string; coefficient: number }[];
};
export const defaultModel: CommercialModel = {
  title: "Análise Estatística dos Dados de Pesquisa",
  notes:
    "O prazo de entrega inicia após a confirmação do pagamento e o recebimento de todos os arquivos necessários.\nNovas análises e alterações do escopo devem ser acordadas previamente.",
  payment: "Pix ou cartão — condições a combinar",
  validityDays: 15,
  discount: 0,
  hourlyRate: 70,
  baseValue: 250,
  services: [
    {
      id: "banco",
      description:
        "Organização do banco de dados: conferência, codificação, consistência e preparação das variáveis.",
      quantity: 1,
      unitPrice: 250,
      initial: true,
    },
    {
      id: "analise",
      description:
        "Análise estatística: análises descritivas e inferenciais conforme os objetivos e a adequação dos dados.",
      quantity: 8,
      unitPrice: 70,
      initial: true,
    },
    {
      id: "relatorio",
      description:
        "Relatório: interpretação dos resultados, tabelas, gráficos, organização dos arquivos e esclarecimentos.",
      quantity: 1,
      unitPrice: 0,
      initial: true,
    },
  ],
  coefficients: reference,
};
export const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
export function totals(
  items: { quantity: number; unitPrice: number }[],
  discount: number,
) {
  const cents = items.reduce(
    (sum, i) =>
      sum +
      Math.round(
        (Math.round(i.quantity * 100) * Math.round(i.unitPrice * 100)) / 100,
      ),
    0,
  );
  const total = Math.round(cents * (1 - discount / 100));
  return { subtotal: cents / 100, total: total / 100 };
}
// Reconstructed from the reference workbook: base + hours × hourly rate + base × sum(coefficients).
export function estimate(
  model: CommercialModel,
  hours: number,
  coefficients: number[],
) {
  return (
    Math.round(
      (model.baseValue +
        hours * model.hourlyRate +
        model.baseValue * coefficients.reduce((a, b) => a + b, 0)) *
        100,
    ) / 100
  );
}
