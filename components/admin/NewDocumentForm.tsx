"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  full_name: string;
};

type Project = {
  id: string;
  client_id: string;
  title: string;
};

type Props = {
  clientId?: string;
  onSuccess?: () => void;
};

function DocumentUploadForm({ clientId: fixedClientId, onSuccess }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [clientId, setClientId] = useState(fixedClientId ?? "");

  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("arquivo");

  const [requiresSignature, setRequiresSignature] = useState(false);

  const [file, setFile] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void (async () => {
      {
        const [clientsResult, projectsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name")
            .eq("role", "client")
            .order("full_name"),

          supabase
            .from("client_projects")
            .select("id,client_id,title")
            .order("title"),
        ]);

        if (clientsResult.error) {
          console.error("Erro ao carregar clientes:", clientsResult.error);
        }

        if (projectsResult.error) {
          console.error("Erro ao carregar projetos:", projectsResult.error);
        }

        setClients((clientsResult.data ?? []) as Client[]);

        setProjects((projectsResult.data ?? []) as Project[]);
      }
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();

    setMessage("");

    if (!clientId) {
      setMessage("Selecione um cliente.");
      return;
    }

    if (!title.trim()) {
      setMessage("Informe o título do documento.");
      return;
    }

    if (!file) {
      setMessage("Selecione um arquivo.");
      return;
    }

    setSending(true);

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "file";

    const storagePath = `${clientId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("client-documents")
      .upload(storagePath, file, {
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);

      setMessage(`Erro ao enviar arquivo: ${uploadError.message}`);

      setSending(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("client_documents")
      .insert({
        client_id: clientId,
        project_id: projectId || null,
        title: title.trim(),
        kind,
        status: "disponivel",
        storage_path: storagePath,
        requires_signature: requiresSignature,
      });

    if (insertError) {
      await supabase.storage.from("client-documents").remove([storagePath]);

      console.error(insertError);

      setMessage(`Erro ao registrar documento: ${insertError.message}`);

      setSending(false);
      return;
    }

    setMessage("Documento enviado com sucesso.");

    if (!fixedClientId) {
      setClientId("");
    }

    setProjectId("");
    setTitle("");
    setKind("arquivo");
    setRequiresSignature(false);
    setFile(null);

    formRef.current?.reset();

    setSending(false);

    onSuccess?.();
  }

  const filteredProjects = projects.filter(
    (project) => project.client_id === clientId,
  );

  const fixedClient =
    clients.find((client) => client.id === fixedClientId) ?? null;

  return (
    <form ref={formRef} onSubmit={submit} className="admin-client-form">
      {fixedClientId ? (
        <label>
          Cliente
          <input
            type="text"
            value={fixedClient?.full_name ?? "Cliente selecionado"}
            disabled
          />
        </label>
      ) : (
        <label>
          Cliente
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);

              setProjectId("");
            }}
            required
          >
            <option value="">Selecione um cliente</option>

            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Projeto/análise
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Sem projeto vinculado</option>

          {filteredProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </label>

      <label>
        Título
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <label>
        Tipo
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="orcamento">Orçamento</option>

          <option value="contrato">Contrato</option>

          <option value="recibo">Recibo</option>

          <option value="relatorio">Relatório</option>

          <option value="arquivo">Arquivo</option>
        </select>
      </label>

      <label>
        Arquivo
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={requiresSignature}
          onChange={(e) => setRequiresSignature(e.target.checked)}
        />
        Exige assinatura
      </label>

      <button type="submit" className="btn primary" disabled={sending}>
        {sending ? "Enviando..." : "Enviar documento"}
      </button>

      {message && <p className="form-message">{message}</p>}
    </form>
  );
}
export default function NewDocumentForm(props: Props) {
  return (
    <DocumentUploadForm key={props.clientId ?? "select-client"} {...props} />
  );
}
