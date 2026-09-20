"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
export default function WorkflowOverview({
  clientId,
  admin,
  onNavigate,
}: {
  clientId: string;
  admin: boolean;
  onNavigate: (tab: string) => void;
}) {
  const [counts, setCounts] = useState({
      proposals: 0,
      signatures: 0,
      contracts: 0,
      payments: 0,
    }),
    [profile, setProfile] = useState(true);
  useEffect(() => {
    let alive = true;
    async function load() {
      const [d, p, c] = await Promise.all([
        supabase
          .from("commercial_documents")
          .select("budget_id,status,signature_status,kind")
          .eq("client_id", clientId)
          .neq("status", "substituido"),
        supabase
          .from("budget_payments")
          .select("status")
          .eq("client_id", clientId),
        supabase
          .from("client_billing_profiles")
          .select("client_id")
          .eq("client_id", clientId)
          .maybeSingle(),
      ]);
      if (!alive) return;
      setProfile(!!c.data);
      setCounts({
        proposals: new Set(
          (d.data ?? [])
            .filter(
              (v) =>
                v.kind === "orcamento" &&
                v.status === (admin ? "rascunho" : "enviado"),
            )
            .map((v) => v.budget_id),
        ).size,
        contracts: (d.data ?? []).filter(
          (v) =>
            v.kind === "contrato" && ["enviado", "rascunho"].includes(v.status),
        ).length,
        signatures: (d.data ?? []).filter((v) =>
          admin
            ? v.kind === "orcamento" && v.signature_status === "recebida"
            : v.kind === "orcamento" &&
              v.status === "aprovado" &&
              ["pendente", "rejeitada"].includes(v.signature_status),
        ).length,
        payments: (p.data ?? []).filter((v) =>
          admin
            ? ["solicitado", "em_conferencia"].includes(v.status)
            : ["assinatura", "aguardando_pagamento", "rejeitado"].includes(
                v.status,
              ),
        ).length,
      });
    }
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [clientId, admin]);
  return (
    <section className="workflow-overview">
      <div>
        <span className="eyebrow">Um passo de cada vez</span>
        <h2>
          {admin ? "O que precisa da sua atenção" : "Seus próximos passos"}
        </h2>
      </div>
      <div className="workflow-steps">
        {[
          ["orcamentos", "01", "Proposta e assinatura"],
          ["pagamentos", "02", "Pagamento"],
          ["documentos", "03", "Envio dos dados"],
          ["projetos", "04", "Análise e resultados"],
        ].map(([tab, n, label]) => (
          <button key={tab} onClick={() => onNavigate(tab)}>
            <b>{n}</b>
            <span>{label}</span>
            <span aria-hidden>↗</span>
          </button>
        ))}
      </div>
      <div className="attention-row">
        {!profile &&
          (admin ? (
            <button onClick={() => onNavigate("cadastro")}>
              Completar cadastro do cliente
            </button>
          ) : (
            <Link href="/area-cliente?secao=perfil">
              Complete seu perfil para os documentos →
            </Link>
          ))}
        {counts.proposals > 0 && (
          <button onClick={() => onNavigate("orcamentos")}>
            {admin ? "Documentos em rascunho" : "Propostas para conferir"} ·{" "}
            {counts.proposals}
          </button>
        )}
        {counts.signatures > 0 && (
          <button onClick={() => onNavigate("orcamentos")}>
            Assinaturas de propostas · {counts.signatures}
          </button>
        )}
        {counts.contracts > 0 && (
          <button onClick={() => onNavigate("contratos")}>
            Contratos para conferir · {counts.contracts}
          </button>
        )}
        {counts.payments > 0 && (
          <button onClick={() => onNavigate("pagamentos")}>
            Pagamento requer atenção · {counts.payments}
          </button>
        )}
        {profile && !Object.values(counts).some(Boolean) && (
          <span>
            Nenhuma pendência identificada. Acompanhe as etapas abaixo.
          </span>
        )}
      </div>
    </section>
  );
}
