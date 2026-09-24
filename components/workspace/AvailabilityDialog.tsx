"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarClock } from "lucide-react";
import { meetingEnd, availabilityError } from "@/lib/workspace/calendar";
export type AvailabilityInput = { start: string; end: string; minutes: number; count: number; mode: string; location: string };
export default function AvailabilityDialog({ initialStart, initialMinutes = 60, initialMode = "online", initialLocation = "", editing = false, busy, message, onClose, onSave, onRemove }: {
  initialStart: string; initialMinutes?: number; initialMode?: string; initialLocation?: string;
  editing?: boolean; busy: boolean; message: string; onClose: () => void;
  onSave: (input: AvailabilityInput) => void; onRemove?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [start, setStart] = useState(initialStart), [minutes, setMinutes] = useState(initialMinutes),
    [count, setCount] = useState(1), [mode, setMode] = useState(initialMode),
    [location, setLocation] = useState(initialLocation), [error, setError] = useState("");
  const end = meetingEnd(start, minutes, count);
  useEffect(() => {
    const el = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => { el?.close(); previous?.focus(); };
  }, []);
  function validate() {
    if (editing) {
      if (!end || Date.parse(start + "-03:00") <= Date.now()) return "Escolha um início futuro e uma duração válida.";
      if (minutes > 480) return "Cada reunião pode ter no máximo oito horas.";
    } else {
      const invalid = availabilityError(start, end, minutes);
      if (invalid) return invalid;
    }
    if (mode === "presencial" && !location.trim()) return "Informe o endereço do atendimento presencial.";
    return "";
  }
  return createPortal(
    <dialog ref={dialog} className="availability-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <form className="availability-form" onSubmit={(event) => {
        event.preventDefault(); const invalid = validate(); setError(invalid);
        if (!invalid) onSave({ start, end, minutes, count, mode, location: mode === "presencial" ? location.trim() : "" });
      }}>
        <header className="availability-heading">
          <div><span className="eyebrow"><CalendarClock size={18} /> Agenda HAS</span>
            <h3 id={titleId}>{editing ? "Editar horário" : "Disponibilizar horário"}</h3>
            <p>Horário de Brasília · {editing ? "Altere um horário ainda livre." : "Escolha o início e a duração da reunião."}</p></div>
          <button type="button" className="btn" aria-label="Fechar janela de horário" disabled={busy} onClick={onClose}><X size={19} /></button>
        </header>
        <fieldset disabled={busy} className="availability-fields">
          <div className="form-grid">
            <label>Data e hora de início<input type="datetime-local" required value={start} onChange={(e) => { setStart(e.target.value); setError(""); }} /></label>
            <label>Duração da reunião<select value={minutes} onChange={(e) => { setMinutes(Number(e.target.value)); setError(""); }}>
              {Array.from(new Set([15,30,45,60,90,120, ...(editing ? [initialMinutes] : [])])).sort((a,b) => a-b).map((n) => <option key={n} value={n}>{n} minutos</option>)}
            </select></label>
            {!editing && <label>Horários consecutivos<select value={count} onChange={(e) => { setCount(Number(e.target.value)); setError(""); }}>
              {Array.from({ length: 12 }, (_,i) => i+1).map((n) => <option key={n} value={n}>{n === 1 ? "Apenas uma reunião" : `${n} reuniões`}</option>)}
            </select></label>}
            <label>Modalidade<select value={mode} onChange={(e) => { setMode(e.target.value); setError(""); }}><option value="online">Online — Google Meet</option><option value="presencial">Presencial</option></select></label>
            {mode === "presencial" && <label className="availability-location">Endereço do atendimento<input required maxLength={500} value={location} onChange={(e) => setLocation(e.target.value)} /></label>}
          </div>
          <div className="availability-summary" aria-live="polite">
            <span>{count === 1 ? "Término da reunião" : "Término do último horário"}</span>
            <strong>{end ? new Date(end + "-03:00").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "Preencha o início"}</strong>
            <small>{count > 1 ? `${count} horários de ${minutes} minutos, sem intervalo entre eles.` : "Calculado automaticamente pela duração escolhida."}</small>
          </div>
        </fieldset>
        {(error || message) && <p role="alert" className="availability-feedback">{error || message}</p>}
        <footer className="availability-actions">
          {onRemove && <button type="button" className="btn danger-text" disabled={busy} onClick={onRemove}>Remover horário</button>}
          <button type="button" className="btn" disabled={busy} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : count > 1 ? `Disponibilizar ${count} horários` : "Disponibilizar horário"}</button>
        </footer>
      </form>
    </dialog>, document.body,
  );
}
