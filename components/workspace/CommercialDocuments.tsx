"use client";
import { paymentAction } from "@/app/admin/payment-actions";
import { money } from "@/lib/commercial/model";
import { type PaymentQuote } from "@/lib/commercial/payments";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  registerProviderSignature,
  generateCommercialDocument,
  commercialDownload,
  publishCommercial,
  decideCommercial,
  submitCommercialSignature,
  reviewCommercialSignature,
  registerCommercialRevision,
} from "@/app/admin/commercial-actions";
type Doc = {
  offer_group: string | null;
  payment_option: PaymentQuote | null;
  external_revision: boolean;
  id: string;
  title: string;
  body: string;
  budget_id: string;
  source_revision: number;
  status: string;
  created_at: string;
  published_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  signature_status: string;
  signed_path: string | null;
};
type Budget = {
  id: string;
  budget_number: string;
  title: string;
  status: string;
  revision: number;
};
type Template = {
  body: string;
  provider_name: string;
  provider_tax_id: string;
  provider_address: string;
  provider_contact: string;
};
const statuses: Record<string, string> = {
  rascunho: "Rascunho privado",
  enviado: "Aguardando resposta",
  aprovado: "Aprovado",
  recusado: "Revisão solicitada",
  substituido: "Versão anterior",
};
export default function CommercialDocuments({
  clientId,
  admin = false,
  kind,
  onChange,
  refreshKey,
  budgetId,
  compact = false,
}: {
  clientId: string;
  admin?: boolean;
  kind: "orcamento" | "contrato";
  onChange?: () => void;
  refreshKey?: string;
  budgetId?: string;
  compact?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({}),
    [choices, setChoices] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Doc[]>([]),
    [budgets, setBudgets] = useState<Budget[]>([]),
    [template, setTemplate] = useState<Template | null>(null),
    [body, setBody] = useState(""),
    [title, setTitle] = useState(""),
    [budget, setBudget] = useState(budgetId ?? ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [editor, setEditor] = useState(false),
    [confirm, setConfirm] = useState<{
      id: string;
      action: "publish" | "accept" | "reject" | "valid" | "invalid";
    } | null>(null);
  const load = useCallback(async () => {
    const [d, b] = await Promise.all([
      supabase
        .from("commercial_documents")
        .select(
          "offer_group,payment_option,external_revision,id,title,body,budget_id,source_revision,status,created_at,published_at,decided_at,decision_note,signature_status,signed_path",
        )
        .eq("client_id", clientId)
        .eq("kind", kind)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_budgets")
        .select("id,budget_number,title,status,revision")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
    ]);
    if (d.error || b.error) {
      setMessage(
        "Documentos comerciais indisponíveis. Aplique ATUALIZAR-COMERCIAL.sql no Supabase antes de usar esta seção.",
      );
      return;
    }
    setLoaded(true);
    setDocs(
      (d.data ?? []).filter((v) => !budgetId || v.budget_id === budgetId),
    );
    setBudgets((b.data ?? []).filter((v) => !budgetId || v.id === budgetId));
    const { data: p } = await supabase
      .from("budget_payments")
      .select("budget_id,document_id")
      .eq("client_id", clientId);
    setChoices(
      Object.fromEntries((p ?? []).map((v) => [v.budget_id, v.document_id])),
    );
  }, [clientId, kind, budgetId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    if (admin)
      supabase
        .from("document_templates")
        .select(
          "body:native_body,provider_name,provider_tax_id,provider_address,provider_contact",
        )
        .eq("kind", kind)
        .single()
        .then(({ data, error }) => {
          if (error)
            setMessage(
              "Atualize o banco para carregar os modelos de documentos.",
            );
          else {
            setTemplate(data);
            setBody(data.body);
          }
        });
    return () => clearTimeout(timer);
  }, [load, admin, kind]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);
  async function run(
    action: () => Promise<{ success: boolean; message: string }>,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await action();
      setMessage(r.message);
      if (r.success) {
        setConfirm(null);
        setEditor(false);
        await load();
        window.dispatchEvent(new Event("has-workflow-updated"));
        onChange?.();
      }
    } catch {
      setMessage(
        "Não foi possível concluir. Confira a conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string, format: "pdf" | "word" | "signed") {
    setBusy(true);
    try {
      const url = await commercialDownload(id, format);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener noreferrer";
      a.click();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Arquivo indisponível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack commercial-editor">
      {!compact && (
        <div className="workspace-header">
          <div>
            <span className="eyebrow">Documentos e aprovações</span>
            <h2>{kind === "contrato" ? "Contratos" : "PDFs das propostas"}</h2>
          </div>
          <button className="btn" onClick={load} disabled={busy}>
            Atualizar
          </button>
        </div>
      )}
      {admin && (
        <>
          <button
            className="btn primary"
            disabled={busy || !template}
            onClick={() => {
              setBody(template?.body ?? "");
              setTitle(
                kind === "contrato"
                  ? "Contrato de prestação de serviços"
                  : "Orçamento de serviços",
              );
              setEditor(!editor);
            }}
          >
            {docs.length ? "Gerar nova versão" : "Gerar PDF e Word"}
          </button>
          {editor && (
            <form
              className="workspace-card stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                f.set("kind", kind);
                void run(() => generateCommercialDocument(f));
              }}
            >
              <label hidden={!!budgetId}>
                Orçamento de origem
                <select
                  name="budgetId"
                  required
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                >
                  <option value="">
                    Selecione
                    {kind === "contrato" ? " um orçamento aprovado" : ""}
                  </option>
                  {budgets
                    .filter(
                      (b) => kind !== "contrato" || b.status === "aprovado",
                    )
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.budget_number} · {b.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Título do documento
                <input
                  name="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={300}
                />
              </label>
              <p>
                Identificação, itens, valores e condições de pagamento são
                preenchidos a partir do cadastro e orçamento. Edite abaixo as
                condições específicas deste documento.
              </p>
              <label>
                Condições adicionais desta versão (opcional)
                <textarea
                  name="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={20000}
                />
              </label>
              {kind === "contrato" && (
                <div className="form-grid">
                  <label>
                    Quantidade de revisões incluídas
                    <input
                      name="revisions"
                      defaultValue="1"
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Cidade / foro conforme acordo
                    <input
                      name="forumCity"
                      defaultValue="Maringá — PR"
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Link da cobrança no Mercado Pago (se cartão)
                    <input name="paymentLink" type="url" pattern="https://.*" />
                  </label>
                </div>
              )}
              <p className="muted">
                O documento usa o modelo Word original da HAS, com sua
                identidade e cláusulas. O texto acima será acrescentado ao
                modelo. Confira todas as condições antes de assinar.
              </p>
              <button className="btn primary" disabled={busy}>
                {busy ? "Gerando…" : "Gerar PDF e Word em rascunho"}
              </button>
            </form>
          )}
        </>
      )}
      <p role="status">{message}</p>
      {!loaded && !message && <p role="status">Carregando documentos…</p>}
      {loaded && !docs.length && (
        <div className="empty-state">
          Nenhum {kind === "contrato" ? "contrato" : "PDF de orçamento"}{" "}
          disponível.{" "}
          {admin
            ? "Prepare e confira uma versão antes de enviar."
            : "Os documentos aparecerão aqui quando forem disponibilizados pela HAS."}
        </div>
      )}
      {Array.from(
        new Set(
          docs
            .filter((d) => d.offer_group && d.status !== "substituido")
            .map((d) => d.offer_group!),
        ),
      ).map((group) => {
        const variants = docs.filter(
          (d) => d.offer_group === group && d.status !== "substituido",
        );
        return (
          <label className="payment-choice" key={group}>
            Forma de pagamento · {variants[0]?.title}
            <select
              value={
                selected[group] ??
                choices[variants[0]?.budget_id] ??
                variants[0]?.id
              }
              onChange={(e) =>
                setSelected((v) => ({ ...v, [group]: e.target.value }))
              }
            >
              {variants.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.payment_option?.label} ·{" "}
                  {money(d.payment_option?.total ?? 0)}
                </option>
              ))}
            </select>
            <small>
              O PDF abaixo já contém a forma e o valor desta opção.{" "}
              {admin
                ? "Confira todas as opções antes de disponibilizar o conjunto."
                : "Selecione, confirme a escolha e confira o PDF antes de aprovar."}
            </small>
          </label>
        );
      })}
      <button className="btn" onClick={() => setHistory(!history)}>
        {history ? "Ocultar histórico" : "Ver versões anteriores"}
      </button>
      {docs
        .filter((d) => history || d.status !== "substituido")
        .filter(
          (d) =>
            !d.offer_group ||
            d.status === "substituido" ||
            d.id ===
              (selected[d.offer_group] ??
                choices[d.budget_id] ??
                docs.find(
                  (v) =>
                    v.offer_group === d.offer_group &&
                    v.status !== "substituido",
                )?.id),
        )
        .map((d) => {
          const current = budgets.find((b) => b.id === d.budget_id);
          const stale = !current || current.revision !== d.source_revision;
          return (
            <article className="workspace-card stack" key={d.id}>
              <div className="row">
                <h3>{d.title}</h3>
                <span className="tag">{statuses[d.status]}</span>
              </div>
              <small>
                Versão {d.id.slice(0, 8).toUpperCase()} ·{" "}
                {new Date(d.created_at).toLocaleDateString("pt-BR")}
                {d.published_at
                  ? ` · Enviado em ${new Date(d.published_at).toLocaleDateString("pt-BR")}`
                  : ""}
              </small>
              {d.payment_option && (
                <div className="total-card">
                  <span>{d.payment_option.label}</span>
                  <strong>{money(d.payment_option.total)}</strong>
                </div>
              )}
              {stale && (
                <p>
                  O orçamento de origem foi atualizado. Esta versão permanece no
                  histórico; solicite uma versão atualizada antes de aprovar.
                </p>
              )}
              {admin && kind === "contrato" && d.status === "rascunho" && (
                <form
                  className="workspace-card stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const file = new FormData(e.currentTarget).get(
                      "providerPdf",
                    ) as File;
                    setBusy(true);
                    let path = "";
                    try {
                      if (
                        !file ||
                        file.size > 20 * 1024 * 1024 ||
                        new TextDecoder().decode(
                          await file.slice(0, 5).arrayBuffer(),
                        ) !== "%PDF-"
                      )
                        throw Error("Envie um PDF válido de até 20 MB.");
                      path = `${clientId}/${d.id}/provider-${crypto.randomUUID()}.pdf`;
                      const { error } = await supabase.storage
                        .from("commercial-documents")
                        .upload(path, file, { contentType: "application/pdf" });
                      if (error) throw Error("Falha ao enviar PDF.");
                      const r = await registerProviderSignature(d.id, path);
                      if (!r.success) throw Error(r.message);
                      path = "";
                      setMessage(r.message);
                      await load();
                    } catch (e) {
                      if (path)
                        await supabase.storage
                          .from("commercial-documents")
                          .remove([path]);
                      setMessage(
                        e instanceof Error ? e.message : "Falha ao salvar.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Contrato já assinado pela HAS
                    <input
                      name="providerPdf"
                      type="file"
                      accept=".pdf,application/pdf"
                      required
                    />
                  </label>
                  <button className="btn" disabled={busy}>
                    Registrar PDF assinado pela HAS
                  </button>
                </form>
              )}
              <div className="commercial-document-actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => download(d.id, "pdf")}
                >
                  Baixar PDF
                </button>
                {admin && (
                  <>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => download(d.id, "word")}
                    >
                      Word editável
                    </button>
                    {!d.external_revision && (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => {
                          setBudget(d.budget_id);
                          setTitle(d.title);
                          setBody(d.body);
                          setEditor(true);
                        }}
                      >
                        Editar como nova versão
                      </button>
                    )}
                    {d.status === "rascunho" && !stale && (
                      <button
                        className="btn primary"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({ id: d.id, action: "publish" })
                        }
                      >
                        Disponibilizar ao cliente
                      </button>
                    )}
                  </>
                )}
                {!admin &&
                  d.status === "enviado" &&
                  !stale &&
                  kind === "orcamento" &&
                  d.payment_option &&
                  choices[d.budget_id] !== d.id && (
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() => run(() => paymentAction("choose", d.id))}
                    >
                      Escolher esta forma de pagamento
                    </button>
                  )}
                {!admin &&
                  d.status === "enviado" &&
                  !stale &&
                  (!d.payment_option ||
                    kind === "contrato" ||
                    choices[d.budget_id] === d.id) && (
                    <>
                      <button
                        className="btn primary"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({ id: d.id, action: "accept" })
                        }
                      >
                        {kind === "contrato"
                          ? "Aprovar conteúdo do contrato"
                          : "Aprovar orçamento"}
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({ id: d.id, action: "reject" })
                        }
                      >
                        Solicitar revisão
                      </button>
                    </>
                  )}
              </div>
              {d.external_revision && (
                <p>
                  Revisão feita fora do site. O conteúdo oficial desta versão
                  está nos arquivos PDF e Word anexados.
                </p>
              )}
              {admin && !stale && (
                <details>
                  <summary>Enviar revisão feita no Word (DOCX + PDF)</summary>
                  <p>
                    Edite o Word, exporte o PDF correspondente e envie os dois
                    arquivos. Se alterar valores ou escopo, atualize primeiro o
                    orçamento e gere uma versão atualizada. O envio abaixo cria
                    um rascunho novo, sem substituir arquivos antigos.
                  </p>
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        const pdf = f.get("pdf") as File,
                          word = f.get("word") as File;
                        const paths: string[] = [];
                        try {
                          if (
                            !pdf?.name.toLowerCase().endsWith(".pdf") ||
                            !word?.name.toLowerCase().endsWith(".docx") ||
                            [pdf, word].some(
                              (file) =>
                                file.size === 0 || file.size > 20 * 1024 * 1024,
                            )
                          )
                            throw Error("Envie PDF e DOCX de até 20 MB cada.");
                          const key = crypto.randomUUID();
                          for (const [file, ext] of [
                            [pdf, "pdf"],
                            [word, "docx"],
                          ] as const) {
                            const path = `${clientId}/revisions/${key}.${ext}`;
                            const { error } = await supabase.storage
                              .from("commercial-documents")
                              .upload(path, file, {
                                upsert: false,
                                contentType:
                                  ext === "pdf"
                                    ? "application/pdf"
                                    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                              });
                            if (error)
                              throw Error(
                                "Falha ao enviar arquivos da revisão.",
                              );
                            paths.push(path);
                          }
                          const result = await registerCommercialRevision(
                            d.id,
                            paths[0],
                            paths[1],
                          );
                          if (!result.success) throw Error(result.message);
                          paths.length = 0;
                          return result;
                        } catch (error) {
                          if (paths.length)
                            await supabase.storage
                              .from("commercial-documents")
                              .remove(paths);
                          return {
                            success: false,
                            message:
                              error instanceof Error
                                ? error.message
                                : "Não foi possível registrar a revisão.",
                          };
                        }
                      });
                    }}
                  >
                    <label>
                      Word editado
                      <input name="word" type="file" accept=".docx" required />
                    </label>
                    <label>
                      PDF exportado do Word
                      <input name="pdf" type="file" accept=".pdf" required />
                    </label>
                    <button className="btn" disabled={busy}>
                      Salvar revisão privada
                    </button>
                  </form>
                </details>
              )}
              {d.decided_at && (
                <p>
                  Resposta registrada em{" "}
                  {new Date(d.decided_at).toLocaleString("pt-BR")}.{" "}
                  {d.decision_note}
                </p>
              )}
              {d.published_at && d.status !== "substituido" && (
                <>
                  <p>
                    A aprovação do conteúdo no portal é separada da assinatura
                    do PDF. Para assinar: baixe o PDF, abra o gov.br, assine e
                    baixe o arquivo assinado. Depois envie-o abaixo. O gov.br
                    exige conta prata ou ouro.
                  </p>
                  <a
                    className="text-link"
                    href="https://assinador.iti.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir assinador gov.br ↗
                  </a>
                  {d.signed_path && (
                    <>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => download(d.id, "signed")}
                      >
                        Baixar PDF devolvido
                      </button>
                      <p>
                        Assinatura:{" "}
                        {d.signature_status === "recebida"
                          ? "arquivo recebido, aguardando conferência"
                          : d.signature_status === "validada"
                            ? "conferida pela administração"
                            : d.signature_status === "rejeitada"
                              ? "nova assinatura solicitada"
                              : "pendente"}
                      </p>
                    </>
                  )}
                  {!admin &&
                    !stale &&
                    d.status === "aprovado" &&
                    ["pendente", "rejeitada"].includes(d.signature_status) && (
                      <form
                        className="stack"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget),
                            file = f.get("signed") as File;
                          let path = "",
                            receiptPath = "";
                          setBusy(true);
                          try {
                            if (
                              !file ||
                              file.size === 0 ||
                              file.size > 20 * 1024 * 1024 ||
                              !file.name.toLowerCase().endsWith(".pdf") ||
                              new TextDecoder().decode(
                                await file.slice(0, 5).arrayBuffer(),
                              ) !== "%PDF-"
                            )
                              throw Error("Envie um PDF válido de até 20 MB.");
                            path = `${clientId}/signatures/${crypto.randomUUID()}.pdf`;
                            const { error } = await supabase.storage
                              .from("commercial-documents")
                              .upload(path, file, {
                                contentType: "application/pdf",
                                upsert: false,
                              });
                            if (error)
                              throw Error("Não foi possível enviar o PDF.");
                            if (kind === "contrato") {
                              const receipt = f.get("receipt") as File;
                              const ext = receipt?.name
                                .split(".")
                                .pop()
                                ?.toLowerCase();
                              if (
                                !receipt ||
                                !ext ||
                                !["pdf", "png", "jpg", "jpeg"].includes(ext) ||
                                receipt.size === 0 ||
                                receipt.size > 10 * 1024 * 1024
                              )
                                throw Error(
                                  "Inclua o comprovante em PDF, PNG ou JPG, até 10 MB.",
                                );
                              receiptPath = `${clientId}/${crypto.randomUUID()}.${ext}`;
                              const { error: re } = await supabase.storage
                                .from("payment-receipts")
                                .upload(receiptPath, receipt);
                              if (re)
                                throw Error("Falha ao enviar comprovante.");
                            }
                            const r = await submitCommercialSignature(
                              d.id,
                              path,
                              receiptPath || undefined,
                            );
                            if (!r.success) throw Error(r.message);
                            path = "";
                            receiptPath = "";
                            window.dispatchEvent(
                              new Event("has-workflow-updated"),
                            );
                            setMessage(r.message);
                            await load();
                          } catch (e) {
                            if (receiptPath)
                              await supabase.storage
                                .from("payment-receipts")
                                .remove([receiptPath]);
                            if (path)
                              await supabase.storage
                                .from("commercial-documents")
                                .remove([path]);
                            setMessage(
                              e instanceof Error
                                ? e.message
                                : "Não foi possível enviar.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <label>
                          Devolver PDF assinado
                          <input
                            name="signed"
                            type="file"
                            accept="application/pdf,.pdf"
                            required
                          />
                        </label>
                        {kind === "contrato" && (
                          <label>
                            Comprovante de pagamento
                            <input
                              name="receipt"
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              required
                            />
                          </label>
                        )}
                        <button className="btn" disabled={busy}>
                          Enviar para conferência
                        </button>
                      </form>
                    )}
                  {admin && d.signature_status === "recebida" && (
                    <div className="commercial-document-actions">
                      <a
                        className="text-link"
                        href="https://validar.iti.gov.br/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Conferir assinatura no ITI ↗
                      </a>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({ id: d.id, action: "valid" })
                        }
                      >
                        Registrar conferência válida
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({ id: d.id, action: "invalid" })
                        }
                      >
                        Solicitar novo arquivo
                      </button>
                    </div>
                  )}
                </>
              )}
              {confirm?.id === d.id && (
                <form
                  className="onboarding-notice stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(() =>
                      confirm.action === "publish"
                        ? publishCommercial(d.id, f.get("reviewed") === "on")
                        : confirm.action === "accept" ||
                            confirm.action === "reject"
                          ? decideCommercial(
                              d.id,
                              confirm.action === "accept",
                              String(f.get("note") ?? ""),
                            )
                          : reviewCommercialSignature(
                              d.id,
                              confirm.action === "valid",
                            ),
                    );
                  }}
                >
                  <label className="check">
                    <input type="checkbox" name="reviewed" required />
                    {confirm.action === "publish"
                      ? "Conferi os PDFs, valores e condições de todas as formas de pagamento deste conjunto e quero disponibilizá-los ao cliente."
                      : confirm.action === "valid"
                        ? "Conferi o arquivo no validador e a identidade do signatário."
                        : confirm.action === "accept"
                          ? "Li esta versão e confirmo minha aprovação."
                          : "Confirmo o pedido de revisão."}
                  </label>
                  {["accept", "reject"].includes(confirm.action) && (
                    <label>
                      Observação (opcional)
                      <textarea name="note" maxLength={2000} />
                    </label>
                  )}
                  <div className="row">
                    <button className="btn primary" disabled={busy}>
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => setConfirm(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
    </section>
  );
}
