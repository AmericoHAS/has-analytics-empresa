import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
function action({rpcError=null,published={status:'enviado',published_at:'2026-09-24'},verificationError=null,admin=true}={}){
 const calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async()=>{calls.push('rpc');return {error:rpcError};},from:(table)=>({select:()=>({eq:()=>({single:async()=>table==='profiles'?{data:{role:admin?'admin':'client'}}:{data:published,error:verificationError}})})})};
 const exports={};
 const source=ts.transpileModule(fs.readFileSync('app/admin/commercial-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require',source)(exports,id=>id==='zod'?{z}:id==='node:crypto'?{randomUUID}:id==='@/lib/supabase/server'?{createClient:async()=>db}:{});
 return {publish:exports.publishCommercial,calls};
}
const id='11111111-1111-4111-8111-111111111111';
test('publication preserves the database rejection and does not report success',async()=>{
 const a=action({rpcError:{code:'P0001',message:'Confira a assinatura do orçamento antes de enviar o contrato'}});
 const r=await a.publish(id,true);assert.equal(r.success,false);assert.match(r.message,/Confira a assinatura do orçamento/);
});
test('publication only confirms success after checking persisted availability',async()=>{
 assert.equal((await action().publish(id,true)).success,true);
 assert.equal((await action({published:{status:'rascunho',published_at:null}}).publish(id,true)).success,false);
 assert.equal((await action({verificationError:{code:'network'}}).publish(id,true)).success,false);
});
test('unreviewed and non-admin publications never invoke the mutation',async()=>{
 const a=action();assert.equal((await a.publish(id,false)).success,false);assert.equal(a.calls.length,0);
 const b=action({admin:false});assert.equal((await b.publish(id,true)).success,false);assert.equal(b.calls.length,0);
});
