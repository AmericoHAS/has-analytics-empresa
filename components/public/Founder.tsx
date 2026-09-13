"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { publicContact } from "@/lib/public-site";
export function Founder() {
  const [missing, setMissing] = useState(false);
  return (
    <section className="section founder-section" id="sobre" data-reveal>
      <div className="container founder-grid">
        <div className="founder-photo">
          {missing ? (
            <div className="founder-placeholder">
              <Image
                src="/logo-has.analytics.png"
                width={240}
                height={240}
                alt="HAS Analytics"
              />
              <span>Haward Antunny</span>
            </div>
          ) : (
            <Image
              src={publicContact.photo}
              alt="Haward Antunny, à frente da HAS Analytics"
              fill
              sizes="(max-width: 760px) 90vw, 45vw"
              onError={() => setMissing(true)}
              unoptimized
            />
          )}
          <div className="founder-signature">
            Haward Antunny<small>À frente da HAS Analytics</small>
          </div>
        </div>
        <div>
          <span className="eyebrow">Quem está por trás das soluções</span>
          <h2>
            Proximidade no atendimento.
            <br />
            <em>Rigor na entrega.</em>
          </h2>
          <p>
            Sou Haward Antunny. Na HAS Analytics, conecto estatística aplicada,
            pesquisa e desenvolvimento digital para transformar perguntas em
            caminhos de trabalho claros.
          </p>
          <p>
            Essa atuação passa por dados experimentais, estudos em saúde e
            ciências agrárias, produção científica e ferramentas para educação e
            gestão. O ponto de partida é sempre o mesmo: entender o contexto
            antes de escolher o método.
          </p>
          <p>
            Você conversa com quem acompanha o projeto — do entendimento da
            demanda à interpretação e apresentação dos resultados.
          </p>
          <a
            className="text-link"
            href={publicContact.profile}
            target="_blank"
            rel="noopener noreferrer"
          >
            Conheça minha trajetória e meu perfil pessoal{" "}
            <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
