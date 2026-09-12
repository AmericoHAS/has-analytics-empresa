import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientWorkspace from "@/components/workspace/ClientWorkspace";
import SignOut from "@/components/workspace/SignOut";
export default async function ClientArea() {
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
      <aside>
        <strong>
          HAS<span>ANALYTICS</span>
        </strong>
        <small>SEU ESPAÇO DE PESQUISA</small>
        <Link className="active" href="/area-cliente">
          Meu acompanhamento
        </Link>
        <Link href="/">Site HAS Analytics</Link>
        <SignOut />
      </aside>
      <section>
        <header className="dashboard-hero">
          <span className="eyebrow">Área privada do cliente</span>
          <h1>Olá, {data?.full_name?.split(" ")[0] ?? "bem-vindo"}.</h1>
          <p>
            Sua pesquisa, acompanhada de perto.
            <br />
            Arquivos, resultados e próximos passos em um único lugar.
          </p>
          <span className="secure-badge">Acesso privado · HAS Analytics</span>
        </header>
        <ClientWorkspace clientId={user.id} />
      </section>
    </main>
  );
}
