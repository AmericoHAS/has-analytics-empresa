"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  generateCommercialDocument,
  commercialDownload,
  publishCommercial,
} from "@/app/admin/commercial-actions";
export default function Receipts({
  budgetId,
  admin,
}: {
  budgetId: string;
  admin: boolean;
}) {
  const [docs, setDocs] = useState<
      { id: string; status: string; created_at: string }[]
    >([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    void supabase
      .from("commercial_documents")
      .select("id,status,created_at")
      .eq("budget_id", budgetId)
      .eq("kind", "recibo")
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocs(data ?? []));
  }, [budgetId, version]);
  async function download(id: string, format: "pdf" | "word") {
    try {
      const a = document.createElement("a");
      a.href = await commercialDownload(id, format);
      a.click();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Arquivo indisponível.");
    }
  }
  return (
    <details>
      <summary>Recibo de pagamento</summary>
      {admin && (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const f = new FormData(e.currentTarget);
              f.set("kind", "recibo");
              f.set("budgetId", budgetId);
              f.set("title", "Recibo de pagamento");
              f.set("body", "");
              const r = await generateCommercialDocument(f);
              setMessage(r.message);
              if (r.success) setVersion((v) => v + 1);
            } catch {
              setMessage("Não foi possível gerar o recibo.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Valor recebido por extenso
            <input name="amountWords" required maxLength={500} />
          </label>
          <label>
            Identificação da transação
            <input name="transactionId" maxLength={200} />
          </label>
          <button className="btn" disabled={busy}>
            Gerar recibo pelo modelo HAS
          </button>
        </form>
      )}
      <p role="status">{message}</p>
      {docs.map((d) => (
        <div className="row" key={d.id}>
          <span>
            {new Date(d.created_at).toLocaleDateString("pt-BR")} ·{" "}
            {d.status === "rascunho" ? "Conferência pendente" : "Disponível"}
          </span>
          <button className="btn" onClick={() => void download(d.id, "pdf")}>
            PDF
          </button>
          {admin && (
            <button className="btn" onClick={() => void download(d.id, "word")}>
              Word
            </button>
          )}
          {admin && d.status === "rascunho" && (
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm("Conferiu o recibo, o valor e a quitação integral?")
                )
                  return;
                setBusy(true);
                try {
                  const r = await publishCommercial(d.id, true);
                  setMessage(r.message);
                  setVersion((v) => v + 1);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Disponibilizar ao cliente
            </button>
          )}
        </div>
      ))}
    </details>
  );
}
