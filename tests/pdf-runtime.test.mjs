import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const runtime = {};
new Function('exports','require',ts.transpileModule(readFileSync('lib/commercial/pdf-runtime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(runtime,require);
const {withPdfCapacity,recoverClosedBrowser,documentBrowserArgs,temporarySpaceMb} = runtime;

test('concurrent PDF requests serialize and rejection releases capacity', async () => {
  const order=[];
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const first=withPdfCapacity(async()=>{order.push('first'); await gate; throw Error('failed');});
  const rejection=assert.rejects(first,/failed/);
  const second=withPdfCapacity(async()=>{order.push('second');return 42;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(order,['first']);
  release();
  await rejection;
  assert.equal(await second,42);
  assert.deepEqual(order,['first','second']);
});
test('closed browser restarts once only after previous attempt has cleaned up',async()=>{
  const order=[];
  let calls=0;
  const result=await recoverClosedBrowser(async()=>{
    try{order.push('start');if(++calls===1)throw Error('page.pdf: Target page, context or browser has been closed');return 'pdf';}
    finally{order.push('closed');}
  },()=>order.push('retry'));
  assert.equal(result,'pdf');
  assert.deepEqual(order,['start','closed','retry','start','closed']);
});
test('persistent closed browser stops after one restart; other failures are not retried',async()=>{
  for(const [message,expected] of [['Target page, context or browser has been closed',2],['template missing',1]]){
    let calls=0;
    await assert.rejects(recoverClosedBrowser(async()=>{calls++;throw Error(message);},()=>{}));
    assert.equal(calls,expected);
  }
});
test('serverless arguments preserve the vendor process model and bound disk cache',()=>{
  const defaults=['--no-sandbox','--single-process','--in-process-gpu','--ignore-gpu-blocklist','--disable-webgl','--disk-cache-size=33554432'];
  const args=documentBrowserArgs(defaults);
  for(const flag of defaults.filter(flag=>!flag.startsWith('--disk-cache-size='))) assert.ok(args.includes(flag));
  assert.equal(args.filter(flag=>flag.startsWith('--disk-cache-size=')).length,1);
  assert.ok(args.includes('--disk-cache-size=1048576'));
  assert.ok(!args.includes('--disable-gpu'));
});
test('temporary space diagnostics return no filenames or document content',async()=>{
  const space=await temporarySpaceMb();
  assert.ok(space===null || Number.isFinite(space) && space>=0);
});
test('shared-memory selection is conditional on measured available space', () => {
  for (const space of [22, 30]) assert.equal(runtime.shouldUseSharedMemory(space, 63), true);
  for (const [temp,shared] of [[100,63],[22,null],[null,63],[22,10],[30,30],[22,47]]) {
    assert.equal(runtime.shouldUseSharedMemory(temp,shared), false);
  }
});
test('browser failure diagnostics expose fixed categories, never raw document data', () => {
  assert.equal(runtime.browserFailureSignal(Error('private text SIGBUS')), 'sigbus');
  assert.equal(runtime.browserFailureSignal(Error('private path ENOSPC')), 'disk_full');
  assert.equal(runtime.browserFailureSignal(Error('private text')), 'unknown');
});

test('Vulkan uses packaged drivers and preserves existing runtime libraries', () => {
  const original={LD_LIBRARY_PATH:'/tmp/al2023/lib',SAMPLE:'kept'};
  const env=runtime.pdfBrowserEnvironment('/app/.has-pdf-runtime',original);
  assert.equal(env.LD_LIBRARY_PATH,'/app/.has-pdf-runtime:/tmp/al2023/lib');
  assert.ok(env.VK_ICD_FILENAMES.endsWith('vk_swiftshader_icd.json'));
  assert.equal(env.VK_DRIVER_FILES,env.VK_ICD_FILENAMES);
  assert.equal(env.SAMPLE,'kept');
  assert.deepEqual(original,{LD_LIBRARY_PATH:'/tmp/al2023/lib',SAMPLE:'kept'});
});
