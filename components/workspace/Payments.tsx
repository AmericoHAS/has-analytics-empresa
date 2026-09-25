"use client";
import PaymentCorrection from "./PaymentCorrection";
import Receipts from "./Receipts";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { paymentAction, receiptDownload } from "@/app/admin/payment-actions";
import { money } from "@/lib/commercial/model";
type Payment = {
  id: string;
  budget_id: string;
  amount: number;
  status: string;
  option: {
    label: string;
    installments: number;
    installment: number;
    lastInstallment: number;
  };
  instructions: string;
  payment_url: string;
  receipt_path: string | null;
  document_id: string;
};
const labels: Record<string, string> = {
  assinatura: "Aprovação e assinatura pendentes",
  solicitado: "HAS preparando a cobrança",
  aguardando_pagamento: "Aguardando pagamento",
  em_conferencia: "Comprovante em conferência",
  confirmado: "Pagamento confirmado",
  rejeitado: "Revisar comprovante",
};
export default function Payments({
  clientId,
  projectId,
  admin = false,
}: {
  clientId: string;
  projectId?: string | null;
  admin?: boolean;
}) {
  const [rows, setRows] = useState<Payment[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [defaults, setDefaults] = useState("");
  const load = useCallback(async () => {
    let ids: string[] | undefined;
    if (projectId !== undefined) {
      let query = supabase.from("client_budgets").select("id").eq("client_id", clientId);
      query = projectId === null ? query.is("project_id", null) : query.eq("project_id", projectId);
      const result = await query;
      if (result.error) { setMessage("Não foi possível carregar os pagamentos deste projeto."); return; }
      ids = (result.data ?? []).map(b => b.id);
    }
    const { data, error } = await supabase
      .from("budget_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });
    if (error)
      setMessage(
        "Atualize o banco com ATUALIZAR-FLUXO-PAGAMENTO.sql para habilitar pagamentos.",
      );
    else setRows((data ?? []).filter(p => ids === undefined || ids.includes(p.budget_id)));
  }, [clientId, projectId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 15000);
    window.addEventListener("has-workflow-updated", load);
    if (admin)
      supabase
        .from("payment_settings")
        .select("pix_key,instructions")
        .eq("id", 1)
        .single()
        .then(({ data }) => {
          if (data)
            setDefaults(
              [
                data.pix_key ? `Chave Pix: ${data.pix_key}` : "",
                data.instructions,
              ]
                .filter(Boolean)
                .join("\n"),
            );
        });
    return () => {
      clearTimeout(t);
      clearInterval(timer);
      window.removeEventListener("has-workflow-updated", load);
    };
  }, [load, admin]);
  async function run(
    action: string,
    id: string,
    fields: Record<string, string> = {},
  ) {
    setBusy(true);
    try {
      const r = await paymentAction(action, id, fields);
      setMessage(r.message);
      if (r.success) await load();
    } catch {
      setMessage("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack">
      <div>
        <span className="eyebrow">Etapa financeira</span>
        <h2>Pagamento e liberação</h2>
        <p>
          Escolha a forma no orçamento, aprove e devolva o PDF assinado. Após a
          conferência da assinatura, a HAS enviará o contrato com as instruções
          para pagar.
        </p>
      </div>
      {message && (
        <p className="workflow-notice" role="status">
          {message}
        </p>
      )}
      {!rows.length && (
        <div className="empty-state">
          A forma de pagamento ainda não foi escolhida no orçamento.
        </div>
      )}
      {rows.map((p) => (
        <article className="workspace-card stack" key={p.id}>
          <div className="row">
            <h3>{p.option.label}</h3>
            <span className={`tag payment-status-${p.status}`}>
              {labels[p.status]}
            </span>
          </div>
          <strong className="amount">{money(Number(p.amount))}</strong>
          {p.option.installments > 1 && (
            <p>
              {p.option.installments - 1} parcela(s) de{" "}
              {money(p.option.installment)} + última de{" "}
              {money(p.option.lastInstallment)}
            </p>
          )}
          {!admin && p.status === "assinatura" && (
            <p className="muted">
              Após a conferência do orçamento assinado, a HAS enviará o contrato
              e as instruções de pagamento.
            </p>
          )}
          {p.instructions && (
            <div className="workflow-notice preserve">{p.instructions}</div>
          )}
          {p.payment_url.startsWith("https://") && (
            <a
              className="btn primary"
              href={p.payment_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir link de pagamento ↗
            </a>
          )}
          {admin &&
            ["solicitado", "aguardando_pagamento", "rejeitado"].includes(
              p.status,
            ) && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run("instructions", p.id, {
                    instructions: String(f.get("instructions")),
                    url: String(f.get("url")),
                  });
                }}
              >
                <label>
                  Instruções para o cliente
                  <textarea
                    name="instructions"
                    required
                    defaultValue={
                      p.instructions ||
                      (p.option.label.toLowerCase().includes("pix")
                        ? defaults
                        : "")
                    }
                  />
                </label>
                <label>
                  Link HTTPS da cobrança no Mercado Pago (opcional)
                  <input
                    name="url"
                    type="url"
                    pattern="https://.*"
                    defaultValue={p.payment_url}
                  />
                </label>
                <small>
                  Crie a cobrança no Mercado Pago pelo valor acima. O site não
                  processa cartões nem armazena dados do cartão.
                </small>
                <button className="btn primary" disabled={busy}>
                  Disponibilizar instruções de pagamento
                </button>
              </form>
            )}
          {!admin && p.status === "aguardando_pagamento" && (
            <p className="workflow-notice">
              Envie o comprovante junto com o contrato assinado no formulário do
              contrato acima.
            </p>
          )}
          {!admin && p.status === "rejeitado" && (
            <PaymentCorrection
              clientId={clientId}
              paymentId={p.id}
              onChange={load}
            />
          )}
          {p.receipt_path && (
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                try {
                  const a = document.createElement("a");
                  a.href = await receiptDownload(p.id);
                  a.click();
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "Arquivo indisponível.",
                  );
                }
              }}
            >
              Baixar comprovante
            </button>
          )}
          {admin && p.status === "em_conferencia" && (
            <form
              className="workflow-notice stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run("confirm", p.id);
              }}
            >
              <label className="check">
                <input type="checkbox" required />
                Conferi o recebimento do valor no banco ou operadora.
              </label>
              <div className="row">
                <button className="btn primary" disabled={busy}>
                  Confirmar recebimento e liberar análise
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => run("reject", p.id)}
                >
                  Solicitar correção do comprovante
                </button>
              </div>
            </form>
          )}
          {p.status === "confirmado" && (
            <Receipts budgetId={p.budget_id} admin={admin} />
          )}
          {p.status === "confirmado" && (
            <p className="workflow-notice success">
              Pagamento confirmado. Com os dados completos, a HAS poderá iniciar
              a análise.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
