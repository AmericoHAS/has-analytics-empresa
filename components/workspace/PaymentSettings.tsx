"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  defaultPaymentOptions,
  type PaymentOption,
  quotePayment,
} from "@/lib/commercial/payments";
import { savePaymentSettings } from "@/app/admin/payment-actions";
import { money } from "@/lib/commercial/model";
export default function PaymentSettings() {
  const [options, setOptions] = useState(defaultPaymentOptions),
    [pix, setPix] = useState(""),
    [instructions, setInstructions] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    supabase
      .from("payment_settings")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error)
          setMessage(
            "Aplique ATUALIZAR-FLUXO-PAGAMENTO.sql para configurar as taxas.",
          );
        else {
          setOptions(
            defaultPaymentOptions.map(
              (o) =>
                (data.options as PaymentOption[]).find((s) => s.id === o.id) ??
                o,
            ),
          );
          setPix(data.pix_key);
          setInstructions(data.instructions);
        }
        setBusy(false);
      });
  }, []);
  return (
    <form
      className="workspace-card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData();
        f.set("options", JSON.stringify(options));
        f.set("pixKey", pix);
        f.set("instructions", instructions);
        try {
          const r = await savePaymentSettings(f);
          setMessage(r.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Pagamento e taxas · Mercado Pago</h2>
      <p>
        Ative somente as parcelas oferecidas pela Mercado Pago e informe a taxa
        total descontada, incluindo antecipação quando houver. O cálculo
        preserva o valor líquido: valor ÷ (1 − taxa/100). Nenhuma cobrança é
        feita automaticamente.
      </p>
      <label>
        Chave Pix
        <input value={pix} onChange={(e) => setPix(e.target.value)} />
      </label>
      <label>
        Instruções padrão
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </label>
      <details open>
        <summary>Formas disponíveis nas novas propostas</summary>
        <div className="payment-settings-grid">
          {options.map((o, i) => (
            <div className="payment-option" key={o.id}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={o.enabled}
                  onChange={(e) =>
                    setOptions(
                      options.map((v, j) =>
                        i === j ? { ...v, enabled: e.target.checked } : v,
                      ),
                    )
                  }
                />
                {o.label}
              </label>
              <label>
                Taxa total da operadora (%)
                <input
                  type="number"
                  min="0"
                  max="49.99"
                  step="0.01"
                  required
                  value={o.feePercent}
                  onChange={(e) =>
                    setOptions(
                      options.map((v, j) =>
                        i === j
                          ? { ...v, feePercent: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <small>
                Exemplo para R$ 1.000 líquidos:{" "}
                {o.feePercent >= 0 && o.feePercent < 50
                  ? money(quotePayment(1000, o).total)
                  : "Revise a taxa"}
              </small>
            </div>
          ))}
        </div>
      </details>
      <button className="btn primary" disabled={busy}>
        Salvar formas de pagamento
      </button>
      {message && (
        <p role="status" className="workflow-notice">
          {message}
        </p>
      )}
    </form>
  );
}
