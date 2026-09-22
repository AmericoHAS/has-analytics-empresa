"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { lifecycle, type LifecycleFacts } from "@/lib/workspace/lifecycle";
export function useLifecycle(clientId: string, projectId?: string) {
  const [items, setItems] = useState<
    {
      id: string;
      title: string;
      state: ReturnType<typeof lifecycle>;
      facts: LifecycleFacts;
    }[]
  >([]);
  useEffect(() => {
    let alive = true;
    let sequence = 0;
    async function load() {
      const request = ++sequence;
      const { data, error } = await supabase.rpc("client_lifecycle", {
        p_client: clientId,
        p_project: projectId ?? null,
      });
      if (!error && alive && request === sequence)
        setItems(
          (data ?? []).map(
            (p: { id: string; title: string; facts: LifecycleFacts }) => ({
              ...p,
              state: lifecycle(p.facts),
            }),
          ),
        );
    }
    void load();
    const t = setInterval(() => void load(), 15000);
    window.addEventListener("has-workflow-updated", load);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("has-workflow-updated", load);
      window.removeEventListener("focus", load);
    };
  }, [clientId, projectId]);
  return items;
}
