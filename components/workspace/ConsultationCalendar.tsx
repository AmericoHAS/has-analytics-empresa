"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Video, MapPin } from "lucide-react";
import {
  addDays,
  brazilDay,
  weekStart,
  nextMeetingStart,
  type CalendarSlot,
} from "@/lib/workspace/calendar";
const clock = (v: string) =>
  new Date(v).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function ConsultationCalendar({
  slots,
  initialDay,
  admin,
  busy,
  onOpen,
  onSelect,
}: {
  slots: CalendarSlot[];
  initialDay?: string;
  admin: boolean;
  busy: boolean;
  onOpen: (date: string) => void;
  onSelect: (slot: CalendarSlot) => void;
}) {
  const [day, setDay] = useState(() => initialDay ?? brazilDay()),
    [view, setView] = useState("week");
  const first = view === "week" ? weekStart(day) : day,
    days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) =>
      addDays(first, i),
    );
  const visible = slots.filter((s) =>
    days.includes(brazilDay(new Date(s.starts_at))),
  );
  const hour = (v: string) =>
    Number(clock(v).slice(0, 2)) + Number(clock(v).slice(3)) / 60;
  const startHour = Math.min(
    7,
    ...visible.map((s) => Math.floor(hour(s.starts_at))),
  );
  const endHour = Math.max(
    21,
    ...visible.map((s) =>
      brazilDay(new Date(s.ends_at)) !== brazilDay(new Date(s.starts_at))
        ? 24
        : Math.ceil(hour(s.ends_at)),
    ),
  );
  return (
    <div className="has-calendar">
      <div className="calendar-toolbar">
        <div className="calendar-navigation">
          <button
            className="btn"
            aria-label="Período anterior"
            onClick={() => setDay(addDays(day, view === "week" ? -7 : -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button className="btn" onClick={() => setDay(brazilDay())}>
            Hoje
          </button>
          <button
            className="btn"
            aria-label="Próximo período"
            onClick={() => setDay(addDays(day, view === "week" ? 7 : 1))}
          >
            <ChevronRight size={18} />
          </button>
          <strong>
            {new Date(day + "T12:00:00Z").toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </strong>
        </div>
        <div className="calendar-navigation">
          <select
            aria-label="Visualização do calendário"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="week">Semana</option>
            <option value="day">Dia</option>
          </select>
          {admin && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => onOpen(day <= brazilDay() ? nextMeetingStart() : day + "T09:00")}
            >
              <Plus size={17} />
              Disponibilizar
            </button>
          )}
        </div>
      </div>
      <div className="calendar-legend">
        <span>● Disponível</span>
        {admin && (
          <>
            <span>● Reservado</span>
            <span>● Confirmado</span>
          </>
        )}
        <small>Horário de Brasília</small>
      </div>
      <div className="calendar-scroll">
        <div
          className={
            view === "week" ? "calendar-grid" : "calendar-grid calendar-day"
          }
          style={{
            gridTemplateColumns: `48px repeat(${days.length},minmax(90px,1fr))`,
          }}
        >
          <div className="calendar-day-heading" />
          {days.map((d) => (
            <button
              key={d}
              className={
                d === brazilDay()
                  ? "calendar-day-heading today"
                  : "calendar-day-heading"
              }
              onClick={() => {
                setDay(d);
                setView("day");
              }}
            >
              <small>
                {new Date(d + "T12:00:00Z").toLocaleDateString("pt-BR", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </small>
              <b>{Number(d.slice(-2))}</b>
            </button>
          ))}
          <div
            className="calendar-hours"
            style={{ height: (endHour - startHour) * 60 }}
          >
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <span key={i} style={{ top: i * 60 }}>
                {String(startHour + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div
              className="calendar-column"
              key={d}
              style={{ height: (endHour - startHour) * 60 }}
            >
              {admin &&
                Array.from({ length: (endHour - startHour) * 2 }, (_, i) => (
                  <button
                    key={i}
                    className="calendar-cell"
                    disabled={busy || Date.parse(`${d}T${String(startHour + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}-03:00`) <= Date.now()}
                    aria-label={`Disponibilizar ${d} às ${String(startHour + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`}
                    onClick={() =>
                      onOpen(
                        `${d}T${String(startHour + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
                      )
                    }
                  />
                ))}
              {slots
                .filter((s) => brazilDay(new Date(s.starts_at)) === d)
                .map((s) => (
                  <button
                    key={s.id}
                    className={
                      s.bookingStatus === "confirmado"
                        ? "calendar-event confirmed"
                        : s.busy
                          ? "calendar-event reserved"
                          : "calendar-event"
                    }
                    disabled={busy}
                    style={{
                      top: (hour(s.starts_at) - startHour) * 60,
                      height: Math.max(
                        24,
                        (Date.parse(s.ends_at) - Date.parse(s.starts_at)) /
                          60000 -
                          2,
                      ),
                    }}
                    onClick={() => onSelect(s)}
                    aria-label={`${s.busy ? "Reservado" : "Disponível"}, ${d}, ${clock(s.starts_at)} a ${clock(s.ends_at)}`}
                  >
                    <b>
                      {clock(s.starts_at)} – {clock(s.ends_at)}
                    </b>
                    <span>
                      {s.mode === "online" ? (
                        <Video size={12} />
                      ) : (
                        <MapPin size={12} />
                      )}{" "}
                      {s.busy
                        ? s.bookingStatus === "confirmado"
                          ? "Confirmado"
                          : "Reservado"
                        : s.mode === "online"
                          ? "Online"
                          : "Presencial"}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
