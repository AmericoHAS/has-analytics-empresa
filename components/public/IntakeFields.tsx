import { intakeFields, intakeOptions } from "@/lib/commercial/intake";
export default function IntakeFields() {
  return (
    <fieldset className="project-metadata-fields intake-fields">
      <legend>Contexto da pesquisa</legend>
      <div className="form-grid">
        {intakeFields.map(([name, label]) => (
          <label key={name}>
            {label}
            {intakeOptions[name] ? (
              <select name={name}>
                <option value="">A definir</option>
                {intakeOptions[name].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            ) : (
              <input name={name} maxLength={250} />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
