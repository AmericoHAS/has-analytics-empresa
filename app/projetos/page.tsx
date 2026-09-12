import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProjectRail } from "@/components/ProjectRail";
import { Comments } from "@/components/Comments";
import { getPublishedProjects } from "@/lib/projects-db";

export default async function Projetos() {
  const projects = await getPublishedProjects();

  return (
    <>
      <Header />

      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow light">
              Portfólio
            </span>

            <h1>
              Projetos que unem método e aplicação.
            </h1>

            <p>
              Produções acadêmicas, consultorias e soluções digitais
              desenvolvidas pela HAS Analytics.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <ProjectRail projects={projects} />
          </div>
        </section>

        <section className="section tint">
          <div className="container">
            <Comments />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}