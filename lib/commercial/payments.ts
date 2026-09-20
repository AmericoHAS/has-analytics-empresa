export type PaymentOption = {
  id: string;
  label: string;
  method: "pix" | "card";
  installments: number;
  feePercent: number;
  enabled: boolean;
};
export type PaymentQuote = PaymentOption & {
  base: number;
  total: number;
  installment: number;
  lastInstallment: number;
};
export const defaultPaymentOptions: PaymentOption[] = [
  {
    id: "pix",
    label: "Pix à vista",
    method: "pix",
    installments: 1,
    feePercent: 0,
    enabled: true,
  },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `card-${i + 1}`,
    label: `Cartão em ${i + 1}x`,
    method: "card" as const,
    installments: i + 1,
    feePercent: 0,
    enabled: false,
  })),
];
// feePercent is the processor's deduction: gross up to preserve the agreed net amount.
export function quotePayment(
  base: number,
  option: PaymentOption,
): PaymentQuote {
  if (
    !Number.isFinite(base) ||
    base < 0 ||
    !Number.isFinite(option.feePercent) ||
    option.feePercent < 0 ||
    option.feePercent >= 50 ||
    !Number.isInteger(option.installments) ||
    option.installments < 1 ||
    option.installments > 12
  )
    throw Error("Revise valor, parcelas e taxa (0 a 49,99%).");
  const cents = Math.round((base * 100) / (1 - option.feePercent / 100));
  const part = Math.floor(cents / option.installments);
  return {
    ...option,
    base,
    total: cents / 100,
    installment: part / 100,
    lastInstallment: (cents - part * (option.installments - 1)) / 100,
  };
}
export function paymentDescription(q: PaymentQuote) {
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `${q.label}: total ${brl(q.total)}. ${q.installments === 1 ? "Pagamento único." : `${q.installments - 1} parcela(s) de ${brl(q.installment)} e última de ${brl(q.lastInstallment)}.`} Taxa da operadora: ${q.feePercent}%. Acréscimo incluído: ${brl(q.total - q.base)}.`;
}
