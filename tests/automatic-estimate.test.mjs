import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const lib={};new Function('exports','require',ts.transpileModule(fs.readFileSync('lib/commercial/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(lib,()=>JSON.parse(fs.readFileSync('lib/commercial/reference.json','utf8')));
test('estimation recalculates prices using the existing formula, preserving text, extra services and discount',()=>{
 const model=lib.defaultModel;const items=model.services.map(s=>({...s,description:'Texto revisado '+s.id}));items.push({description:'Serviço adicional',quantity:2,unitPrice:50});
 const next=lib.estimatedItems(model,items,12,{Complexidade:0});
 assert.equal(lib.totals(next,0).total,lib.estimate(model,12,[model.coefficients[0].coefficient])+100);
 assert.deepEqual(next.map(i=>i.description),items.map(i=>i.description));assert.deepEqual(next[3],items[3]);assert.equal(items[1].quantity,8);
 assert.equal(lib.totals(next,30).total,Math.round(lib.totals(next,0).total*70)/100);
 const changed=lib.estimatedItems(model,next,0,{});assert.equal(lib.totals(changed,0).total,model.baseValue+100);
});
