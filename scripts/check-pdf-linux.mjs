// Linux build gate: exercise the actual renderer, without accounts or network.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PDFDocument } from 'pdf-lib';
const require = createRequire(import.meta.url);
function load(file) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('exports', 'require', 'Buffer', code)(exports, id => {
    if (['./pdf-runtime', './pdf-print'].includes(id)) return load(`lib/commercial/${id.slice(2)}.ts`);
    return require(id);
  }, Buffer);
  return exports;
}
if (process.platform !== 'linux') {
  console.info('[HAS_PDF_LINUX_CHECK] Skipped: Linux runtime required; Windows is not production validation.');
} else {
  const { hasTemplatePdf } = load('lib/commercial/template-engine.ts');
  for (const kind of ['orcamento', 'contrato', 'recibo']) {
    // Official blank templates only. No client data, database, email or publication.
    const pdf = await hasTemplatePdf(readFileSync(`templates/has/modelo_${kind}_HAS.docx`), kind);
    const parsed = await PDFDocument.load(pdf);
    if (!parsed.getPageCount()) throw Error(`PDF Linux vazio: ${kind}`);
    console.info('[HAS_PDF_LINUX_CHECK]', {kind, pages: parsed.getPageCount(), bytes: pdf.length});
  }
}
