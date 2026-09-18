export type ProjectMetadata = {
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
        Situação da publicação
        <input
          name="publicationStatus"
          maxLength={120}
          defaultValue={project.publication_status ?? ""}
          placeholder="Ex.: Manuscrito em submissão"
        />
      </label>
      <label>
        Disponibilidade / observação do acesso
        <input
          name="availability"
          maxLength={200}
          defaultValue={project.availability ?? ""}
          placeholder="Ex.: Disponível após publicação"
        />
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
