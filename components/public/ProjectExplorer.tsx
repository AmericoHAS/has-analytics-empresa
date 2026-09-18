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
      "Dispersão de observações simuladas e curva de tendência média ilustrativa; não representa resultados de clientes.",
  },
  {
    name: "Soluções digitais",
    title: "Da necessidade real a uma ferramenta que funciona.",
    text: "Sites, ambientes de acompanhamento e experiências educacionais. Cada interface nasce de um fluxo de uso: o que a pessoa precisa fazer, entender e acompanhar.",
    tags: ["Sistemas web", "Educação", "Experiência de uso"],
    values: [15, 27, 41, 56, 64, 79, 86, 100],
    axis: "Cenários ilustrativos",
    caption:
      "Boxplots com dados simulados: a caixa mostra quartis, a linha central indica a mediana e as hastes mostram a amplitude sem os pontos extremos e os pontos isolados ilustram outliers; não são métricas de clientes.",
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
              {active === 2 ? (
                <g>
                  {[
                    [80, 45, 80, 120, 155, 190],
                    [210, 65, 100, 135, 170, 215],
                    [340, 30, 65, 95, 140, 180],
                    [470, 55, 90, 115, 150, 205],
                  ].map(([x, top, q3, median, q1, bottom], i) => (
                    <g
                      key={x}
                      className="boxplot-group"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <title>{`Cenário ${i + 1}: distribuição simulada`}</title>
                      <path
                        d={`M${x} ${top}V${bottom} M${x - 15} ${top}H${x + 15} M${x - 15} ${bottom}H${x + 15}`}
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <rect
                        x={x - 27}
                        y={q3}
                        width="54"
                        height={q1 - q3}
                        fill="#164b69"
                        stroke="currentColor"
                        strokeWidth="2"
                        rx="4"
                      />
                      <path
                        d={`M${x - 27} ${median}H${x + 27}`}
                        stroke="#fff"
                        strokeWidth="3"
                      />
                      {[top - 16, bottom + 14].map((y, n) => (
                        <circle key={n} cx={x + (n ? 4 : -3)} cy={y} r="3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <title>Outlier ilustrativo</title>
                        </circle>
                      ))}
                      <text
                        x={x}
                        y="252"
                        textAnchor="middle"
                        fill="currentColor"
                        fontSize="12"
                      >
                        {String.fromCharCode(65 + i)}
                      </text>
                    </g>
                  ))}
                </g>
              ) : active === 1 ? (
                <g>
                  {Array.from({ length: 32 }, (_, i) => {
                    const x = 42 + i * 15;
                    const mean = 211 - 0.29 * (x - 42) + 13 * Math.sin((x - 42) / 95);
                    return <circle key={i} className="boxplot-group" style={{ animationDelay: `${i * 0.025}s` }} cx={x} cy={mean + [19, -24, 8, -12, 27, -5, -20, 14][i % 8]} r="4.5" fill="currentColor" opacity=".65"><title>Observação simulada</title></circle>;
                  })}
                  <polyline className="animated-line" points={Array.from({length: 97}, (_, i) => {const x = 42 + i * 5; return `${x},${211 - 0.29 * (x - 42) + 13 * Math.sin((x - 42) / 95)}`;}).join(" ")} fill="none" stroke="#fff" strokeWidth="3" pathLength="1" />
                  <text x="330" y="30" fill="#fff" fontSize="12">— Tendência média ilustrativa</text>
                </g>
              ) : (
                <>
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
                </>
              )}
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
