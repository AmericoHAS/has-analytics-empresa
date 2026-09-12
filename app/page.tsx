import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProjectRail } from "@/components/ProjectRail";
import { Comments } from "@/components/Comments";
import { getFeaturedProjects } from "@/lib/projects-db";

export default async function Home() {
  const projects = await getFeaturedProjects(3);


  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow light">
              Estatística aplicada · ciência de dados · tecnologia
            </span>

            <h1>
              Dados que explicam.
              <br />
              Soluções que avançam.
            </h1>

            <p>
              A HAS Analytics transforma demandas científicas e
              profissionais em análises confiáveis, produtos digitais
              organizados e decisões mais claras.
            </p>

            <div className="actions">
              <Link
                className="btn primary"
                href="/#orcamento"
              >
                Solicitar orçamento
              </Link>

              <Link
                className="btn ghost"
                href="/projetos"
              >
                Conhecer projetos
              </Link>
            </div>
          </div>
        </section>

        <section
          id="servicos"
          className="section"
        >
          <div className="container">
            <span className="eyebrow">
              Serviços
            </span>

            <h2>
              Do problema à entrega.
            </h2>

            <div className="cards">
              <article>
                <b>01</b>

                <h3>
                  Consultoria estatística
                </h3>

                <p>
                  Planejamento, análise em R, modelos,
                  visualização e apoio à produção científica.
                </p>
              </article>

              <article>
                <b>02</b>

                <h3>
                  Ciência de dados
                </h3>

                <p>
                  Tratamento de bases, indicadores e painéis
                  para apoiar decisões.
                </p>
              </article>

              <article>
                <b>03</b>

                <h3>
                  Desenvolvimento digital
                </h3>

                <p>
                  Sites, ferramentas administrativas e soluções
                  personalizadas.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section tint">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  Projetos
                </span>

                <h2>
                  Trabalhos em destaque.
                </h2>
              </div>

              <Link
                className="text-link"
                href="/projetos"
              >
                Ver todos →
              </Link>
            </div>

            <ProjectRail projects={projects} />
          </div>
        </section>

        <section className="section">
          <div className="container">
            <Comments />
          </div>
        </section>

        <section
          id="orcamento"
          className="cta"
        >
          <div className="container">
            <h2>
              Vamos estruturar o seu projeto?
            </h2>

            <p>
              Envie as informações iniciais para avaliarmos o
              escopo da demanda.
            </p>

            <Link
              className="btn primary"
              href="mailto:contato@hasanalytics.com.br"
            >
              Solicitar orçamento
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}