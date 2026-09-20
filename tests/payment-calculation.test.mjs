import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import {readFileSync} from "node:fs";
const lib={};new Function("exports",ts.transpileModule(readFileSync("lib/commercial/payments.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(lib);
test("card gross-up preserves net and installments close exactly to the cent",()=>{const q=lib.quotePayment(1000,{id:"card",method:"card",label:"Cartão",installments:3,feePercent:5,enabled:true});assert.equal(q.total,1052.63);assert.equal(Math.round((q.installment*2+q.lastInstallment)*100),105263);assert.ok(q.total*(1-.05)>=999.99);});
test("Pix without fees preserves agreed price; invalid rates and parcels fail",()=>{const pix=lib.defaultPaymentOptions[0];assert.equal(lib.quotePayment(729,pix).total,729);for(const patch of [{feePercent:100},{feePercent:-1},{installments:0},{installments:13}])assert.throws(()=>lib.quotePayment(100,{...pix,...patch}));assert.ok(lib.defaultPaymentOptions.filter(o=>o.method==="card").every(o=>!o.enabled));});
