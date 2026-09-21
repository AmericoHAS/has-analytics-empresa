"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import ConsultationCalendar from "./ConsultationCalendar";
import { availabilityError, addDays } from "@/lib/workspace/calendar";
import { actionError } from "@/lib/workspace/action-errors";
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
  const selection = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState("");
  const [selected, setSelected] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [project, setProject] = useState(projects[0]?.id ?? "");
  useEffect(() => {
    if (opening || selected)
      selection.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [opening, selected]);
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
    action: () => PromiseLike<{
      error: { message: string; code?: string } | null;
    }>,
  ) {
    setBusy(true);
    try {
      const { error } = await action();
      if (error) throw Error(actionError(error, "atualizar a agenda"));
      setMessage("Agenda atualizada com sucesso.");
      setOpening("");
      setSelected(null);
      await load();
      window.dispatchEvent(new Event("has-workflow-updated"));
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
      <ConsultationCalendar
        slots={slots}
        admin={admin}
        busy={busy}
        onOpen={(date) => {
          setOpening(date);
          setSelected(null);
          setMessage("");
        }}
        onSelect={(slot) => {
          setSelected(slot);
          setOpening("");
          setMessage("");
        }}
      />
      <div ref={selection} />
      {admin && opening && (
        <form
          className="calendar-selection stack"
          key={opening}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              start = String(f.get("start")),
              end = String(f.get("end")),
              minutes = Number(f.get("minutes"));
            const invalid = availabilityError(start, end, minutes);
            if (invalid) {
              setMessage(invalid);
              return;
            }
            void run(() =>
              supabase.rpc("create_consultation_availability", {
                p_start: new Date(start + "-03:00").toISOString(),
                p_end: new Date(end + "-03:00").toISOString(),
                p_minutes: minutes,
                p_mode: f.get("mode"),
                p_location: f.get("location"),
              }),
            );
          }}
        >
          <div className="row">
            <h4>Abrir horários de atendimento</h4>
            <button
              type="button"
              className="btn"
              onClick={() => setOpening("")}
            >
              Fechar
            </button>
          </div>
          <div className="form-grid">
            <label>
              Início
              <input
                required
                type="datetime-local"
                name="start"
                defaultValue={opening}
              />
            </label>
            <label>
              Fim
              <input
                required
                type="datetime-local"
                name="end"
                defaultValue={
                  Number(opening.slice(11, 13)) === 23
                    ? addDays(opening.slice(0, 10), 1) +
                      "T00:" +
                      opening.slice(14)
                    : opening.slice(0, 11) +
                      String(Number(opening.slice(11, 13)) + 1).padStart(
                        2,
                        "0",
                      ) +
                      opening.slice(13)
                }
              />
            </label>
            <label>
              Duração de cada reunião
              <select name="minutes" defaultValue="60">
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modalidade
              <select name="mode">
                <option value="online">Online — Google Meet</option>
                <option value="presencial">Presencial</option>
              </select>
            </label>
            <label>
              Local (obrigatório para presencial)
              <input name="location" maxLength={500} />
            </label>
          </div>
          <p className="muted">
            O período será dividido em reuniões da duração escolhida. Exemplo:
            9h às 12h → três horários de uma hora.
          </p>
          <button className="btn primary" disabled={busy}>
            {busy ? "Salvando…" : "Disponibilizar horários"}
          </button>
        </form>
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
      {message && (
        <p className="action-feedback" role="status">
          {message}
        </p>
      )}
      {selected && (
        <div className="calendar-selection stack">
          <div className="row">
            <strong>{when(selected.starts_at)}</strong>
            <button className="btn" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
          <p>
            {selected.mode === "online"
              ? "Online — Google Meet"
              : selected.location}
          </p>
          {selected.busy ? (
            <p>
              Horário reservado.
              {bookings.some(
                (b) => b.slot_id === selected.id && b.status !== "cancelado",
              )
                ? " Consulte os detalhes abaixo."
                : " Escolha um horário disponível."}
            </p>
          ) : admin ? (
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  supabase
                    .from("consultation_slots")
                    .update({ enabled: false })
                    .eq("id", selected.id),
                )
              }
            >
              Fechar horário disponível
            </button>
          ) : (
            <button
              className="btn primary"
              disabled={busy || !project}
              onClick={() =>
                void run(() =>
                  supabase.rpc("book_consultation", {
                    p_slot: selected.id,
                    p_project: project,
                    p_revision: revisionId ?? null,
                  }),
                )
              }
            >
              {busy ? "Agendando…" : "Confirmar solicitação de reunião"}
            </button>
          )}
        </div>
      )}
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
