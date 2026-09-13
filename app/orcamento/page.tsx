import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PublicExperience } from "@/components/public/PublicExperience";
import { BudgetForm } from "@/components/public/BudgetForm";
export const metadata: Metadata = {
  title: "Solicitar orçamento | HAS Analytics",
  description:
    "Conte seu projeto e solicite uma proposta de consultoria estatística, ciência de dados ou desenvolvimento digital.",
};
export default async function Orcamento({
  searchParams,
}: {
  searchParams: Promise<{ servico?: string }>;
}) {
  const { servico } = await searchParams;
  const initial = servico && /^[0-4]$/.test(servico) ? Number(servico) : 4;
  return (
    <PublicExperience>
      <Header />
      <main>
        <section className="page-hero budget-hero">
          <div className="container">
            <span className="eyebrow light">VAMOS DAR O PRIMEIRO PASSO</span>
            <h1>
              Sua ideia começa
              <br />
              com uma conversa.
            </h1>
            <p>
              Conte o contexto. Vamos entender o que você precisa e construir
              uma proposta com escopo, entregas e prazos claros.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="container budget-layout">
            <div className="budget-guidance" data-reveal>
              <span className="eyebrow">Do primeiro contato à entrega</span>
              <h2>
                Um só pedido.
                <br />
                Um caminho organizado.
              </h2>
              <ol>
                <li>
                  <strong>Apresente sua demanda.</strong>
                  <br />
                  Objetivo, etapa atual e o que espera receber.
                </li>
                <li>
                  <strong>Alinhamos a proposta.</strong>
                  <br />
                  Conversamos sobre escopo, viabilidade e prazos.
                </li>
                <li>
                  <strong>Acompanhe seu projeto.</strong>
                  <br />
                  Após a liberação do acesso, consulte os materiais
                  disponibilizados na área do cliente.
                </li>
              </ol>
              <p>
                Não é necessário enviar arquivos ou criar uma senha nesta etapa.
              </p>
            </div>
            <BudgetForm initialService={initial} />
          </div>
        </section>
      </main>
      <Footer />
    </PublicExperience>
  );
}
