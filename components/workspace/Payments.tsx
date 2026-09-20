"use client";
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
  admin = false,
}: {
  clientId: string;
  admin?: boolean;
}) {
  const [rows, setRows] = useState<Payment[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [defaults, setDefaults] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("budget_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });
    if (error)
      setMessage(
        "Atualize o banco com ATUALIZAR-FLUXO-PAGAMENTO.sql para habilitar pagamentos.",
      );
    else setRows(data ?? []);
  }, [clientId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
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
    return () => clearTimeout(t);
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
          conferência da assinatura, solicite o pagamento aqui.
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
          {!admin && ["assinatura", "rejeitado"].includes(p.status) && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => run("request", p.id)}
            >
              Solicitar pagamento após assinatura
            </button>
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
          {!admin &&
            ["aguardando_pagamento", "rejeitado"].includes(p.status) && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const file = new FormData(e.currentTarget).get(
                    "receipt",
                  ) as File;
                  let path = "";
                  setBusy(true);
                  try {
                    const ext = file.name.split(".").pop()?.toLowerCase();
                    if (
                      !ext ||
                      !["pdf", "png", "jpg", "jpeg"].includes(ext) ||
                      file.size === 0 ||
                      file.size > 10 * 1024 * 1024
                    )
                      throw Error("Envie PDF, PNG ou JPG de até 10 MB.");
                    path = `${clientId}/${crypto.randomUUID()}.${ext}`;
                    const { error } = await supabase.storage
                      .from("payment-receipts")
                      .upload(path, file, { upsert: false });
                    if (error) throw Error("Falha ao enviar comprovante.");
                    const r = await paymentAction("receipt", p.id, { path });
                    if (!r.success) throw Error(r.message);
                    path = "";
                    setMessage(
                      "Comprovante enviado. Aguarde a conferência do recebimento.",
                    );
                    await load();
                  } catch (e) {
                    if (path)
                      await supabase.storage
                        .from("payment-receipts")
                        .remove([path]);
                    setMessage(
                      e instanceof Error ? e.message : "Falha no envio.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Comprovante de pagamento
                  <input
                    type="file"
                    name="receipt"
                    accept=".pdf,.png,.jpg,.jpeg"
                    required
                  />
                </label>
                <button className="btn primary" disabled={busy}>
                  Enviar comprovante
                </button>
              </form>
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
