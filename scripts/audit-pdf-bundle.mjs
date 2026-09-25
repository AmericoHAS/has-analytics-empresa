import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
async function walk(directory) {
  const result=[];
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const file=join(directory,entry.name);
    result.push(...(entry.isDirectory()?await walk(file):[file]));
  }
  return result;
}
const target='/api/admin/commercial-documents/route.js.nft.json';
let found=false;
for(const trace of (await walk('.next/server')).filter(p=>p.endsWith('.nft.json'))) {
  const files=JSON.parse(await readFile(trace,'utf8')).files;
  const normalized=files.map(f=>f.replaceAll('\\','/'));
  const isPdf=trace.replaceAll('\\','/').endsWith(target);
  const heavy=normalized.filter(f=>/\.has-pdf-runtime|@sparticuz\/chromium|playwright-core|templates\/has|docx-preview/.test(f));
  if(!isPdf && heavy.length) throw Error(`Dependências PDF incluídas indevidamente: ${trace}`);
  if(isPdf) {
    found=true;
    if(normalized.some(f=>/templates\/has\/.*\.zip$/i.test(f))) throw Error('Cópias ZIP dos modelos incluídas no pacote PDF. Revise next.config.ts.');
    for(const suffix of ['.has-pdf-runtime/chromium','playwright-core/browsers.json','docx-preview/dist/docx-preview.min.js','jszip/dist/jszip.min.js','chromium/bin/fonts.tar.br','chromium/bin/al2023.tar.br','.has-pdf-runtime/libEGL.so','.has-pdf-runtime/libGLESv2.so','.has-pdf-runtime/libvk_swiftshader.so','.has-pdf-runtime/libvulkan.so.1','.has-pdf-runtime/vk_swiftshader_icd.json','templates/has/modelo_orcamento_HAS.docx','templates/has/modelo_contrato_HAS.docx','templates/has/modelo_recibo_HAS.docx']) {
      if(!normalized.some(f=>f.endsWith(suffix))) throw Error(`Arquivo obrigatório ausente: ${suffix}`);
    }
    if(normalized.some(f=>f.endsWith('chromium/bin/chromium.br'))) throw Error('Chromium duplicado: binário e arquivo comprimido.');
  }
  const resolved=[...new Set(files.map(f=>resolve(dirname(trace),f)))];
  const bytes=(await Promise.all(resolved.map(async f=>(await stat(f)).size))).reduce((a,b)=>a+b,0);
  console.info(`[HAS_FUNCTION_BUNDLE] ${trace.replaceAll('\\','/')} ${(bytes/1048576).toFixed(2)} MiB (${bytes} bytes)`);
  if(isPdf && bytes>250_000_000) {
    const largest=(await Promise.all(resolved.map(async file=>({ file:file.replaceAll('\\','/').replace(process.cwd().replaceAll('\\','/')+'/', ''), bytes:(await stat(file)).size })))).sort((a,b)=>b.bytes-a.bytes).slice(0,10);
    console.error('[HAS_FUNCTION_BUNDLE_LARGEST]', largest);
    throw Error(`Pacote PDF tem ${bytes} bytes (${(bytes/1048576).toFixed(2)} MiB); limite preventivo: 250000000 bytes. Revise os maiores arquivos acima.`);
  }
}
if(!found) throw Error('Rota dedicada do PDF ausente do build.');
