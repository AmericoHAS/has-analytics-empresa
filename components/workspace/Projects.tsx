"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  projectColumns,
  stages,
  statusLabels,
  type AnalysisProject,
  type Task,
  type PrivateProject,
} from "@/lib/workspace/types";
import Deadline from "./Deadline";
export default function Projects({
  clientId,
  projects,
  admin = false,
  onChange,
}: {
  clientId: string;
  projects: AnalysisProject[];
  admin?: boolean;
  onChange: () => void;
}) {
  const [edit, setEdit] = useState<AnalysisProject | null | undefined>(
      undefined,
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    const start = String(f.get("start_date") || ""),
      due = String(f.get("due_date") || "");
    if (start && due && due < start) {
      setMessage("A entrega deve ser igual ou posterior ao início.");
      setBusy(false);
      return;
    }
    const values = {
      client_id: clientId,
      title: String(f.get("title")).trim(),
      description: f.get("description"),
      start_date: start || null,
      due_date: due || null,
      client_due_date: f.get("client_due_date") || null,
      status: f.get("status"),
      progress: Number(f.get("progress")),
      stage: f.get("stage"),
      deliverables: f.get("deliverables"),
      updated_at: new Date().toISOString(),
    };
    const query = edit
      ? supabase.from("client_projects").update(values).eq("id", edit.id)
      : supabase.from("client_projects").insert(values);
    const { error } = await query.select(projectColumns).single();
    if (error) setMessage(error.message);
    else {
      setEdit(undefined);
      onChange();
    }
    setBusy(false);
  }
  return (
    <div className="stack">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">Da pergunta ao resultado</span>
          <h2>Projetos e análises</h2>
        </div>
        {admin && (
          <button className="btn primary" onClick={() => setEdit(null)}>
            Novo projeto
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      {edit !== undefined && (
        <form
          className="workspace-card stack"
          onSubmit={save}
          key={edit?.id ?? "new"}
        >
          <div className="row">
            <h3>{edit ? "Editar projeto" : "Nova análise"}</h3>
            <button
              className="btn"
              type="button"
              onClick={() => setEdit(undefined)}
            >
              Cancelar
            </button>
          </div>
          <label>
            Título
            <input
              name="title"
              required
              maxLength={300}
              defaultValue={edit?.title ?? ""}
            />
          </label>
          <label>
            Objetivo e escopo visíveis ao cliente
            <textarea
              name="description"
              defaultValue={edit?.description ?? ""}
            />
          </label>
          <div className="form-grid">
            <label>
              Status
              <select name="status" defaultValue={edit?.status ?? "solicitado"}>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
                {edit && !statusLabels[edit.status] && (
                  <option>{edit.status}</option>
                )}
              </select>
            </label>
            <label>
              Etapa
              <select name="stage" defaultValue={edit?.stage ?? stages[0]}>
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Progresso da análise (%)
              <input
                name="progress"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={edit?.progress ?? 0}
              />
            </label>
            {["start_date", "due_date", "client_due_date"].map((k, i) => (
              <label key={k}>
                {
                  [
                    "Início",
                    "Entrega da análise",
                    "Prazo do cliente para enviar dados",
                  ][i]
                }
                <input
                  name={k}
                  type="date"
                  defaultValue={edit?.[k as "start_date"] ?? ""}
                />
              </label>
            ))}
          </div>
          <label>
            Entregáveis previstos
            <textarea
              name="deliverables"
              defaultValue={
                edit?.deliverables ??
                "Banco organizado; relatório estatístico; tabelas e gráficos; arquivos de resultados."
              }
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar projeto"}
          </button>
        </form>
      )}
      {!projects.length && (
        <div className="empty-state">
          Nenhuma análise cadastrada para este cliente.
        </div>
      )}
      {projects.map((p) => (
        <article className="workspace-card project-card" key={p.id}>
          <div className="row">
            <div>
              <span className="tag">{statusLabels[p.status] ?? p.status}</span>
              <h3>{p.title}</h3>
            </div>
            {admin && (
              <button className="btn" onClick={() => setEdit(p)}>
                Editar
              </button>
            )}
          </div>
          <p className="preserve muted">{p.description}</p>
          <div className="stage-track">
            {stages.map((s, i) => (
              <span
                key={s}
                className={i <= stages.indexOf(p.stage) ? "reached" : ""}
              >
                <b>{i + 1}</b>
                {s}
              </span>
            ))}
          </div>
          <div className="row">
            <strong>Progresso da análise</strong>
            <strong>{p.progress}%</strong>
          </div>
          <progress
            max={100}
            value={p.progress}
            aria-label="Progresso da análise"
          />
          <div className="form-grid">
            <Deadline start={p.start_date} due={p.due_date} status={p.status} />
            <Deadline
              start={p.start_date}
              due={p.client_due_date}
              status={p.status}
              label="Envio de dados pelo cliente"
            />
          </div>
          <p>
            <strong>Entregáveis</strong>
          </p>
          <p className="preserve">
            {p.deliverables || "A definir após avaliação do escopo."}
          </p>
          <ProjectDetails project={p} admin={admin} />
        </article>
      ))}
    </div>
  );
}
function ProjectDetails({
  project,
  admin,
}: {
  project: AnalysisProject;
  admin: boolean;
}) {
  const [open, setOpen] = useState(false),
    [tasks, setTasks] = useState<Task[]>([]),
    [notes, setNotes] = useState<PrivateProject | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("project_id", project.id)
      .order("display_order");
    if (error) setMessage("Erro ao carregar checklist.");
    else setTasks(data ?? []);
    if (admin) {
      const { data, error } = await supabase
        .from("project_private")
        .select("*")
        .eq("project_id", project.id)
        .maybeSingle();
      if (error) setMessage("Erro ao carregar dados internos.");
      else setNotes(data);
    }
    setBusy(false);
  }
  return (
    <details
      onToggle={(e) => {
        const o = e.currentTarget.open;
        setOpen(o);
        if (o) void load();
      }}
    >
      <summary>
        Checklist {admin ? "e informações administrativas" : ""}
      </summary>
      {open && (
        <div className="stack">
          <p className="muted">
            {tasks.filter((t) => t.done).length} de {tasks.length} atividades
            concluídas
          </p>
          {tasks.map((t) => (
            <label key={t.id} className="check">
              <input
                type="checkbox"
                disabled={!admin || busy}
                checked={t.done}
                onChange={async (e) => {
                  setBusy(true);
                  const { error } = await supabase
                    .from("project_tasks")
                    .update({ done: e.target.checked })
                    .eq("id", t.id);
                  if (error) setMessage("Não foi possível atualizar.");
                  await load();
                }}
              />
              {t.title}
              {admin && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm("Remover esta atividade?")) return;
                    const { error } = await supabase
                      .from("project_tasks")
                      .delete()
                      .eq("id", t.id);
                    if (error) setMessage(error.message);
                    await load();
                  }}
                >
                  Remover
                </button>
              )}
            </label>
          ))}
          {admin && (
            <>
              <form
                className="row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const title = String(
                    new FormData(form).get("task") || "",
                  ).trim();
                  if (!title) return;
                  setBusy(true);
                  const { error } = await supabase
                    .from("project_tasks")
                    .insert({
                      project_id: project.id,
                      title,
                      display_order: tasks.length,
                    });
                  if (error) setMessage(error.message);
                  else form.reset();
                  await load();
                }}
              >
                <input
                  aria-label="Nova atividade"
                  name="task"
                  required
                  maxLength={300}
                  placeholder="Nova atividade do checklist"
                />
                <button className="btn" disabled={busy}>
                  Adicionar
                </button>
              </form>
              <form
                className="stack private-panel"
                key={notes?.project_id ?? "empty"}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const f = new FormData(e.currentTarget);
                  const { error } = await supabase
                    .from("project_private")
                    .upsert({
                      project_id: project.id,
                      ...Object.fromEntries(f),
                      estimated_hours: Number(f.get("estimated_hours")),
                    });
                  setMessage(
                    error
                      ? "Não foi possível salvar as informações internas."
                      : "Informações internas salvas.",
                  );
                  setBusy(false);
                }}
              >
                <h4>Informações internas · somente admin</h4>
                <div className="form-grid">
                  {(
                    [
                      "department",
                      "research_area",
                      "data_assessment",
                      "complexity",
                      "responsible",
                      "estimated_hours",
                    ] as const
                  ).map((k, i) => (
                    <label key={k}>
                      {
                        [
                          "Departamento",
                          "Área da pesquisa",
                          "Avaliação do banco",
                          "Complexidade",
                          "Responsável",
                          "Horas estimadas",
                        ][i]
                      }
                      <input
                        name={k}
                        type={k === "estimated_hours" ? "number" : "text"}
                        min="0"
                        step="0.25"
                        defaultValue={
                          notes?.[k] ?? (k === "estimated_hours" ? 0 : "")
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Notas administrativas
                  <textarea
                    name="admin_notes"
                    defaultValue={notes?.admin_notes ?? ""}
                  />
                </label>
                <button className="btn" disabled={busy}>
                  Salvar dados internos
                </button>
              </form>
            </>
          )}
          <p role="status">{message}</p>
        </div>
      )}
    </details>
  );
}
