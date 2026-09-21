import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";

import { publicContact } from "@/lib/public-site";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientWorkspace from "@/components/workspace/ClientWorkspace";
import ClientProfile from "@/components/workspace/ClientProfile";
import AccountAccess from "@/components/workspace/AccountAccess";
import PendingActions from "@/components/workspace/PendingActions";
export default async function ClientArea({
  searchParams,
}: {
  searchParams: Promise<{ secao?: string; aba?: string }>;
}) {
  const params = await searchParams;
  const section = params.secao;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  return (
    <main className="dashboard client-dashboard">
      <WorkspaceSidebar
        clientId={user.id}
        name={data?.full_name ?? "Meu perfil"}
        active={section === "perfil" ? "perfil" : "acompanhamento"}
        items={[
          {
            id: "acompanhamento",
            label: "Meu acompanhamento",
            href: "/area-cliente",
          },
          {
            id: "orcamento",
            label: "Solicitar orçamento",
            href: "/orcamento/acesso",
          },
        ]}
      />
      <section>
        <header className="dashboard-hero">
          <span className="eyebrow">Área privada do cliente</span>
          <h1>Olá, {data?.full_name?.split(" ")[0] ?? "bem-vindo"}.</h1>
          <p>
            Sua pesquisa, acompanhada de perto.
            <br />
            Arquivos, resultados e próximos passos em um único lugar.
          </p>
          <PendingActions clientId={user.id} />
          <span className="secure-badge">Acesso privado · HAS Analytics</span>
        </header>
        {section === "perfil" ? (
          <>
            <AccountAccess
              clientId={user.id}
              name={data?.full_name ?? "Meu perfil"}
              settings
            />
            <ClientProfile clientId={user.id} expanded />
          </>
        ) : (
          <ClientWorkspace
            clientId={user.id}
            initialTab={
              [
                "projetos",
                "contratos",
                "documentos",
                "orcamentos",
                "avisos",
              ].includes(params.aba ?? "")
                ? params.aba
                : "projetos"
            }
          />
        )}
      </section>
      <a
        className="client-whatsapp-float"
        aria-label="Falar com a HAS pelo WhatsApp"
        title="WhatsApp"
        href={publicContact.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
      >
        <WhatsAppIcon size={20} />
      </a>
    </main>
  );
}
