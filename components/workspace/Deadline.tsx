"use client";
import { useEffect, useState } from "react";
import { deadline, todayInBrazil } from "@/lib/workspace/deadlines";
export default function Deadline({
  due,
  start,
  status,
  label = "Prazo de entrega",
}: {
  due: string | null;
  start: string | null;
  status: string;
  label?: string;
}) {
  const [today, setToday] = useState(todayInBrazil);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInBrazil()), 60000);
    return () => clearInterval(timer);
  }, []);
  const d = deadline(due, start, status, today);
  return (
    <div className={`deadline ${d.tone}`}>
      <div className="row">
        <small>{label}</small>
        <strong>{d.label}</strong>
      </div>
      <progress
        aria-label={`${label}: tempo decorrido`}
        max={100}
        value={d.percent}
      />
      <small>
        {due
          ? new Date(due + "T12:00:00").toLocaleDateString("pt-BR")
          : "Combine uma data para acompanhar o prazo"}
      </small>
    </div>
  );
}
