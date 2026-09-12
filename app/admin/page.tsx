"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NewClientForm from "@/components/admin/NewClientForm";
import NewProjectForm from "@/components/admin/NewProjectForm";
import ProjectList from "@/components/admin/ProjectList";

import ClientOverview from "@/components/admin/ClientOverview";
import CommercialSettings from "@/components/workspace/CommercialSettings";
import Notifications from "@/components/workspace/Notifications";
import AdminDeadlines from "@/components/workspace/AdminDeadlines";
import SignOut from "@/components/workspace/SignOut";

type PendingComment = {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
};

export default function Admin() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [tab, setTab] = useState("visao");
  const [focusedClient, setFocusedClient] = useState("");

  const [showClientForm, setShowClientForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  const [commentMessage, setCommentMessage] = useState("");
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  const [commentToDelete, setCommentToDelete] = useState<PendingComment | null>(
    null,
  );
  const [clientCount, setClientCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    void (async () => {
      {
        const { data, error } = await supabase
          .from("comments")
          .select("id,author_name,content,created_at")
          .eq("approved", false)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao carregar comentários pendentes:", error);

          return;
        }

        setComments((data ?? []) as PendingComment[]);
      }
      {
        const { count: clients } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "client");

        const { count: projects } = await supabase
          .from("client_projects")
          .select("id", { count: "exact", head: true });

        setClientCount(clients ?? 0);
        setProjectCount(projects ?? 0);
      }
    })();
  }, []);

  async function approveComment(id: string) {
    setModeratingId(id);
    setCommentMessage("");

    const { error } = await supabase
      .from("comments")
      .update({
        approved: true,
      })
      .eq("id", id);

    if (error) {
      setCommentMessage("Não foi possível aprovar o comentário.");

      setModeratingId(null);

      return;
    }

    setComments((current) => current.filter((comment) => comment.id !== id));

    setCommentMessage("Comentário aprovado com sucesso.");

    setModeratingId(null);
  }

  async function confirmDeleteComment() {
    if (!commentToDelete) {
      return;
    }

    setModeratingId(commentToDelete.id);
    setCommentMessage("");

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentToDelete.id);

    if (error) {
      setCommentMessage("Não foi possível excluir o comentário.");

      setModeratingId(null);
      setCommentToDelete(null);

      return;
    }

    setComments((current) =>
      current.filter((comment) => comment.id !== commentToDelete.id),
    );

    setCommentMessage("Comentário excluído com sucesso.");

    setModeratingId(null);
    setCommentToDelete(null);
  }

  function formatCommentDate(date: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  }

  const tabs = [
    "visao",
    "clientes",
    "documentos",
    "projetos",
    "comentarios",
    "mensagens",
    "configuracoes",
  ];

  const labels: Record<string, string> = {
    visao: "Visão geral",
    clientes: "Clientes",
    documentos: "Documentos",
    projetos: "Portfólio",
    comentarios: "Comentários",
    mensagens: "Notificações",
    configuracoes: "Modelos comerciais",
  };

  return (
    <main className="dashboard admin">
      <aside>
        <strong>
          HAS<span>ANALYTICS / ADMIN</span>
        </strong>
        <small>GESTÃO DA OPERAÇÃO</small>

        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => {
              setTab(item);

              if (item !== "clientes") {
                setShowClientForm(false);
              }

              if (item !== "projetos") {
                setShowProjectForm(false);
              }

              if (item !== "comentarios") {
                setCommentMessage("");
                setCommentToDelete(null);
              }
            }}
          >
            {labels[item]}
          </button>
        ))}
        <SignOut />
      </aside>

      <section>
        <span className="eyebrow">Painel administrativo</span>

        <h1>{tab === "visao" ? "Visão geral" : labels[tab]}</h1>

        {tab === "visao" && (
          <>
            <header className="dashboard-hero">
              <span className="eyebrow">HAS Analytics · Gestão integrada</span>
              <h2>Clareza para conduzir cada pesquisa.</h2>
              <p>
                Acompanhe seus clientes, organize entregas e transforme dados em
                resultados.
              </p>
            </header>
            <div className="summary">
              <article>
                <b>Clientes ativos</b>
                <strong>{clientCount}</strong>
              </article>

              <article>
                <b>Análises cadastradas</b>
                <strong>{projectCount}</strong>
              </article>

              <article>
                <b>Comentários pendentes</b>
                <strong>{comments.length}</strong>
              </article>
            </div>
            <AdminDeadlines
              onOpenClient={(id) => {
                setFocusedClient(id);
                setTab("clientes");
              }}
            />
          </>
        )}

        {tab === "configuracoes" && <CommercialSettings />}
        {tab === "clientes" && (
          <div className="workspace-card">
            <div className="workspace-header">
              <div>
                <h2>Clientes e acessos</h2>

                <p>
                  Cadastre clientes e gerencie os acessos à área restrita da HAS
                  Analytics.
                </p>
              </div>

              {!showClientForm && (
                <button
                  className="btn primary"
                  onClick={() => setShowClientForm(true)}
                >
                  Novo cliente
                </button>
              )}
            </div>

            {showClientForm && (
              <div className="admin-client-form-wrapper">
                <div className="admin-client-form-header">
                  <h3>Cadastrar novo cliente</h3>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowClientForm(false)}
                  >
                    Cancelar
                  </button>
                </div>

                <NewClientForm />
              </div>
            )}
            <div style={{ marginTop: "2rem" }}>
              <ClientOverview initialClientId={focusedClient} />
            </div>
          </div>
        )}

        {tab === "documentos" && (
          <div className="workspace-card stack">
            <h2>Central de documentos</h2>
            <p>
              Selecione um cliente e abra Documentos para enviar ou consultar
              seus arquivos.
            </p>
            <ClientOverview
              initialTab="documentos"
              initialClientId={focusedClient}
            />
          </div>
        )}
        {tab === "projetos" && (
          <div className="workspace-card">
            <div className="workspace-header">
              <div>
                <h2>Gerenciar portfólio</h2>

                <p>
                  Cadastre projetos, categorias, descrições, tecnologias e links
                  externos.
                </p>
              </div>

              {!showProjectForm && (
                <button
                  className="btn primary"
                  onClick={() => setShowProjectForm(true)}
                >
                  Novo projeto
                </button>
              )}
            </div>

            {showProjectForm && (
              <div className="admin-client-form-wrapper">
                <div className="admin-client-form-header">
                  <h3>Cadastrar novo projeto</h3>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowProjectForm(false)}
                  >
                    Cancelar
                  </button>
                </div>

                <NewProjectForm />
              </div>
            )}

            <div style={{ marginTop: "2rem" }}>
              <h3>Projetos cadastrados</h3>

              <ProjectList />
            </div>
          </div>
        )}

        {tab === "comentarios" && (
          <div className="workspace-card">
            <div className="workspace-header">
              <div>
                <h2>Moderação de comentários</h2>

                <p>
                  Analise os comentários enviados antes da publicação no site.
                </p>
              </div>
            </div>

            {commentMessage && (
              <p className="admin-client-message success">{commentMessage}</p>
            )}

            {comments.length === 0 ? (
              <p>Não existem comentários pendentes.</p>
            ) : (
              <div className="doc-list">
                {comments.map((comment) => (
                  <article key={comment.id}>
                    <div>
                      <strong>{comment.author_name}</strong>

                      <small>{formatCommentDate(comment.created_at)}</small>

                      <p>{comment.content}</p>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => approveComment(comment.id)}
                        disabled={moderatingId === comment.id}
                      >
                        {moderatingId === comment.id
                          ? "Processando..."
                          : "Aprovar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setCommentToDelete(comment)}
                        disabled={moderatingId === comment.id}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "mensagens" && <Notifications admin />}

        {commentToDelete && (
          <div className="admin-delete-confirmation">
            <div className="admin-delete-confirmation-box">
              <h3>Excluir comentário?</h3>

              <p>
                O comentário de <strong>{commentToDelete.author_name}</strong>{" "}
                será removido permanentemente.
              </p>

              <p>Esta ação não poderá ser desfeita.</p>

              <div className="admin-delete-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCommentToDelete(null)}
                  disabled={moderatingId !== null}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn primary"
                  onClick={confirmDeleteComment}
                  disabled={moderatingId !== null}
                >
                  {moderatingId ? "Excluindo..." : "Sim, excluir"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
