"use client";
import { useState } from "react";
const examples = [
  {
    name: "Pesquisa aplicada",
    title: "O comportamento dos dados também conta uma história.",
    text: "Curvas experimentais, medidas repetidas e diferenças entre grupos. A análise considera a pergunta da pesquisa e a estrutura dos dados — não apenas um teste isolado.",
    tags: ["Modelos não lineares", "Efeitos mistos", "Interpretação"],
    values: [12, 24, 42, 61, 75, 83, 88, 91],
    axis: "Etapas de observação",
    caption:
      "Exemplo ilustrativo de uma curva de resposta; não representa resultados de clientes.",
  },
  {
    name: "Dados para decidir",
    title: "Informação organizada para enxergar o que importa.",
    text: "Bases tratadas, indicadores definidos e visualizações que ajudam a comparar cenários. Painéis e relatórios aproximam a análise das decisões do dia a dia.",
    tags: ["Organização de bases", "Indicadores", "Painéis"],
    values: [36, 62, 47, 78, 59, 88, 70, 93],
    axis: "Indicadores ilustrativos",
    caption:
      "Valores simulados para demonstrar a apresentação visual de indicadores.",
  },
  {
    name: "Soluções digitais",
    title: "Da necessidade real a uma ferramenta que funciona.",
    text: "Sites, ambientes de acompanhamento e experiências educacionais. Cada interface nasce de um fluxo de uso: o que a pessoa precisa fazer, entender e acompanhar.",
    tags: ["Sistemas web", "Educação", "Experiência de uso"],
    values: [15, 27, 41, 56, 64, 79, 86, 100],
    axis: "Etapas de uma entrega",
    caption:
      "Representação ilustrativa do percurso de desenvolvimento, sem métricas comerciais.",
  },
];
export function ProjectExplorer() {
  const [active, setActive] = useState(0);
  const item = examples[active];
  const points = item.values
    .map((value, index) => `${45 + index * 65},${230 - value * 1.9}`)
    .join(" ");
  return (
    <section className="section insight-section" data-reveal>
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Explore a nossa forma de pensar</span>
            <h2>
              Conhecimento que
              <br />
              ganha aplicação.
            </h2>
          </div>
          <p>
            Selecione uma frente e veja como ciência e tecnologia se encontram.
          </p>
        </div>
        <div
          className="explorer-tabs"
          role="tablist"
          aria-label="Frentes de atuação"
        >
          {examples.map((example, index) => (
            <button
              key={example.name}
              id={`explorer-tab-${index}`}
              role="tab"
              aria-selected={active === index}
              aria-controls="explorer-panel"
              tabIndex={active === index ? 0 : -1}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  const next =
                    (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                  setActive(next);
                  document.getElementById(`explorer-tab-${next}`)?.focus();
                }
              }}
              onClick={() => setActive(index)}
            >
              <span>0{index + 1}</span>
              {example.name}
            </button>
          ))}
        </div>
        <div
          className="explorer-panel"
          id="explorer-panel"
          role="tabpanel"
          aria-labelledby={`explorer-tab-${active}`}
        >
          <div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <div className="chips">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="demo-chart" key={active}>
            <div className="chart-heading">
              <span className="live-dot" />
              DA PERGUNTA À VISUALIZAÇÃO <small>DEMONSTRAÇÃO</small>
            </div>
            <svg
              viewBox="0 0 560 280"
              role="img"
              aria-label={`${item.name}: ${item.caption}`}
            >
              <g stroke="currentColor" opacity=".13">
                {[50, 100, 150, 200, 240].map((y) => (
                  <path key={y} d={`M30 ${y} H535`} />
                ))}
              </g>
              {item.values.map((value, index) => (
                <rect
                  className="animated-bar"
                  key={index}
                  x={30 + index * 65}
                  y={240 - value * 1.7}
                  width="28"
                  height={value * 1.7}
                  rx="5"
                  fill="currentColor"
                  opacity=".25"
                  style={{ animationDelay: `${index * 0.08}s` }}
                />
              ))}
              <polyline
                className="animated-line"
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                pathLength="1"
              />
              {item.values.map((value, index) => (
                <circle
                  key={index}
                  cx={45 + index * 65}
                  cy={230 - value * 1.9}
                  r="5"
                  fill="#071e3a"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <title>{`${value} · valor ilustrativo`}</title>
                </circle>
              ))}
              <text
                x="280"
                y="273"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
              >
                {item.axis}
              </text>
            </svg>
            <p>{item.caption}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
