"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { paymentAction } from "@/app/admin/payment-actions";
export default function PaymentCorrection({
  clientId,
  paymentId,
  onChange,
}: {
  clientId: string;
  paymentId: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const file = new FormData(e.currentTarget).get("receipt") as File;
        let path = "";
        setBusy(true);
        try {
          const ext = file?.name.split(".").pop()?.toLowerCase();
          if (
            !ext ||
            !["pdf", "png", "jpg", "jpeg"].includes(ext) ||
            file.size === 0 ||
            file.size > 10485760
          )
            throw Error("Envie PDF, PNG ou JPG de até 10 MB.");
          path = `${clientId}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("payment-receipts")
            .upload(path, file);
          if (error) throw Error("Falha no envio.");
          const r = await paymentAction("receipt", paymentId, { path });
          if (!r.success) throw Error(r.message);
          path = "";
          setMessage("Comprovante corrigido enviado para conferência.");
          onChange();
        } catch (e) {
          if (path)
            await supabase.storage.from("payment-receipts").remove([path]);
          setMessage(e instanceof Error ? e.message : "Falha no envio.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Reenviar comprovante corrigido
        <input
          required
          type="file"
          name="receipt"
          accept=".pdf,.png,.jpg,.jpeg"
        />
      </label>
      <button className="btn" disabled={busy}>
        Enviar correção
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
