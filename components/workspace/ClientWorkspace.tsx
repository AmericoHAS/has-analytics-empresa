"use client";
import {
  CalendarDays,
  FileCheck,
  Banknote,
  Upload,
  Bell,
  UserRound,
} from "lucide-react";
import Payments from "./Payments";
import ClientProfile from "./ClientProfile";
import CommercialDocuments from "./CommercialDocuments";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { projectColumns, type AnalysisProject } from "@/lib/workspace/types";
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
  const [selectedProject, setSelectedProject] = useState<string | null | undefined>(undefined);
  const selected = projects.find(p => p.id === selectedProject);
  const scopedProjects = selected ? [selected] : selectedProject === null ? projects : [];
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
    const refresh = () => void load();
    window.addEventListener("has-workflow-updated", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("has-workflow-updated", refresh);
    };
  }, [load, clientId]);
  return (
    <div className="stack">
      {admin && tab === "cadastro" && (
        <ClientProfile clientId={clientId} admin expanded />
      )}
      {selectedProject !== undefined && <div className="workspace-card row"><div><small>Projeto selecionado</small><h2>{selected?.title ?? "Registros sem projeto"}</h2></div><button className="btn" onClick={() => { setSelectedProject(undefined); setTab("projetos"); }}>Voltar aos projetos</button></div>}
      <nav className="workspace-tabs" aria-label="Seções do cliente">
        {[
          ["projetos", "Projetos e prazos"],
          ["orcamentos", "Orçamentos e aprovações"],
          ["contratos", "Contratos e pagamento"],
          ["documentos", "Dados e arquivos"],
          ...(admin ? [["cadastro", "Cadastro do cliente"]] : []),
          ["avisos", "Avisos"],
        ].map(([k, label]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            aria-current={tab === k ? "page" : undefined}
            onClick={() => setTab(k)}
          >
            {k === "projetos" ? (
              <CalendarDays size={18} />
            ) : k === "orcamentos" ? (
              <FileCheck size={18} />
            ) : k === "contratos" ? (
              <Banknote size={18} />
            ) : k === "documentos" ? (
              <Upload size={18} />
            ) : k === "avisos" ? (
              <Bell size={18} />
            ) : (
              <UserRound size={18} />
            )}{" "}
            {label}
          </button>
        ))}
      </nav>
      {message && <p role="alert">{message}</p>}
      {loading ? (
        <p>Carregando seu espaço…</p>
      ) : (
        <>
          {selectedProject === undefined && !["avisos", "cadastro"].includes(tab) && <><p>Abra um projeto para acompanhar suas etapas, orçamentos, contratos, pagamentos e arquivos.</p><Projects clientId={clientId} projects={projects} admin={admin} onChange={load} onOpen={setSelectedProject} /><button className="btn" onClick={() => { setSelectedProject(null); setTab("orcamentos"); }}>Registros antigos sem projeto</button></>}
          <div key={selectedProject ?? "unlinked"}>
          {selectedProject != null && tab === "projetos" && (
            <Projects
              clientId={clientId}
              projects={scopedProjects}
              focused
              admin={admin}
              onChange={load}
            />
          )}{" "}
          {selectedProject !== undefined && tab === "documentos" && (
            <Documents clientId={clientId} projectId={selectedProject} projects={scopedProjects} admin={admin} />
          )}{" "}
          {selectedProject !== undefined && tab === "orcamentos" && (
            <ClientBudgetManager
              clientId={clientId}
              projectId={selectedProject}
              projects={scopedProjects}
              readOnly={!admin}
            />
          )}{" "}
          {selectedProject !== undefined && tab === "pagamentos" && (
            <Payments clientId={clientId} projectId={selectedProject} admin={admin} />
          )}
          {selectedProject !== undefined && tab === "contratos" && (
            <>
              <CommercialDocuments
                clientId={clientId}
                admin={admin}
                kind="contrato"
                projectId={selectedProject}
              />
              <Payments clientId={clientId} projectId={selectedProject} admin={admin} />
            </>
          )}
          </div>
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
