"use client";
import { BellRing } from "lucide-react";
import { useLifecycle } from "./useLifecycle";
export default function PendingActions({ clientId }: { clientId: string }) {
  const items = useLifecycle(clientId).filter((p) => p.state.pending);
  if (!items.length) return null;
  return (
    <div className="pending-actions" role="status">
      {items.slice(0, 3).map((p) => (
        <a href={`/area-cliente?aba=${p.state.tab}`} key={p.id}>
          <BellRing size={19} />
          <span>
            <strong>{p.state.label}</strong>
            <small>{p.title}</small>
          </span>
        </a>
      ))}
      {items.length > 3 && (
        <small>Mais {items.length - 3} pendências nos seus projetos</small>
      )}
    </div>
  );
}
