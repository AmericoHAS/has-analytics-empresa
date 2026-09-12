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
// Force a safe viewer MIME; HTML and other active formats are download-only.
const previewTypes: Record<string, string> = {
  pdf: "application/pdf",
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
  projects,
  admin = false,
}: {
  clientId: string;
  projects: { id: string; title: string }[];
  admin?: boolean;
}) {
  const [docs, setDocs] = useState<Doc[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState(""),
    [project, setProject] = useState(""),
    [search, setSearch] = useState(""),
    [show, setShow] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_documents")
      .select(
        "id,client_id,project_id,title,kind,status,storage_path,created_at,uploaded_by,uploader_role,original_name,file_size,requires_signature,signed_at",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error)
      setMessage(
        "Não foi possível carregar os documentos. Confira sua conexão e a configuração do banco.",
      );
    else setDocs(data ?? []);
    setLoading(false);
  }, [clientId]);
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
        project_id: f.get("project") || null,
        title: String(f.get("title")).trim(),
        kind: admin ? f.get("kind") : "arquivo",
        status: "disponivel",
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
              <select name="project">
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
