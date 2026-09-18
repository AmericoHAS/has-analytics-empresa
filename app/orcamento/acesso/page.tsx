import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import QuoteRequest from "@/components/QuoteRequest";
export const metadata = {
  title: "Solicitar orçamento | HAS Analytics",
  description:
    "Conte seu projeto e crie seu acesso à área privada da HAS Analytics.",
};
export default function QuotePage() {
  return (
    <>
      <Header />
      <main className="quote-page">
        <div className="container quote-grid">
          <div>
            <span className="eyebrow">Vamos construir o próximo passo</span>
            <h1>
              Seu projeto começa
              <br />
              com uma boa pergunta.
            </h1>
            <p>
              Conte o que você precisa investigar ou desenvolver. Vamos avaliar
              a demanda e preparar uma proposta adequada ao seu contexto.
            </p>
            <ol className="quote-steps">
              <li>
                <strong>Crie seu acesso ou entre</strong>A mesma conta será
                usada para acompanhar seu projeto.
              </li>
              <li>
                <strong>Apresente sua demanda</strong>Objetivos, tipo de serviço
                e prazo desejado.
              </li>
              <li>
                <strong>Acompanhe a proposta</strong>Após a avaliação, consulte
                o orçamento e os documentos na área do cliente.
              </li>
            </ol>
            <p className="muted">
              A solicitação não gera cobrança nem confirma o prazo de entrega.
              Esses detalhes serão acordados na proposta.
            </p>
            <a
              className="text-link"
              href="https://wa.me/5544999554888"
              target="_blank"
              rel="noopener noreferrer"
            >
              Prefere conversar primeiro? Fale pelo WhatsApp ↗
            </a>
          </div>
          <QuoteRequest />
        </div>
      </main>
      <Footer />
    </>
  );
}
