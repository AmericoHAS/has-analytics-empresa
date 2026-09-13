import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ChartNoAxesCombined,
  FlaskConical,
  Code2,
  MessageCircle,
  BookOpen,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProjectRail } from "@/components/ProjectRail";
import { Comments } from "@/components/Comments";
import { getFeaturedProjects } from "@/lib/projects-db";
import { PublicExperience } from "@/components/public/PublicExperience";
import { BrandOrbit } from "@/components/public/BrandOrbit";
import { ProjectExplorer } from "@/components/public/ProjectExplorer";
import { Founder } from "@/components/public/Founder";
import { publicContact } from "@/lib/public-site";
const services = [
  {
    icon: FlaskConical,
    title: "Consultoria estatística",
    copy: "Do desenho do estudo ao modelo adequado. Análises em R, dados experimentais, modelos mistos e não lineares, com interpretação contextualizada.",
    detail: "Para pesquisas, artigos e estudos aplicados.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Ciência de dados e indicadores",
    copy: "Organização e exploração de bases, visualizações e painéis que dão visibilidade aos dados e apoiam decisões fundamentadas.",
    detail: "Para transformar informação dispersa em clareza.",
  },
  {
    icon: Code2,
    title: "Desenvolvimento digital",
    copy: "Sites, ferramentas de gestão e ambientes de acompanhamento desenhados em torno das necessidades reais de cada projeto.",
    detail: "Para conectar processos, pessoas e informação.",
  },
  {
    icon: BookOpen,
    title: "Comunicação e educação",
    copy: "Relatórios, gráficos e experiências interativas que tornam o conhecimento mais compreensível, explorável e utilizável.",
    detail: "Para apresentar resultados e ampliar a compreensão.",
  },
];
export default async function Home() {
  const projects = await getFeaturedProjects(6);
  return (
    <PublicExperience>
      <Header />
      <main>
        <section className="hero enterprise-hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow light">
                ESTATÍSTICA APLICADA · CIÊNCIA DE DADOS · TECNOLOGIA
              </span>
              <h1>
                Dados que
                <br />
                explicam.
                <br />
                <em>
                  Soluções que
                  <br />
                  avançam.
                </em>
              </h1>
              <p>
                Da pergunta de pesquisa ao produto digital: método para
                analisar, clareza para interpretar e tecnologia para colocar
                ideias em prática.
              </p>
              <div className="actions">
                <Link className="btn primary" href="/orcamento">
                  Vamos estruturar seu projeto <ArrowUpRight size={18} />
                </Link>
                <a
                  className="btn ghost"
                  href={publicContact.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={18} />
                  Falar com o especialista
                </a>
              </div>
              <div className="hero-footnote">
                <span />
                Atendimento próximo. Escopo definido. Entregas com propósito.
              </div>
            </div>
            <BrandOrbit />
          </div>
          <a href="#servicos" className="hero-scroll">
            Explore as possibilidades <span>↓</span>
          </a>
        </section>
        <div className="expertise-strip">
          <div className="container">
            <span>Pesquisa aplicada</span>
            <i>✦</i>
            <span>Modelagem em R</span>
            <i>✦</i>
            <span>Visualização de dados</span>
            <i>✦</i>
            <span>Produtos digitais</span>
          </div>
        </div>
        <section
          id="servicos"
          className="section solutions-section"
          data-reveal
        >
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">O que podemos construir juntos</span>
                <h2>
                  O método encontra
                  <br />
                  <em>a sua necessidade.</em>
                </h2>
              </div>
              <p>
                Projetos diferentes exigem perguntas diferentes. Unimos análise,
                interpretação e desenvolvimento para encontrar uma entrega
                coerente com o seu objetivo.
              </p>
            </div>
            <div className="service-grid">
              {services.map(({ icon: Icon, title, copy, detail }, index) => (
                <article className="service-card" key={title}>
                  <div className="service-card-top">
                    <Icon />
                    <span>0{index + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <small>{detail}</small>
                  <Link
                    href={`/orcamento?servico=${index}`}
                    aria-label={`Solicitar orçamento para ${title}`}
                  >
                    <ArrowUpRight />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
        <ProjectExplorer />
        <section className="section public-projects" data-reveal>
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Conhecimento em movimento</span>
                <h2>
                  Projetos que dão
                  <br />
                  forma à nossa atuação.
                </h2>
              </div>
              <Link className="text-link" href="/projetos">
                Explorar portfólio <ArrowRight size={18} />
              </Link>
            </div>
            <p className="section-intro">
              Pesquisa em saúde e ciências agrárias, modelagem estatística e
              experiências digitais para educação e gestão. Conheça os
              contextos, métodos e propostas de cada trabalho.
            </p>
            <ProjectRail projects={projects} />
          </div>
        </section>
        <section className="section method-section" data-reveal>
          <div className="container">
            <span className="eyebrow">Como o projeto acontece</span>
            <h2>
              Você sabe onde está.
              <br />
              <em>E qual é o próximo passo.</em>
            </h2>
            <div className="method-grid">
              {[
                [
                  "Escuta",
                  "Você conta seu objetivo, a etapa atual e o que precisa resolver.",
                ],
                [
                  "Proposta",
                  "Alinhamos escopo, entregas e prazos antes de iniciar.",
                ],
                [
                  "Desenvolvimento",
                  "Organizamos dados, construímos análises ou desenvolvemos a solução.",
                ],
                [
                  "Entrega e diálogo",
                  "Apresentamos o trabalho e esclarecemos como utilizar os resultados.",
                ],
              ].map(([title, copy], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <div className="client-note">
              <span>SEU PROJETO, ORGANIZADO</span>
              <p>
                A solicitação de orçamento já inclui o pedido de acesso à área
                do cliente, onde você poderá acompanhar os materiais
                disponibilizados durante o atendimento.
              </p>
              <Link className="text-link" href="/orcamento">
                Começar pelo orçamento <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
        <Founder />
        <section className="section testimonials-section" data-reveal>
          <div className="container">
            <Comments />
          </div>
        </section>
        <section className="section faq-section" data-reveal>
          <div className="container faq-grid">
            <div>
              <span className="eyebrow">Antes de começar</span>
              <h2>
                Uma boa parceria
                <br />
                começa com clareza.
              </h2>
              <a
                className="text-link"
                href={publicContact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Converse sobre sua demanda <MessageCircle size={18} />
              </a>
            </div>
            <div>
              {[
                [
                  "Preciso ter todos os dados organizados?",
                  "Não. Conte em que etapa você está. A organização da base e o planejamento da análise podem fazer parte do escopo.",
                ],
                [
                  "O orçamento já cria uma conta?",
                  "O formulário reúne a demanda e a solicitação de acesso. A liberação da área do cliente é feita durante o atendimento, após a conferência dos dados.",
                ],
                [
                  "Como são definidos prazos e valores?",
                  "Após entender o objetivo, os dados ou funcionalidades e as entregas esperadas, apresentamos uma proposta específica para o projeto.",
                ],
                [
                  "Vocês atendem somente pesquisas acadêmicas?",
                  "A atuação também inclui indicadores, ferramentas de gestão, sites e experiências digitais. O portfólio mostra diferentes aplicações dessa combinação entre dados e tecnologia.",
                ],
              ].map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section id="orcamento" className="cta enterprise-cta">
          <div className="container">
            <span className="eyebrow light">
              A PRÓXIMA IDEIA PODE SER A SUA
            </span>
            <h2>
              Uma pergunta.
              <br />
              Muitas possibilidades.
              <br />
              <em>Vamos conversar?</em>
            </h2>
            <p>
              Conte o que você precisa construir. O primeiro passo é entender o
              seu projeto.
            </p>
            <div className="actions">
              <Link className="btn primary" href="/orcamento">
                Solicitar orçamento <ArrowUpRight size={18} />
              </Link>
              <a
                className="btn ghost"
                href={publicContact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar pelo WhatsApp <MessageCircle size={18} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </PublicExperience>
  );
}
