"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  mode: string;
  location: string;
  busy: boolean;
};
type Booking = {
  id: string;
  slot_id: string;
  project_id: string;
  status: string;
  meeting_url: string;
  confirmed_location: string;
  slot?: {
    starts_at: string;
    ends_at: string;
    location: string;
    mode: string;
  } | null;
};
const when = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
export default function Consultations({
  clientId,
  projects,
  admin = false,
  revisionId,
}: {
  clientId: string;
  projects: { id: string; title: string }[];
  admin?: boolean;
  revisionId?: string;
}) {
  const [slots, setSlots] = useState<Slot[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [project, setProject] = useState(projects[0]?.id ?? "");
  const load = useCallback(async () => {
    const [s, b] = await Promise.all([
      supabase.rpc("list_consultation_slots"),
      (() => {
        let q = supabase
          .from("consultation_bookings")
          .select(
            "id,slot_id,project_id,status,meeting_url,confirmed_location,slot:consultation_slots(starts_at,ends_at,location,mode)",
          )
          .order("created_at", { ascending: false });
        if (clientId) q = q.eq("client_id", clientId);
        return q;
      })(),
    ]);
    if (s.error || b.error) {
      setMessage("Agenda indisponível. Confira a atualização do banco.");
      return;
    }
    setSlots(s.data ?? []);
    setBookings((b.data ?? []) as unknown as Booking[]);
  }, [clientId]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(true);
    try {
      const { error } = await action();
      if (error) throw Error(error.message);
      setMessage(
        "Agendamento atualizado. O aviso foi registrado para envio por e-mail.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-card stack">
      <div>
        <span className="eyebrow">Consultoria</span>
        <h3>Agenda de atendimento</h3>
        <p className="muted">
          Horários de Brasília. Escolha o atendimento presencial ou online após
          receber os resultados.
        </p>
      </div>
      {admin && (
        <details>
          <summary>Disponibilizar horário na agenda comum</summary>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                supabase.from("consultation_slots").insert({
                  starts_at: new Date(
                    String(f.get("start")) + "-03:00",
                  ).toISOString(),
                  ends_at: new Date(
                    String(f.get("end")) + "-03:00",
                  ).toISOString(),
                  mode: f.get("mode"),
                  location: f.get("location"),
                }),
              );
            }}
          >
            <label>
              Início
              <input required type="datetime-local" name="start" />
            </label>
            <label>
              Fim
              <input required type="datetime-local" name="end" />
            </label>
            <label>
              Modalidade
              <select name="mode">
                <option value="online">Online — Google Meet</option>
                <option value="presencial">Presencial</option>
              </select>
            </label>
            <label>
              Local presencial
              <input name="location" maxLength={500} />
            </label>
            <button className="btn" disabled={busy}>
              Abrir horário
            </button>
          </form>
        </details>
      )}
      {!admin && (
        <label>
          Projeto
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Selecione</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <p role="status">{message}</p>
      <div className="consultation-slots">
        {slots.map((s) => (
          <article key={s.id} className={s.busy ? "slot busy" : "slot"}>
            <strong>{when(s.starts_at)}</strong>
            <span>{s.mode === "online" ? "Online" : s.location}</span>
            <small>{s.busy ? "Horário reservado" : "Disponível"}</small>
            {admin ? (
              !s.busy && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      supabase
                        .from("consultation_slots")
                        .update({ enabled: false })
                        .eq("id", s.id),
                    )
                  }
                >
                  Fechar horário
                </button>
              )
            ) : (
              <button
                className="btn"
                disabled={busy || s.busy || !project}
                onClick={() =>
                  void run(() =>
                    supabase.rpc("book_consultation", {
                      p_slot: s.id,
                      p_project: project,
                      p_revision: revisionId ?? null,
                    }),
                  )
                }
              >
                Agendar
              </button>
            )}
          </article>
        ))}
      </div>
      {!slots.length && <p>Nenhum horário aberto neste momento.</p>}
      {bookings
        .filter((b) => b.status !== "cancelado")
        .map((b) => (
          <article className="workspace-card" key={b.id}>
            <strong>
              {projects.find((p) => p.id === b.project_id)?.title ??
                "Consultoria"}{" "}
              · {b.status}
            </strong>
            <p>
              {b.slot
                ? when(b.slot.starts_at)
                : "Consulte a confirmação do agendamento"}
            </p>
            {b.meeting_url && (
              <a
                className="btn"
                href={b.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Entrar na reunião
              </a>
            )}
            {b.confirmed_location && <p>{b.confirmed_location}</p>}
            {admin && b.status === "solicitado" && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(() =>
                    supabase.rpc("manage_consultation", {
                      p_id: b.id,
                      p_status: "confirmado",
                      p_link: f.get("link"),
                      p_location: f.get("location"),
                    }),
                  );
                }}
              >
                <a
                  href="https://meet.google.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Criar reunião no Google Meet ↗
                </a>
                <label>
                  Link do Google Meet
                  <input
                    name="link"
                    type="url"
                    placeholder="https://meet.google.com/..."
                  />
                </label>
                <label>
                  Local confirmado
                  <input
                    name="location"
                    defaultValue={
                      slots.find((s) => s.id === b.slot_id)?.location ?? ""
                    }
                  />
                </label>
                <button className="btn" disabled={busy}>
                  Confirmar e avisar cliente
                </button>
              </form>
            )}
            {admin && b.status === "confirmado" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    supabase.rpc("manage_consultation", {
                      p_id: b.id,
                      p_status: "concluido",
                    }),
                  )
                }
              >
                Registrar reunião realizada
              </button>
            )}
            {b.status !== "concluido" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  if (confirm("Cancelar este agendamento e liberar o horário?"))
                    void run(() =>
                      supabase.rpc("manage_consultation", {
                        p_id: b.id,
                        p_status: "cancelado",
                      }),
                    );
                }}
              >
                Cancelar agendamento
              </button>
            )}
          </article>
        ))}
    </section>
  );
}
