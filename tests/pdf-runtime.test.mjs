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
test('serverless arguments retain required flags without GPU acceleration or 32 MB cache',()=>{
  const args=documentBrowserArgs(['--no-sandbox','--single-process','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--in-process-gpu','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disk-cache-size=33554432']);
  assert.deepEqual(args,['--no-sandbox','--single-process','--disable-dev-shm-usage','--disable-gpu','--disable-webgl','--disk-cache-size=1048576']);
});
test('temporary space diagnostics return no filenames or document content',async()=>{
  const space=await temporarySpaceMb();
  assert.ok(space===null || Number.isFinite(space) && space>=0);
});
