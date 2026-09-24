export function brazilDay(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function addDays(day: string, count: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function weekStart(day: string) {
  const d = new Date(day + "T12:00:00Z");
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}
export function availabilityError(
  start: string,
  end: string,
  minutes: number,
  now = Date.now(),
) {
  const a = Date.parse(start + "-03:00"),
    b = Date.parse(end + "-03:00");
  if (!Number.isFinite(a) || !Number.isFinite(b))
    return "Preencha início e fim do período.";
  if (a <= now) return "Escolha um horário futuro.";
  if (b <= a) return "O fim deve ser posterior ao início.";
  if (![15, 30, 45, 60, 90, 120].includes(minutes))
    return "Escolha a duração de cada reunião.";
  if (b - a > 86400000) return "Abra no máximo um dia por vez.";
  if ((b - a) % (minutes * 60000) !== 0)
    return "O período precisa comportar reuniões completas. Ajuste o fim ou a duração.";
  return "";
}
export type CalendarSlot = {
  bookingStatus?: string;
  id: string;
  starts_at: string;
  ends_at: string;
  mode: string;
  location: string;
  busy: boolean;
};

// Values used by datetime-local are explicitly Brasilia wall time, independent
// of the browser/computer timezone. Return an empty value while a field is blank.
export function meetingEnd(start: string, minutes: number, count = 1) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) ||
      !Number.isInteger(minutes) || minutes <= 0 ||
      !Number.isInteger(count) || count < 1 || minutes * count > 1440) return "";
  const parsed = Date.parse(start + "-03:00");
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed + minutes * count * 60000 - 3 * 3600000).toISOString().slice(0, 16);
}
export function nextMeetingStart(now = Date.now()) {
  const next = Math.ceil((now + 60000) / 1800000) * 1800000;
  return new Date(next - 3 * 3600000).toISOString().slice(0, 16);
}
