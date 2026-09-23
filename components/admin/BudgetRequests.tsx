"use client";
import { intakeFields } from "@/lib/commercial/intake";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateRequestStatus } from "@/app/admin/request-actions";
import { resendClientAccess } from "@/app/admin/actions";
import NewClientForm from "./NewClientForm";

type BudgetRequest = {
  intake?: Record<string, string>;
  id: string;
  client_id: string | null;
  project_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  service_type: string;
  title: string;
  description: string;
  desired_date: string | null;
  status: string;
  created_at: string;
};
const states: Record<string, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  respondida: "Respondida",
  concluida: "Concluída",
};

async function fetchRequests(): Promise<BudgetRequest[]> {
  const { data, error } = await supabase
    .from("budget_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BudgetRequest[];
}

export default function BudgetRequests({
  onOpen,
}: {
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<BudgetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setMessage("");
    try {
      setItems(await fetchRequests());
    } catch {
      setMessage("Não foi possível carregar as solicitações. Tente atualizar.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    fetchRequests()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Não foi possível carregar as solicitações. Tente atualizar.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function changeStatus(id: string, status: string) {
    setBusy(id);
    setMessage("");
    try {
      const result = await updateRequestStatus(id, status);
      setMessage(result.message);
      if (result.success)
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, status } : item)),
        );
    } catch {
      setMessage(
        "Não foi possível atualizar. A situação anterior foi mantida.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="workspace-card">
      <div className="workspace-header">
        <div>
          <h2>Solicitações de orçamento e acesso</h2>
          <p>
            Consulte a demanda, entre em contato e cadastre o cliente quando
            estiver pronto para liberar o acesso.
          </p>
        </div>
        <button
          className="btn"
          disabled={loading || busy !== null}
          onClick={() => void load()}
        >
          Atualizar
        </button>
      </div>
      <p role="status" className="request-message">
        {message}
      </p>
      {loading ? (
        <p>Carregando solicitações…</p>
      ) : items.length === 0 ? (
        <p>As solicitações feitas na página de orçamento aparecerão aqui.</p>
      ) : (
        <div className="budget-requests">
          {items.map((item) => (
            <article key={item.id} className="budget-request">
              <div className="request-header">
                <div>
                  <span className="eyebrow">{item.service_type}</span>
                  <h3>{item.title}</h3>
                  <strong>{item.name}</strong>
                  <p className="muted">
                    Recebida em{" "}
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    {item.desired_date &&
                      ` · Entrega desejada: ${item.desired_date.split("-").reverse().join("/")}`}
                  </p>
                </div>
                <label>
                  Situação
                  <select
                    aria-label={`Situação de ${item.title}`}
                    value={item.status}
                    disabled={busy !== null}
                    onChange={(event) =>
                      void changeStatus(item.id, event.target.value)
                    }
                  >
                    {!states[item.status] && (
                      <option value={item.status}>{item.status}</option>
                    )}
                    {Object.entries(states).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="request-contacts">
                <a href={`mailto:${encodeURIComponent(item.email)}`}>
                  {item.email}
                </a>
                {item.phone && <span>{item.phone}</span>}
              </div>
              <p className="request-description">{item.description}</p>
              <dl className="form-grid">
                {intakeFields
                  .filter(([key]) => item.intake?.[key])
                  .map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{item.intake?.[key]}</dd>
                    </div>
                  ))}
              </dl>
              {item.client_id ? (
                <button
                  className="btn primary"
                  onClick={() => onOpen(item.client_id!)}
                >
                  Abrir cliente e preparar orçamento
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={() =>
                    setSelected((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                >
                  {selected === item.id
                    ? "Fechar cadastro"
                    : "Preparar acesso do cliente"}
                </button>
              )}
              {(!item.client_id || !item.project_id) && (
                <button
                  className="btn"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(item.id);
                    try {
                      const { error } = await supabase.rpc(
                        "link_budget_request_by_email",
                        { p_request_id: item.id },
                      );
                      if (error) setMessage(error.message);
                      else {
                        window.dispatchEvent(new Event("has-workflow-updated"));
                        await load();
                        setMessage(
                          "Solicitação e projeto vinculados. Abra o cliente para acompanhar.",
                        );
                      }
                    } catch {
                      setMessage("Não foi possível vincular.");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Vincular ao cliente já cadastrado com este e-mail
                </button>
              )}
              {item.client_id && (
                <button
                  className="btn"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(item.id);
                    try {
                      const result = await resendClientAccess(item.client_id!);
                      setMessage(result.message);
                    } catch {
                      setMessage("Falha de comunicação ao reenviar o acesso.");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === item.id ? "Aguarde…" : "Reenviar e-mail de acesso"}
                </button>
              )}
              {!item.client_id && selected === item.id && (
                <div className="request-form">
                  <h3>Cadastrar cliente</h3>
                  <p>
                    Confira os dados. Ao aprovar, o cliente receberá um link
                    para definir a senha e o projeto ficará vinculado à conta.
                  </p>
                  <NewClientForm
                    key={item.id}
                    requestId={item.id}
                    onCreated={(feedback) => {
                      setMessage(feedback);
                      void fetchRequests()
                        .then(setItems)
                        .catch(() =>
                          setMessage(
                            feedback +
                              " Atualize a lista para conferir o vínculo.",
                          ),
                        );
                    }}
                    initialValues={{
                      fullName: item.name,
                      email: item.email,
                      phone: item.phone ?? "",
                    }}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
