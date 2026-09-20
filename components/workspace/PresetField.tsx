"use client";
import { useState } from "react";
export const projectPresets: Record<string, string[]> = {
  department: [
    "Pesquisa acadêmica",
    "Pós-graduação",
    "Pesquisa e desenvolvimento",
    "Consultoria empresarial",
  ],
  research_area: [
    "Bioestatística",
    "Zootecnia",
    "Agronomia",
    "Ciências da saúde",
    "Ciências biológicas",
    "Gestão e negócios",
  ],
  data_assessment: [
    "Aguardando envio do banco",
    "Banco organizado e pronto para análise",
    "Necessita limpeza e padronização",
    "Necessita revisão das variáveis",
    "Dados incompletos — solicitar complementação",
  ],
  complexity: ["Baixa", "Moderada", "Alta", "Muito alta"],
  responsible: ["HAS Analytics", "Haward Américo"],
};
export default function PresetField({
  name,
  value = "",
  options,
}: {
  name: string;
  value?: string;
  options: string[];
}) {
  const [selected, setSelected] = useState(
      options.includes(value) || !value ? value : "__custom",
    ),
    [custom, setCustom] = useState(value);
  return (
    <>
      <select
        name={selected === "__custom" ? undefined : name}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">A definir</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
        <option value="__custom">Outro / personalizar…</option>
      </select>
      {selected === "__custom" && (
        <input
          name={name}
          aria-label="Texto personalizado"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={500}
        />
      )}
    </>
  );
}
