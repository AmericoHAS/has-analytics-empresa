import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const lib={};new Function('exports','require',ts.transpileModule(fs.readFileSync('lib/commercial/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(lib,()=>JSON.parse(fs.readFileSync('lib/commercial/reference.json','utf8')));

test('all pricing inputs compose without resetting manually reviewed services', () => {
 const model=lib.defaultModel;
 const items=model.services.filter(s=>s.initial).map(s=>({...s}));items[2].unitPrice=120;
 let pricing={hours:10,rate:80,base:300,additions:100,factors:{}};
 assert.equal(lib.totals(lib.pricingItems(model,items,pricing),0).total,1320);
 const index=model.coefficients.findIndex(c=>c.group==='Complexidade' && c.coefficient>0);
 pricing=lib.changePricingFactors(model,pricing,{Complexidade:index});
 const added=Math.round(300*model.coefficients[index].coefficient*100)/100;
 assert.equal(pricing.additions,100+added);
 assert.equal(lib.totals(lib.pricingItems(model,items,pricing),0).total,1320+added);
 assert.deepEqual(lib.changePricingFactors(model,pricing,pricing.factors),pricing);
 pricing=lib.changePricingFactors(model,pricing,{});
 assert.equal(pricing.additions,100);
 assert.equal(lib.pricingItems(model,items,pricing)[2].unitPrice,120);
 assert.equal(lib.totals(lib.pricingItems(model,items,pricing),30).total,924);
 assert.equal(lib.totals(lib.pricingItems(model,items,{...pricing,hours:0}),0).total,520);
});
