"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { isPastStart } from "@/lib/workspace/calendar";
import ConsultationCalendar from "./ConsultationCalendar";
import AvailabilityDialog from "./AvailabilityDialog";
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
  revision_id: string | null;
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
  const [calendarDay, setCalendarDay] = useState<string | undefined>();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [project, setProject] = useState(projects[0]?.id ?? "");
  useEffect(() => {
    if (selected && (!admin || selected.busy))
      selection.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [selected, admin]);
  const load = useCallback(async () => {
    const [s, b] = await Promise.all([
      supabase.rpc("list_consultation_slots"),
      (() => {
        let q = supabase
          .from("consultation_bookings")
          .select(
            "id,slot_id,project_id,revision_id,status,meeting_url,confirmed_location,slot:consultation_slots(starts_at,ends_at,location,mode)",
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
    focusDay?: string,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await action();
      if (error) throw Error(actionError(error, "atualizar a agenda"));
      setMessage("Agenda atualizada com sucesso.");
      if (focusDay) setCalendarDay(focusDay);
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
  const currentBookings = bookings.filter(
    (b) =>
      b.status !== "cancelado" &&
      (!projects.length || projects.some((p) => p.id === b.project_id)) &&
      (revisionId ? b.revision_id === revisionId : !b.revision_id),
  );
  const canChoose =
    admin || !currentBookings.some((b) => b.project_id === project);
  return (
    <section className="workspace-card stack">
      <div>
        <span className="eyebrow">Consultoria</span>
        <h3>Agenda de atendimento</h3>
        <p className="muted">
          Horários de Brasília. Escolha o atendimento presencial ou online após
          a HAS concluir a análise e liberar a consultoria.
        </p>
      </div>
      {canChoose && (
        <ConsultationCalendar
          key={calendarDay ?? "initial"}
          initialDay={calendarDay}
          slots={slots.map((s) => ({
            ...s,
            bookingStatus: admin
              ? bookings.find(
                  (b) => b.slot_id === s.id && b.status !== "cancelado",
                )?.status
              : undefined,
          }))}
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
      )}
      <div ref={selection} />
      {admin && (opening || (selected && !selected.busy)) && (
        <AvailabilityDialog
          key={opening || selected!.id}
          initialStart={opening || new Date(Date.parse(selected!.starts_at) - 3 * 3600000).toISOString().slice(0, 16)}
          initialMinutes={opening ? 60 : (Date.parse(selected!.ends_at) - Date.parse(selected!.starts_at)) / 60000}
          initialMode={opening ? "online" : selected!.mode}
          initialLocation={opening ? "" : selected!.location}
          editing={!opening}
          busy={busy}
          message={message}
          onClose={() => { setOpening(""); setSelected(null); setMessage(""); }}
          onSave={({ start, end, minutes, mode, location }) => {
            void run(() => opening
              ? supabase.rpc("create_consultation_availability", {
                  p_start: new Date(start + "-03:00").toISOString(),
                  p_end: new Date(end + "-03:00").toISOString(),
                  p_minutes: minutes, p_mode: mode, p_location: location,
                })
              : supabase.from("consultation_slots").update({
                  starts_at: new Date(start + "-03:00").toISOString(),
                  ends_at: new Date(end + "-03:00").toISOString(), mode, location,
                }).eq("id", selected!.id).select("id").single(), start.slice(0, 10));
          }}
          onRemove={!opening ? () => {
            if (confirm("Remover este horário disponível do calendário?"))
              void run(() => supabase.from("consultation_slots").update({ enabled: false }).eq("id", selected!.id).select("id").single());
          } : undefined}
        />
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
      {selected && canChoose && (!admin || selected.busy) && (
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
          ) : (
            <button
              className="btn primary"
              disabled={busy || !project || isPastStart(selected.starts_at)}
              onClick={() =>
                !isPastStart(selected.starts_at) && void run(() =>
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
      {canChoose && !slots.length && (
        <p>
          Nenhum horário aberto neste momento. A HAS disponibilizará novos
          horários.
        </p>
      )}
      {bookings
        .filter(
          (b) =>
            b.status !== "cancelado" &&
            (!projects.length || projects.some((p) => p.id === b.project_id)) &&
            (revisionId ? b.revision_id === revisionId : !b.revision_id),
        )
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
                    defaultValue={b.slot?.location ?? ""}
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
                className="btn danger-text"
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
