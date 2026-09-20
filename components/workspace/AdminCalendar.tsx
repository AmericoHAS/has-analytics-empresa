"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Consultations from "./Consultations";
export default function AdminCalendar() {
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    void (async () => {
      const [p, c] = await Promise.all([
        supabase.from("client_projects").select("id,title,client_id"),
        supabase.from("profiles").select("id,full_name"),
      ]);
      setProjects(
        (p.data ?? []).map((v) => ({
          id: v.id,
          title: `${c.data?.find((c) => c.id === v.client_id)?.full_name ?? "Cliente"} · ${v.title}`,
        })),
      );
    })();
  }, []);
  return <Consultations clientId="" projects={projects} admin />;
}
