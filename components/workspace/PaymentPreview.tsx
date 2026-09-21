"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { quotePayment, type PaymentOption } from "@/lib/commercial/payments";
import { money } from "@/lib/commercial/model";
export default function PaymentPreview({ total }: { total: number }) {
  const [options, setOptions] = useState<PaymentOption[]>([]),
    [message, setMessage] = useState("Carregando condições…");
  useEffect(() => {
    let alive = true;
    void supabase
      .from("payment_settings")
      .select("options")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setMessage(
            "Não foi possível carregar as formas de pagamento. Confira Modelos comerciais.",
          );
          return;
        }
        setOptions(
          (data?.options ?? []).filter((o: PaymentOption) => o.enabled),
        );
        setMessage("");
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="payment-preview">
      <div>
        <span className="eyebrow">Prévia para o cliente</span>
        <h3>Formas de pagamento da proposta</h3>
        <p>
          Ao gerar o documento, cada opção ativa terá um PDF com seu valor
          total. O cliente escolhe a condição, confere o PDF correspondente e
          devolve a proposta assinada.
        </p>
      </div>
      {message ? (
        <p role="status">{message}</p>
      ) : !options.length ? (
        <p role="status">
          Nenhuma opção ativa. Configure ao menos uma forma em Modelos
          comerciais → Pagamentos antes de gerar o PDF.
        </p>
      ) : (
        <div className="payment-preview-options">
          {options.map((o) => {
            try {
              const q = quotePayment(total, o);
              return (
                <article key={o.id}>
                  <span>{o.label}</span>
                  <strong>{money(q.total)}</strong>
                  <small>
                    {q.installments === 1
                      ? "Pagamento único"
                      : `${q.installments - 1} × ${money(q.installment)} + última de ${money(q.lastInstallment)}`}
                  </small>
                  <small>
                    {q.total > total
                      ? `Acréscimo incluído: ${money(q.total - total)}`
                      : "Sem acréscimo"}
                  </small>
                </article>
              );
            } catch {
              return (
                <p key={o.id}>
                  Revise a taxa e o número de parcelas de {o.label} em Modelos
                  comerciais.
                </p>
              );
            }
          })}
        </div>
      )}
      <small>
        As taxas do cartão são definidas por você em Modelos comerciais →
        Pagamentos. Esta prévia não gera cobrança nem envia documentos.
      </small>
    </section>
  );
}
