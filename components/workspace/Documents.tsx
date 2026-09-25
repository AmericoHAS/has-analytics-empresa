"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Doc } from "@/lib/workspace/types";
const kinds: Record<string, string> = {
  arquivo: "Arquivo",
  orcamento: "Orçamento",
  contrato: "Contrato",
  recibo: "Recibo",
  relatorio: "Resultado / relatório",
};
const extensions = [
  "pdf",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "html",
  "htm",
  "csv",
  "xlsx",
  "xls",
  "docx",
  "doc",
  "txt",
  "r",
  "rmd",
  "sav",
  "rds",
  "pptx",
];
// HTML is isolated in a sandbox with an opaque origin and no network access.
const previewTypes: Record<string, string> = {
  pdf: "application/pdf",
  html: "text/html",
  htm: "text/html",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const previewType = (doc: Doc) =>
  previewTypes[
    (doc.original_name ?? doc.storage_path ?? "")
      .split(".")
      .pop()
      ?.toLowerCase() ?? ""
  ];
export default function Documents({
  clientId,
  projectId,
  projects,
  admin = false,
  revisionId,
}: {
  clientId: string;
  projectId?: string | null;
  projects: { id: string; title: string }[];
  admin?: boolean;
  revisionId?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState(""),
    [project, setProject] = useState(projectId ?? ""),
    [search, setSearch] = useState(""),
    [show, setShow] = useState(false);
  const load = useCallback(async () => {
    let query = supabase
      .from("client_documents")
      .select(
        "id,client_id,project_id,title,kind,status,storage_path,created_at,uploaded_by,uploader_role,original_name,file_size,requires_signature,signed_at,is_visible",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (projectId !== undefined) query = projectId === null ? query.is("project_id", null) : query.eq("project_id", projectId);
    if (revisionId) query = query.eq("revision_id", revisionId);
    const { data, error } = await query;
    if (error)
      setMessage(
        "Não foi possível carregar os documentos. Confira sua conexão e a configuração do banco.",
      );
    else setDocs(data ?? []);
    setLoading(false);
  }, [clientId, revisionId, projectId]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, [load]);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("file") as File;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !extensions.includes(ext) ||
      file.size > 50 * 1024 * 1024 ||
      file.size === 0
    ) {
      setMessage("Use um formato aceito e um arquivo de até 50 MB, não vazio.");
      return;
    }
    setBusy(true);
    setMessage("");
    let path = "";
    let stored = false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw Error("Sua sessão expirou. Entre novamente.");
      path = `${clientId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-documents")
        .upload(path, file, {
          upsert: false,
          contentType: "application/octet-stream",
        });
      if (error) throw Error(error.message);
      stored = true;
      const { error: insert } = await supabase.from("client_documents").insert({
        client_id: clientId,
        revision_id: revisionId ?? null,
        project_id: projectId !== undefined ? projectId : f.get("project") || null,
        title: String(f.get("title")).trim(),
        kind: admin ? f.get("kind") : "arquivo",
        status: "disponivel",
        is_visible: admin ? f.get("visible") === "on" : true,
        storage_path: path,
        uploaded_by: user.id,
        uploader_role: admin ? "admin" : "client",
        original_name: file.name,
        file_size: file.size,
        requires_signature: admin && f.get("signature") === "on",
      });
      if (insert) throw Error(insert.message);
      stored = false;
      form.reset();
      setShow(false);
      setMessage("Arquivo enviado. Disponível na área privada do projeto.");
      window.dispatchEvent(new Event("has-workflow-updated"));
      await load();
    } catch (e) {
      if (stored) {
        const { error } = await supabase.storage
          .from("client-documents")
          .remove([path]);
        if (error)
          setMessage(
            "O registro falhou e o arquivo requer limpeza pelo administrador.",
          );
      }
      setMessage(
        (m) =>
          m || (e instanceof Error ? e.message : "Não foi possível enviar."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function download(doc: Doc) {
    if (!doc.storage_path) {
      setMessage(
        "Documento legado sem arquivo privado. Solicite ao administrador a republicação.",
      );
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(doc.storage_path, 60, {
          download: doc.original_name ?? true,
        });
      if (error || !data) throw Error("Não foi possível gerar o download.");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.rel = "noopener noreferrer";
      a.click();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao baixar.");
    } finally {
      setBusy(false);
    }
  }
  async function preview(doc: Doc) {
    const type = previewType(doc);
    if (!type || !doc.storage_path) return;
    if (type === "text/html") {
      setBusy(true);
      try {
        const { data, error } = await supabase.storage
          .from("client-documents")
          .download(doc.storage_path);
        if (error || !data) throw Error("Relatório indisponível.");
        setHtml(await data.text());
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Falha ao abrir relatório.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    const viewer = window.open("about:blank", "_blank");
    if (!viewer) {
      setMessage("Permita abrir uma nova aba para visualizar o documento.");
      return;
    }
    viewer.opener = null;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .download(doc.storage_path);
      if (error || !data) throw Error("Não foi possível abrir a visualização.");
      const url = URL.createObjectURL(new Blob([data], { type }));
      viewer.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      viewer.close();
      setMessage(e instanceof Error ? e.message : "Falha ao visualizar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(doc: Doc) {
    if (!confirm(`Excluir “${doc.title}” e seu arquivo?`)) return;
    setBusy(true);
    try {
      if (doc.storage_path) {
        const { error } = await supabase.storage
          .from("client-documents")
          .remove([doc.storage_path]);
        if (error)
          throw Error("Arquivo não removido. Nada foi excluído do cadastro.");
      }
      const { error } = await supabase
        .from("client_documents")
        .delete()
        .eq("id", doc.id);
      if (error)
        throw Error(
          "Arquivo removido, mas o registro ainda existe. Tente excluir novamente.",
        );
      window.dispatchEvent(new Event("has-workflow-updated"));
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na exclusão.");
    } finally {
      setBusy(false);
    }
  }
  const shown = docs.filter(
    (d) =>
      (!filter || d.kind === filter) &&
      (!project || d.project_id === project) &&
      d.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="stack">
      {html !== null && (
        <div
          className="html-report"
          role="dialog"
          aria-modal="true"
          aria-label="Relatório HTML"
        >
          <button className="btn" onClick={() => setHtml(null)}>
            Fechar relatório
          </button>
          <p>
            Visualização privada. Recursos externos estão bloqueados; use HTML
            autocontido exportado pelo R Markdown.
          </p>
          <iframe
            title="Relatório de análise"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={
              '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; script-src &apos;unsafe-inline&apos; &apos;unsafe-eval&apos; data: blob:; style-src &apos;unsafe-inline&apos; data:; img-src data: blob:; font-src data:; connect-src &apos;none&apos;; form-action &apos;none&apos;; base-uri &apos;none&apos;">' +
              html
            }
          />
        </div>
      )}

      <div className="workspace-header">
        <div>
          <span className="eyebrow">Documentos privados</span>
          <h2>Arquivos e entregas</h2>
          <p className="muted">
            Envie os dados da pesquisa e acompanhe os resultados em um só lugar.
          </p>
        </div>
        <button className="btn primary" onClick={() => setShow(!show)}>
          {show ? "Fechar envio" : "Enviar documento"}
        </button>
      </div>
      {show && (
        <form onSubmit={upload} className="workspace-card stack">
          <div className="form-grid">
            <label>
              Título
              <input name="title" required maxLength={300} />
            </label>
            <label>
              Projeto
              <select
                name="project"
                disabled={projectId !== undefined}
                defaultValue={
                  projectId !== undefined ? projectId ?? "" : revisionId || projects.length === 1 ? projects[0]?.id : ""
                }
              >
                <option value="">Geral do cliente</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {admin && (
              <label>
                Tipo
                <select name="kind">
                  {Object.entries(kinds).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="upload-zone">
            Selecione o arquivo
            <input
              type="file"
              name="file"
              accept={extensions.map((x) => "." + x).join(",")}
              required
            />
            <small>
              PDF, ZIP, imagens, HTML, documentos e dados de pesquisa · até 50
              MB
            </small>
          </label>
          {admin && (
            <label className="check">
              <input type="checkbox" name="visible" defaultChecked />
              Disponibilizar ao cliente agora (desmarque para guardar como
              interno)
            </label>
          )}
          {admin && (
            <label className="check">
              <input type="checkbox" name="signature" />
              Assinatura pendente (envie o documento assinado posteriormente)
            </label>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Enviando…" : "Enviar para a área privada"}
          </button>
        </form>
      )}
      <div className="filters">
        <input
          aria-label="Buscar documentos"
          placeholder="Buscar documento…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrar tipo"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(kinds).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar projeto"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">Todos os projetos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button className="btn" onClick={load}>
          Atualizar
        </button>
      </div>
      <p role="status">{message}</p>
      {loading ? (
        <p>Carregando arquivos…</p>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          Nenhum documento encontrado. Os próximos envios aparecerão aqui.
        </div>
      ) : (
        shown.map((d) => (
          <article className="document-card" key={d.id}>
            <div className="file-icon" aria-hidden>
              ↧
            </div>
            <div className="document-info">
              <span className="tag">{kinds[d.kind] ?? d.kind}</span>
              <h3>{d.title}</h3>
              {admin && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const { error } = await supabase
                        .from("client_documents")
                        .update({ is_visible: !d.is_visible })
                        .eq("id", d.id);
                      if (error) throw error;
                      await load();
                      window.dispatchEvent(new Event("has-workflow-updated"));
                    } catch {
                      setMessage("Não foi possível alterar a visibilidade.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {d.is_visible
                    ? "Tornar interno"
                    : "Disponibilizar ao cliente"}
                </button>
              )}
              {!d.is_visible && (
                <span className="tag">Interno · somente HAS</span>
              )}
              <small>
                {projects.find((p) => p.id === d.project_id)?.title ??
                  "Geral do cliente"}{" "}
                ·{" "}
                {d.uploader_role === "client"
                  ? "Enviado pelo cliente"
                  : "Enviado pela HAS"}{" "}
                · {new Date(d.created_at).toLocaleDateString("pt-BR")}
                {d.file_size
                  ? ` · ${(d.file_size / 1024 / 1024).toFixed(1)} MB`
                  : ""}
              </small>
              {d.requires_signature && (
                <p className="tag">
                  {d.signed_at
                    ? "Assinatura registrada"
                    : "Assinatura pendente"}
                </p>
              )}
            </div>
            <div className="actions">
              {d.storage_path && previewType(d) && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => preview(d)}
                >
                  Visualizar
                </button>
              )}
              <button
                className="btn"
                disabled={busy}
                onClick={() => download(d)}
              >
                Baixar
              </button>
              {admin && (
                <>
                  <button
                    className="btn danger-text"
                    disabled={busy}
                    onClick={() => remove(d)}
                  >
                    Excluir
                  </button>
                  {d.requires_signature && !d.signed_at && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          !confirm(
                            "Você verificou e recebeu o documento assinado?",
                          )
                        )
                          return;
                        setBusy(true);
                        const { error } = await supabase
                          .from("client_documents")
                          .update({
                            signed_at: new Date().toISOString(),
                            status: "assinado",
                          })
                          .eq("id", d.id);
                        if (error) setMessage("Erro ao registrar assinatura.");
                        await load();
                        setBusy(false);
                      }}
                    >
                      Registrar assinatura
                    </button>
                  )}
                </>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
