"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AnalysisProject } from "@/lib/workspace/types";
import { useLifecycle } from "./useLifecycle";
import Consultations from "./Consultations";
import Deadline from "./Deadline";
import Documents from "./Documents";
type Revision = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};
export default function ProjectLifecycle({
  project,
  admin,
}: {
  project: AnalysisProject;
  admin: boolean;
}) {
  const state = useLifecycle(project.client_id, project.id)[0];
  const [revisions, setRevisions] = useState<Revision[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    void supabase
      .from("project_revisions")
      .select("id,title,description,enabled")
      .eq("project_id", project.id)
      .order("created_at")
      .then(({ data }) => setRevisions(data ?? []));
  }, [project.id]);
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
          status={project.status}
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
      {(admin || (state?.facts.results && !revisions.length)) && (
        <details className="consultation-section">
          <summary>Consultoria e agenda</summary>
          <Consultations
            clientId={project.client_id}
            projects={[project]}
            admin={admin}
          />
        </details>
      )}
      {admin && (
        <details>
          <summary>Abrir nova revisão para o cliente</summary>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const { data, error } = await supabase
                .from("project_revisions")
                .insert({
                  project_id: project.id,
                  title: f.get("title"),
                  description: f.get("description"),
                  enabled: true,
                })
                .select("id,title,description,enabled")
                .single();
              setMessage(
                error ? error.message : "Revisão aberta e aviso registrado.",
              );
              if (data) setRevisions([...revisions, data]);
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
            <button className="btn">Abrir revisão e avisar cliente</button>
          </form>
          <p role="status">{message}</p>
        </details>
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
          <Consultations
            clientId={project.client_id}
            projects={[project]}
            admin={admin}
            revisionId={r.id}
          />
        </details>
      ))}
    </div>
  );
}
