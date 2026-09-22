"use client";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { actionError } from "@/lib/workspace/action-errors";
import { supabase } from "@/lib/supabase";
import type { AnalysisProject } from "@/lib/workspace/types";
import { useLifecycle } from "./useLifecycle";
import { CalendarDays, ListChecks, FilePenLine } from "lucide-react";
import Consultations from "./Consultations";
import Deadline from "./Deadline";
import Documents from "./Documents";
type Revision = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  analysis_completed_at: string | null;
  completed_at: string | null;
};
export default function ProjectLifecycle({
  project,
  admin,
  administrativePanel,
}: {
  project: AnalysisProject;
  admin: boolean;
  administrativePanel?: ReactNode;
}) {
  const [panel, setPanel] = useState<string | null>(null);
  const state = useLifecycle(project.client_id, project.id)[0];
  const [revisions, setRevisions] = useState<Revision[]>([]),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("project_revisions")
      .select("id,title,description,enabled,analysis_completed_at,completed_at")
      .eq("project_id", project.id)
      .order("created_at");
    if (error) setMessage(actionError(error, "carregar revisões"));
    else setRevisions(data ?? []);
  }, [project.id]);
  useEffect(() => {
    const refresh = () => void load();
    const initial = setTimeout(refresh, 0);
    window.addEventListener("has-workflow-updated", refresh);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("has-workflow-updated", refresh);
    };
  }, [load]);
  async function action(name: string, revision?: string) {
    if (busy) return;
    if (
      name === "complete_project_analysis" &&
      !confirm(
        "Confirmar que os resultados desta análise estão finais e liberar a consultoria ao cliente?",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc(name, {
        p_project: project.id,
        ...(name === "complete_project_analysis"
          ? { p_revision: revision ?? null }
          : {}),
      });
      if (error) throw Error(actionError(error, "atualizar o projeto"));
      setMessage(
        name === "complete_project_analysis"
          ? "Análise concluída. Consultoria liberada e aviso registrado na fila de e-mail."
          : "Projeto atualizado.",
      );
      window.dispatchEvent(new Event("has-workflow-updated"));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Falha de conexão. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="lifecycle-progress">
        <div className="row">
          <strong>{state?.state.label ?? project.stage}</strong>
          <b>{state?.state.progress ?? project.progress}%</b>
        </div>
        <progress
          value={state?.state.progress ?? project.progress}
          max={100}
          aria-label="Progresso do atendimento"
        />
        <div className="lifecycle-labels">
          <span>Proposta</span>
          <span>Contrato e dados</span>
          <span>Análise</span>
          <span>Consultoria</span>
        </div>
      </div>
      <div className="form-grid">
        <Deadline
          start={project.start_date}
          due={project.due_date}
          status={
            project.archived_at
              ? "cancelado"
              : state?.facts.analysisCompleted
                ? "concluido"
                : project.status
          }
        />
        {!state?.facts.dataReceived && (
          <Deadline
            start={project.start_date}
            due={project.client_due_date}
            status={project.status}
            label="Envio de dados pelo cliente"
          />
        )}
      </div>
      {message && (
        <p className="action-feedback" role="status">
          {message}
        </p>
      )}
      {admin && !project.archived_at && project.status !== "concluido" && (
        <div className="project-action-row">
          {!project.analysis_completed_at &&
            state?.facts.paymentConfirmed &&
            state?.facts.dataReceived &&
            project.status !== "em_andamento" && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void action("start_project_analysis")}
              >
                Iniciar análise com dados recebidos
              </button>
            )}
          {!project.analysis_completed_at &&
            ["em_andamento", "em_revisao"].includes(project.status) && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void action("complete_project_analysis")}
              >
                {busy
                  ? "Atualizando…"
                  : "Concluir análise e liberar consultoria"}
              </button>
            )}
          {project.analysis_completed_at && state?.facts.meetingDone && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void action("close_analysis_project")}
            >
              Encerrar projeto após revisões e recibo
            </button>
          )}
        </div>
      )}
      <div className="project-action-row">
        {(admin || project.analysis_completed_at) && (
          <button
            className="btn"
            aria-expanded={panel === "agenda"}
            onClick={() => setPanel(panel === "agenda" ? null : "agenda")}
          >
            <CalendarDays size={18} />
            Consultoria e agenda
          </button>
        )}
        {admin && (
          <>
            <button
              className="btn"
              disabled={
                busy || !project.analysis_completed_at || !!project.archived_at
              }
              aria-expanded={panel === "revision"}
              onClick={() => setPanel(panel === "revision" ? null : "revision")}
            >
              <FilePenLine size={18} />
              Abrir nova revisão para o cliente
            </button>
            <button
              className="btn"
              aria-expanded={panel === "checklist"}
              onClick={() =>
                setPanel(panel === "checklist" ? null : "checklist")
              }
            >
              <ListChecks size={18} />
              Checklist e informações administrativas
            </button>
          </>
        )}
      </div>
      {admin && panel === "checklist" && (
        <div className="project-action-panel">{administrativePanel}</div>
      )}
      {panel === "agenda" && (
        <div className="project-action-panel">
          <Consultations
            clientId={project.client_id}
            projects={[project]}
            admin={admin}
          />
        </div>
      )}
      {admin && panel === "revision" && (
        <div className="project-action-panel">
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                const { data, error } = await supabase
                  .from("project_revisions")
                  .insert({
                    project_id: project.id,
                    title: f.get("title"),
                    description: f.get("description"),
                    enabled: true,
                  })
                  .select(
                    "id,title,description,enabled,analysis_completed_at,completed_at",
                  )
                  .single();
                setMessage(
                  error ? error.message : "Revisão aberta e aviso registrado.",
                );
                if (data) {
                  setRevisions([...revisions, data]);
                  setPanel(null);
                  window.dispatchEvent(new Event("has-workflow-updated"));
                }
              } catch {
                setMessage(
                  "Falha de conexão. Tente abrir a revisão novamente.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Título
              <input name="title" required minLength={3} maxLength={200} />
            </label>
            <label>
              Orientações
              <textarea name="description" maxLength={4000} />
            </label>
            <button className="btn" disabled={busy}>
              {busy ? "Salvando…" : "Abrir revisão e avisar cliente"}
            </button>
          </form>
          <p role="status">{message}</p>
        </div>
      )}
      {revisions.map((r) => (
        <details key={r.id} className="workspace-card">
          <summary>{r.title}</summary>
          <p>{r.description}</p>
          <Documents
            clientId={project.client_id}
            projects={[project]}
            admin={admin}
            revisionId={r.id}
          />
          {admin && !r.analysis_completed_at && !project.archived_at && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void action("complete_project_analysis", r.id)}
            >
              Concluir revisão e liberar consultoria
            </button>
          )}
          {(admin || r.analysis_completed_at) && (
            <Consultations
              clientId={project.client_id}
              projects={[project]}
              admin={admin}
              revisionId={r.id}
            />
          )}
          {!admin && !r.analysis_completed_at && (
            <p className="workflow-notice">
              A revisão está com a HAS. Você receberá um aviso quando a
              consultoria for liberada.
            </p>
          )}
        </details>
      ))}
    </div>
  );
}
