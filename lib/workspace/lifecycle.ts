export type LifecycleFacts = {
  proposalSent: boolean;
  proposalApproved: boolean;
  proposalSigned: boolean;
  contractSent: boolean;
  contractSigned: boolean;
  paymentSent: boolean;
  paymentConfirmed: boolean;
  dataReceived: boolean;
  results: boolean;
  analysisCompleted?: boolean;
  completed?: boolean;
  revision?: boolean;
  meeting: boolean;
  meetingDone: boolean;
  analysis: boolean;
  manualProgress: number;
};
export function lifecycle(f: LifecycleFacts) {
  if (f.completed)
    return {
      progress: 100,
      label: "Projeto concluído",
      tab: "projetos",
      pending: false,
    };
  if (f.meetingDone)
    return {
      progress: 98,
      label: "Consultoria realizada · finalização com a HAS",
      tab: "projetos",
      pending: false,
    };
  if (f.meeting)
    return {
      progress: 95,
      label: "Consultoria agendada",
      tab: "projetos",
      pending: false,
    };
  if (f.analysisCompleted)
    return {
      progress: 90,
      label: "Agende sua consultoria",
      tab: "projetos",
      pending: true,
    };
  if (f.analysis)
    return {
      progress:
        50 + Math.round(Math.max(0, Math.min(100, f.manualProgress)) * 0.35),
      label: f.revision
        ? "Revisão em andamento · com a HAS"
        : "Análise estatística em andamento · com a HAS",
      tab: "projetos",
      pending: false,
    };
  if (f.contractSigned && f.paymentSent && !f.dataReceived)
    return {
      progress: 40,
      label: "Aguardando envio dos dados",
      tab: "documentos",
      pending: true,
    };
  if (f.paymentConfirmed && f.dataReceived)
    return {
      progress: 50,
      label: "Dados recebidos · início da análise com a HAS",
      tab: "projetos",
      pending: false,
    };
  if (f.contractSigned && f.paymentSent)
    return {
      progress: 45,
      label: "Contrato e pagamento em conferência",
      tab: "contratos",
      pending: false,
    };
  if (f.contractSent)
    return {
      progress: 30,
      label: "Aguardando contrato assinado e comprovante",
      tab: "contratos",
      pending: true,
    };
  if (f.proposalSigned)
    return {
      progress: 25,
      label: "Aguardando preparação do contrato",
      tab: "contratos",
      pending: false,
    };
  if (f.proposalApproved)
    return {
      progress: 20,
      label: "Aguardando assinatura do orçamento",
      tab: "orcamentos",
      pending: true,
    };
  if (f.proposalSent)
    return {
      progress: 10,
      label: "Aguardando aprovação do orçamento",
      tab: "orcamentos",
      pending: true,
    };
  return {
    progress: 5,
    label: "Aguardando orçamento",
    tab: "orcamentos",
    pending: false,
  };
}
