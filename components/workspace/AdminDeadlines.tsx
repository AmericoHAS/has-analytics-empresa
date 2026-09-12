"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { projectColumns, type AnalysisProject } from "@/lib/workspace/types";
import Deadline from "./Deadline";
export default function AdminDeadlines({
  onOpenClient,
}: {
  onOpenClient: (clientId: string) => void;
}) {
  const [rows, setRows] = useState<AnalysisProject[]>([]),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  useEffect(() => {
    supabase
      .from("client_projects")
      .select(projectColumns)
      .not("status", "in", "(concluido,cancelado)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setMessage("Prazos indisponíveis. Confira a migração.");
        else setRows(data ?? []);
        setLoading(false);
      });
  }, []);
  return (
    <div className="stack">
      <div>
        <span className="eyebrow">Agenda de entregas</span>
        <h2>Próximos passos da operação</h2>
        <p className="muted">
          As 20 análises em curso com as primeiras datas de entrega.
        </p>
      </div>
      <p role="status">{message}</p>
      {!loading && !message && rows.length === 0 && (
        <div className="empty-state">
          Nenhuma análise em andamento. Os próximos projetos aparecerão aqui.
        </div>
      )}
      <div className="project-grid">
        {rows.map((p) => (
          <article key={p.id} className="workspace-card">
            <h3>{p.title}</h3>
            <Deadline start={p.start_date} due={p.due_date} status={p.status} />
            <Deadline
              start={p.start_date}
              due={p.client_due_date}
              status={p.status}
              label="Envio pelo cliente"
            />
            <div className="actions">
              <button className="btn" onClick={() => onOpenClient(p.client_id)}>
                Abrir ficha do cliente
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
