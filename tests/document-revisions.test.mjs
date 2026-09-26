import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import {createRequire} from 'node:module';import {PDFDocument} from 'pdf-lib';import JSZip from 'jszip';
const require=createRequire(import.meta.url);
function load(file,overrides={}){const result={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(result,id=>overrides[id]??require(id));return result;}
const {selectedDocumentId}=load('lib/commercial/document-selection.ts');
test('new revision stays visible when chosen offer belongs to an older group',()=>{
 const group=[{id:'new'}];assert.equal(selectedDocumentId(group,undefined,'old'),'new');assert.equal(selectedDocumentId(group,'missing','old'),'new');assert.equal(selectedDocumentId([{id:'a'},{id:'b'}],undefined,'b'),'b');
});
test('external Word/PDF replacements preserve versions, current financial snapshot and names',async()=>{
 const id='10000000-0000-4000-8000-000000000001',client='20000000-0000-4000-8000-000000000001';
 const original={id,client_id:client,budget_id:'budget',kind:'orcamento',source_revision:2,title:'Teste',body:'Condições',snapshot:{budget:{total:675}},payment_option:{total:675},offer_group:'old'};
 const records=[original],files=new Map();let revision=2;
 const pdf=await PDFDocument.create();pdf.addPage();const pdfBytes=await pdf.save();const zip=new JSZip();zip.file('word/document.xml','<document/>');const wordBytes=await zip.generateAsync({type:'uint8array'});
 const db={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},storage:{from:()=>({download:async path=>({data:files.get(path),error:null})})},from(table){let key;return{select(){return this},eq(field,value){if(field==='id')key=value;return this},single:async()=>({data:table==='profiles'?{role:'admin'}:table==='client_budgets'?{revision,archived_at:null}:records.find(r=>r.id===key)}),insert:async row=>{records.push({...row,id:`version-${records.length}`});return{error:null}}};}};
 const {registerCommercialRevision}=load('app/admin/commercial-actions.ts',{'@/lib/supabase/server':{createClient:async()=>db}});
 for(let i=1;i<=2;i++){
  const pdfPath=`${client}/revisions/version${i}.pdf`,wordPath=`${client}/revisions/version${i}.docx`;
  files.set(pdfPath,new Blob([pdfBytes]));files.set(wordPath,new Blob([wordBytes]));
  const result=await registerCommercialRevision(id,pdfPath,wordPath,{pdfName:`acordo-${i}.pdf`,wordName:`acordo-${i}.docx`});assert.equal(result.success,true,result.message);
  const saved=records.at(-1);assert.equal(saved.pdf_path,pdfPath);assert.equal(saved.word_path,wordPath);assert.equal(saved.snapshot.externalFiles.wordName,`acordo-${i}.docx`);assert.equal(saved.snapshot.budget.total,675);assert.equal(saved.budget_id,'budget');assert.equal(saved.source_revision,2);
 }
 assert.equal(records.length,3);assert.equal(records[1].snapshot.externalFiles.pdfName,'acordo-1.pdf');
 revision=3;const rejected=await registerCommercialRevision(id,`${client}/revisions/version2.pdf`,`${client}/revisions/version2.docx`);assert.equal(rejected.success,false);assert.match(rejected.message,/valor ou escopo/);assert.equal(records.length,3);
});
