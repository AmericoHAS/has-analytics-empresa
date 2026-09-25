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

export function estimatedItems(
  model: CommercialModel,
  items: { description: string; quantity: number; unitPrice: number }[],
  hours: number,
  factors: Record<string, number>,
) {
  const value = estimate(model, hours, Object.values(factors)
    .filter((index) => index >= 0 && !!model.coefficients[index])
    .map((index) => model.coefficients[index].coefficient));
  const defaults = model.services.filter((service) => service.initial);
  return Array.from({ length: Math.max(items.length, defaults.length) }, (_, index) => {
    const item = items[index] ?? defaults[index];
    if (index >= 3) return { ...item };
    return { ...item,
      quantity: index === 1 && hours > 0 ? hours : 1,
      unitPrice: index === 0 ? Math.round((value - hours * model.hourlyRate) * 100) / 100
        : index === 1 && hours > 0 ? model.hourlyRate : 0,
    };
  });
}

export type BudgetPricing = { hours: number; rate: number; base: number; additions: number; factors: Record<string, number> };
export const coefficientTotal = (model: CommercialModel, factors: Record<string, number>) =>
  Object.values(factors).reduce((sum, index) => sum + (model.coefficients[index]?.coefficient ?? 0), 0);
export function changePricingFactors(model: CommercialModel, pricing: BudgetPricing, factors: Record<string, number>): BudgetPricing {
  return { ...pricing, factors, additions: Math.max(0, Math.round((pricing.additions + pricing.base * (coefficientTotal(model, factors) - coefficientTotal(model, pricing.factors))) * 100) / 100) };
}
export function pricingItems(model: CommercialModel, items: { description: string; quantity: number; unitPrice: number }[], pricing: BudgetPricing) {
  const current = items.length ? items : model.services.filter(s => s.initial);
  return current.map((item, index) => index === 0
    ? { ...item, quantity: 1, unitPrice: Math.max(0, Math.round((pricing.base + pricing.additions + (current.length === 1 ? pricing.hours * pricing.rate : 0)) * 100) / 100) }
    : index === 1 ? { ...item, quantity: pricing.hours > 0 ? pricing.hours : 1, unitPrice: pricing.hours > 0 ? pricing.rate : 0 }
    : { ...item });
}
