const publicationOptions = ["Em desenvolvimento", "Em preparação", "Manuscrito em submissão", "Em avaliação", "Aceito para publicação", "Publicado", "Concluído"];
const availabilityOptions = ["Disponível para acesso", "Acesso aberto", "Disponível após publicação", "Em breve", "Disponível mediante solicitação", "Acesso restrito", "Material confidencial"];
function MetadataSelect({name, value, options}: {name: string; value: string; options: string[]}) {
  return <select name={name} defaultValue={value}>
    <option value="">Não informar</option>
    {value && !options.includes(value) && <option value={value}>{value}</option>}
    {options.map(option => <option key={option} value={option}>{option}</option>)}
  </select>;
}
export type ProjectMetadata = {
  project_type?: string | null;
  publication_status?: string | null;
  availability?: string | null;
  researchers?: string[] | null;
};
export default function ProjectMetadataFields({
  project = {},
}: {
  project?: ProjectMetadata;
}) {
  return (
    <fieldset className="project-metadata-fields">
      <legend>Apresentação pública do projeto</legend>
      <label>
        Tipo de projeto / produção
        <input name="projectType" list="project-type-options" maxLength={80} defaultValue={project.project_type ?? ""} placeholder="Artigo, livro, aplicativo…" />
        <datalist id="project-type-options">
          {["Artigo científico", "Livro", "Capítulo de livro", "Dissertação", "Tese", "Relatório técnico", "Pesquisa", "Aplicativo", "Site", "Dashboard", "Material didático"].map(type => <option key={type} value={type} />)}
        </datalist>
        <small>Selecione uma sugestão ou escreva outro tipo.</small>
      </label>
      <label>
        Situação da publicação
        <MetadataSelect name="publicationStatus" value={project.publication_status ?? ""} options={publicationOptions} />
      </label>
      <label>
        Disponibilidade / observação do acesso
        <MetadataSelect name="availability" value={project.availability ?? ""} options={availabilityOptions} />
      </label>
      <label>
        Pesquisadores e colaboradores
        <textarea
          name="researchers"
          defaultValue={(project.researchers ?? []).join("\n")}
          placeholder="Um nome por linha; opcionalmente inclua a instituição."
          rows={4}
        />
      </label>
      <small>
        Informe apenas os nomes autorizados para divulgação. Esses campos
        aparecem ao abrir Ver mais.
      </small>
    </fieldset>
  );
}
