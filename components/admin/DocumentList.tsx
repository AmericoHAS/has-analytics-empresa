"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DocumentItem = {
  id: string;
  client_id: string;
  project_id: string | null;
  title: string;
  kind: string;
  status: string;
  storage_path: string | null;
  requires_signature: boolean;
  signed_at: string | null;
  created_at: string;
};

type Client = {
  id: string;
  full_name: string;
};

type Project = {
  id: string;
  title: string;
};

export default function DocumentList() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      {
        const [documentsResult, clientsResult, projectsResult] =
          await Promise.all([
            supabase
              .from("client_documents")
              .select(
                "id,client_id,project_id,title,kind,status,storage_path,requires_signature,signed_at,created_at",
              )
              .order("created_at", { ascending: false }),

            supabase
              .from("profiles")
              .select("id,full_name")
              .eq("role", "client"),

            supabase.from("client_projects").select("id,title"),
          ]);

        if (documentsResult.error) {
          console.error(documentsResult.error);
          setMessage("Não foi possível carregar os documentos.");
        }

        setDocuments((documentsResult.data ?? []) as DocumentItem[]);

        setClients((clientsResult.data ?? []) as Client[]);

        setProjects((projectsResult.data ?? []) as Project[]);

        setLoading(false);
      }
    })();
  }, []);

  function getClientName(clientId: string) {
    return (
      clients.find((client) => client.id === clientId)?.full_name ??
      "Cliente não identificado"
    );
  }

  function getProjectName(projectId: string | null) {
    if (!projectId) {
      return "Sem projeto";
    }

    return (
      projects.find((project) => project.id === projectId)?.title ??
      "Projeto não identificado"
    );
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  }

  function formatKind(kind: string) {
    const labels: Record<string, string> = {
      orcamento: "Orçamento",
      contrato: "Contrato",
      recibo: "Recibo",
      relatorio: "Relatório",
      arquivo: "Arquivo",
    };

    return labels[kind] ?? kind;
  }

  async function openDocument(document: DocumentItem) {
    setMessage("");

    if (!document.storage_path) {
      setMessage("Este documento não possui arquivo associado.");
      return;
    }

    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(document.storage_path, 60, { download: true });

    if (error || !data?.signedUrl) {
      console.error(error);

      setMessage("Não foi possível abrir o documento.");

      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(document: DocumentItem) {
    const confirmed = window.confirm(
      `Deseja realmente excluir "${document.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(document.id);
    setMessage("");

    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("client-documents")
        .remove([document.storage_path]);

      if (storageError) {
        console.error(storageError);

        setMessage("Não foi possível excluir o arquivo armazenado.");

        setDeletingId(null);

        return;
      }
    }

    const { error } = await supabase
      .from("client_documents")
      .delete()
      .eq("id", document.id);

    if (error) {
      console.error(error);

      setMessage(
        "O arquivo foi removido, mas ocorreu um erro ao excluir o registro.",
      );

      setDeletingId(null);

      return;
    }

    setDocuments((current) =>
      current.filter((item) => item.id !== document.id),
    );

    setMessage("Documento excluído com sucesso.");

    setDeletingId(null);
  }

  if (loading) {
    return <p>Carregando documentos...</p>;
  }

  return (
    <div>
      {message && <p className="form-message">{message}</p>}

      {documents.length === 0 ? (
        <p>Nenhum documento cadastrado.</p>
      ) : (
        <div className="doc-list">
          {documents.map((document) => (
            <article key={document.id}>
              <div>
                <strong>{document.title}</strong>

                <small>{getClientName(document.client_id)}</small>

                <small>
                  {formatKind(document.kind)}
                  {" • "}
                  {getProjectName(document.project_id)}
                </small>

                <small>
                  Status: {document.status}
                  {" • "}
                  {formatDate(document.created_at)}
                </small>

                {document.requires_signature && (
                  <small>
                    Assinatura: {document.signed_at ? "Assinado" : "Pendente"}
                  </small>
                )}
              </div>

              <div>
                <button type="button" onClick={() => openDocument(document)}>
                  Abrir
                </button>

                <button
                  type="button"
                  onClick={() => deleteDocument(document)}
                  disabled={deletingId === document.id}
                >
                  {deletingId === document.id ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
