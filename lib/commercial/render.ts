import {
  fillHasTemplate,
  hasTemplatePdf,
  type TemplateKind,
} from "./template-engine";
export type DocumentSnapshot = {
  reference: string;
  kind: TemplateKind;
  title: string;
  body: string;
  created: string;
  client: Record<string, string>;
  provider: Record<string, string>;
  budget: {
    number: string;
    description: string;
    notes: string;
    subtotal: number;
    discount: number;
    total: number;
    payment: string;
    due: string;
    validity: string;
  };
  items: { description: string; quantity: number; unit_price: number }[];
  template?: {
    engine?: string;
    paymentInstructions?: string;
    department?: string;
    requestText?: string;
    projectTitle?: string;
    revisions?: string;
    forumCity?: string;
    signatureCity?: string;
    startDate?: string;
    partnershipClause?: string;
    pixKey?: string;
    paymentLink?: string;
    paymentDate?: string;
    transactionId?: string;
    contractNumber?: string;
    installments?: string;
    amountWords?: string;
  };
};
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("/") : s;
export function templateValues(s: DocumentSnapshot): Record<string, string> {
  const t = s.template ?? {};
  return {
    TITULO_PROJETO: t.projectTitle ?? s.title,
    NOME_CLIENTE: s.client.legal_name,
    DEPARTAMENTO: t.department ?? s.client.institution ?? "",
    DATA: s.created,
    SOLICITACAO_CLIENTE: t.requestText ?? "",
    DESCRICAO_ANALISE_HAS: s.budget.description,
    ...Object.fromEntries(s.items.map((item, index) => [`FASE_${index + 1}`, item.description])),
    FASE_1: s.items[0]?.description ?? "Não incluída neste escopo",
    FASE_2: s.items[1]?.description ?? "Não incluída neste escopo",
    FASE_3: s.items[2]?.description ?? "Não incluída neste escopo",
    OBSERVACOES: [
      s.budget.notes,
      s.body,
      `Proposta ${s.budget.number} · versão ${s.reference}. Validade: ${date(s.budget.validity) || "A combinar"}.`,
    ]
      .filter(Boolean)
      .join("\n"),
    VALOR_TOTAL: money(s.budget.subtotal),
    DESCONTO: `${s.budget.discount}% (${money((s.budget.subtotal * s.budget.discount) / 100)})`,
    VALOR_FINAL: money(s.budget.total),
    FORMA_PAGAMENTO: s.budget.payment || "A combinar",
    PRAZO_ENTREGA: date(s.budget.due) || "A combinar",
    ID_CONTRATO: t.contractNumber ?? `CTR-${s.reference}`,
    ID_ORCAMENTO: s.budget.number,
    CPF_CNPJ_CLIENTE: s.client.tax_id,
    EMAIL_CLIENTE: s.client.email,
    WHATSAPP_CLIENTE: s.client.phone,
    DESCRICAO_DEMANDA: t.requestText ?? "",
    DESCRICAO_SERVICOS: s.items.map((i) => i.description).join("\n"),
    VALOR_CONTRATADO: money(s.budget.total),
    DATA_INICIO:
      date(t.startDate ?? "") ||
      "Após assinatura, pagamento e recebimento dos dados",
    NUMERO_REVISOES: t.revisions ?? "A definir entre as partes",
    CLAUSULA_PARCERIA_PUBLICACAO: t.partnershipClause ?? "",
    CHAVE_PIX: t.pixKey || "informada na área privada após a aprovação",
    LINK_PAGAMENTO:
      t.paymentLink || "disponibilizado na área privada após a aprovação",
    CIDADE_FORO: t.forumCity || "A definir entre as partes",
    CIDADE_ASSINATURA: t.signatureCity || s.client.city,
    DATA_ASSINATURA: "data registrada na assinatura eletrônica",
    TESTEMUNHA_1: "",
    TESTEMUNHA_2: "",
    CPF_TESTEMUNHA_1: "",
    CPF_TESTEMUNHA_2: "",
    ID_RECIBO: `REC-${s.reference}`,
    VALOR_PAGO: money(s.budget.total),
    VALOR_POR_EXTENSO: t.amountWords ?? "valor indicado numericamente acima",
    NUMERO_PARCELAS: t.installments ?? "1",
    PARCELA_ATUAL: "Liquidação integral confirmada",
    DATA_PAGAMENTO: date(t.paymentDate ?? "") || s.created,
    IDENTIFICACAO_TRANSACAO: t.transactionId || "Não informada",
    TOTAL_PAGO: money(s.budget.total),
    SALDO_RESTANTE: money(0),
    TIPO_RECIBO: "Quitação do valor integral confirmado pela HAS Analytics.",
    CIDADE_EMISSAO: "Maringá — PR",
    DATA_EMISSAO: s.created,
  };
}
export function documentLines(s: DocumentSnapshot) {
  return Object.values(templateValues(s));
}
export async function renderCommercial(s: DocumentSnapshot) {
  const extras = [
    s.kind === "contrato" && s.body
      ? `CONDIÇÕES ADICIONAIS ACORDADAS\n${s.body}`
      : "",

    s.kind === "contrato" && s.budget.notes
      ? `Observações da proposta: ${s.budget.notes}`
      : "",

    s.kind === "orcamento"
      ? "ACEITE DO CLIENTE\n\n" +
        "Nome: " +
        s.client.legal_name +
        "\nCPF/CNPJ: " +
        s.client.tax_id +
        "\n\n\n" +
        "Assinatura: ______________________________________________"
      : "",

    `Versão ${s.reference} | Emitido em ${s.created}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { word, templateHash } = await fillHasTemplate(
    s.kind,
    templateValues(s),
    extras,
  );

  return {
    word,
    pdf: await hasTemplatePdf(word, s.kind),
    templateHash,
  };
}
