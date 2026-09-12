const DAY = 86400000;
export function todayInBrazil(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function deadline(
  due: string | null,
  start: string | null,
  status: string,
  today = todayInBrazil(),
) {
  const closed = ["concluido", "cancelado"].includes(status);
  if (!due)
    return {
      days: null,
      percent: 0,
      tone: "neutral",
      label: closed ? "Encerrado" : "Prazo a definir",
    };
  const days = Math.round((Date.parse(due) - Date.parse(today)) / DAY);
  const duration = start ? (Date.parse(due) - Date.parse(start)) / DAY : 0;
  const percent =
    duration > 0
      ? Math.max(0, Math.min(100, Math.round((1 - days / duration) * 100)))
      : days <= 0
        ? 100
        : 0;
  return {
    days,
    percent,
    tone: closed
      ? "done"
      : days < 0
        ? "danger"
        : days <= 3
          ? "warning"
          : "normal",
    label: closed
      ? "Encerrado"
      : days < 0
        ? `${Math.abs(days)} dia(s) em atraso`
        : days === 0
          ? "Entrega hoje"
          : `${days} dia(s) restantes`,
  };
}
