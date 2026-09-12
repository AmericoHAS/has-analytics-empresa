"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientWorkspace from "@/components/workspace/ClientWorkspace";
export default function ClientOverview({
  initialTab = "projetos",
  initialClientId = "",
}: {
  initialTab?: string;
  initialClientId?: string;
}) {
  const [clients, setClients] = useState<
      { id: string; full_name: string; phone: string | null }[]
    >([]),
    [selected, setSelected] = useState(initialClientId),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,full_name,phone")
      .eq("role", "client")
      .order("full_name")
      .then(({ data, error }) => {
        if (error) setMessage("Não foi possível carregar clientes.");
        else setClients(data ?? []);
      });
  }, [refresh]);
  return (
    <div className="stack">
      <label>
        Selecione o cliente
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Escolha um cliente para abrir a ficha…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{message}</p>
      <button className="btn" onClick={() => setRefresh((v) => v + 1)}>
        Atualizar lista de clientes
      </button>
      {selected ? (
        <ClientWorkspace
          key={selected}
          clientId={selected}
          initialTab={initialTab}
          admin
        />
      ) : (
        <div className="empty-state">
          Projetos, propostas, arquivos e prazos organizados por cliente.
        </div>
      )}
    </div>
  );
}
