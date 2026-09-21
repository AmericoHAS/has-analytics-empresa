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
  id: string;
  starts_at: string;
  ends_at: string;
  mode: string;
  location: string;
  busy: boolean;
};
