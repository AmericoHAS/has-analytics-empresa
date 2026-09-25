import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { preparePdfRuntime, graphicsFiles } from '../scripts/prepare-pdf-runtime.mjs';

test('build prepares executable outside runtime tmp and replaces stale assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'has-pdf-build-test-'));
  try {
    const bin = join(root,'node_modules','@sparticuz','chromium','bin');
    await mkdir(bin,{recursive:true});
    await copyFile(join(process.cwd(),'node_modules/@sparticuz/chromium/bin/swiftshader.tar.br'),join(bin,'swiftshader.tar.br'));
    const bytes=Buffer.concat([Buffer.from([0x7f,0x45,0x4c,0x46]),Buffer.from('fixture-one')]);
    await writeFile(join(bin,'chromium.br'),brotliCompressSync(bytes));
    const executable=await preparePdfRuntime(root);
    assert.equal(executable,join(root,'.has-pdf-runtime','chromium'));
    assert.deepEqual(await readFile(executable),bytes);
    const next=Buffer.concat([bytes,Buffer.from('-updated')]);
    await writeFile(join(bin,'chromium.br'),brotliCompressSync(next));
    await preparePdfRuntime(root);
    assert.deepEqual(await readFile(executable),next);
    if(process.platform!=='win32') assert.equal((await stat(executable)).mode&0o777,0o755);
    await writeFile(join(bin,'chromium.br'),brotliCompressSync(Buffer.from('invalid')));
    await assert.rejects(preparePdfRuntime(root),/inválido/);
    assert.deepEqual(await readFile(executable),next);
    assert.deepEqual((await readdir(join(root,'.has-pdf-runtime'))).sort(),['chromium',...graphicsFiles].sort());
    const icd=JSON.parse(await readFile(join(root,'.has-pdf-runtime/vk_swiftshader_icd.json'),'utf8'));
    assert.ok((await stat(join(root,'.has-pdf-runtime',icd.ICD.library_path))).size>0);
  } finally { assert.equal(dirname(resolve(root)),resolve(tmpdir())); assert.ok(basename(root).startsWith('has-pdf-build-test-')); await rm(root,{recursive:true,force:true}); }
});
