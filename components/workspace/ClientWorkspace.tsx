"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { projectColumns, type AnalysisProject } from "@/lib/workspace/types";
import { deadline } from "@/lib/workspace/deadlines";
import Projects from "./Projects";
import Documents from "./Documents";
import Notifications from "./Notifications";
import ClientBudgetManager from "@/components/admin/ClientBudgetManager";
export default function ClientWorkspace({
  clientId,
  admin = false,
  initialTab = "projetos",
}: {
  clientId: string;
  admin?: boolean;
  initialTab?: string;
}) {
  const [projects, setProjects] = useState<AnalysisProject[]>([]),
    [tab, setTab] = useState(initialTab),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_projects")
      .select(projectColumns)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error)
      setMessage(
        "Não foi possível carregar as análises. Confira a conexão e a migração do banco.",
      );
    else {
      setProjects(data ?? []);
      setMessage("");
    }
    setLoading(false);
  }, [clientId]);
  useEffect(() => {
    supabase
      .from("client_projects")
      .select(projectColumns)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error)
          setMessage(
            "Não foi possível carregar as análises. Confira a migração.",
          );
        else setProjects(data ?? []);
        setLoading(false);
      });
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, [load, clientId]);
  return (
    <div className="stack">
      <div className="summary">
        <article>
          <small>ANÁLISES EM CURSO</small>
          <strong>
            {
              projects.filter(
                (p) => !["concluido", "cancelado"].includes(p.status),
              ).length
            }
          </strong>
          <span>Projetos em acompanhamento</span>
        </article>
        <article>
          <small>ENTREGAS CONCLUÍDAS</small>
          <strong>
            {projects.filter((p) => p.status === "concluido").length}
          </strong>
          <span>Conhecimento pronto para avançar</span>
        </article>
        <article>
          <small>ATENÇÃO AOS PRAZOS</small>
          <strong>
            {
              projects.filter((p) =>
                [
                  deadline(p.due_date, p.start_date, p.status),
                  deadline(p.client_due_date, p.start_date, p.status),
                ].some((d) => ["danger", "warning"].includes(d.tone)),
              ).length
            }
          </strong>
          <span>Próximos três dias ou em atraso</span>
        </article>
      </div>
      <nav className="workspace-tabs" aria-label="Seções do cliente">
        {[
          ["projetos", "Projetos e prazos"],
          ["documentos", "Documentos"],
          ["orcamentos", "Orçamentos"],
          ["avisos", "Avisos"],
        ].map(([k, label]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            aria-current={tab === k ? "page" : undefined}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </nav>
      {message && <p role="alert">{message}</p>}
      {loading ? (
        <p>Carregando seu espaço…</p>
      ) : (
        <>
          {tab === "projetos" && (
            <Projects
              clientId={clientId}
              projects={projects}
              admin={admin}
              onChange={load}
            />
          )}{" "}
          {tab === "documentos" && (
            <Documents clientId={clientId} projects={projects} admin={admin} />
          )}{" "}
          {tab === "orcamentos" && (
            <ClientBudgetManager
              clientId={clientId}
              projects={projects}
              readOnly={!admin}
            />
          )}{" "}
          {tab === "avisos" && (
            <Notifications
              clientId={admin ? clientId : undefined}
              admin={admin}
            />
          )}
        </>
      )}
    </div>
  );
}
