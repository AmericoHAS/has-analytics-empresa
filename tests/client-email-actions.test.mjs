import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const id = '1debfb06-c944-4d4f-8374-dfb119ae9bad';
function fixture({role='admin',target='client',error=null,auditError=null,session=true}={}) {
 const calls=[];
 const db={auth:{getUser:async()=>({data:{user:session?{id:'admin'}:null}})},from:()=>({select(){return this},eq(_k,v){this.id=v;return this},async single(){return {data:{role:this.id==='admin'?role:target}}}})};
 const privileged={auth:{admin:{getUserById:async()=>({data:{user:{id,email:'old@example.com'}}}),updateUserById:async(uid,attrs)=>{calls.push({uid,attrs});return {data:{user:{id:uid,...attrs}},error}}}},from:table=>({insert:async row=>{calls.push({table,row});return {error:auditError}}})};
 const exports={};
 const overrides={'@/lib/supabase/server':{createClient:async()=>db},'@/lib/supabase/admin':{createAdminClient:()=>{calls.push('privileged');return privileged}},'next/cache':{revalidatePath:()=>{}}};
 new Function('exports','require',ts.transpileModule(readFileSync('app/admin/client-email-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports,n=>overrides[n]);
 const form=new FormData();for(const [k,v] of Object.entries({email:'new@example.com',confirmation:'new@example.com',confirmed:'yes',currentEmail:'old@example.com'}))form.set(k,v);
 return {...exports,calls,form};
}
test('updates only email for same UUID and records existing audit',async()=>{const f=fixture();const r=await f.changeClientAccessEmail(id,f.form);assert.equal(r.success,true);assert.equal(r.email,'new@example.com');assert.deepEqual(f.calls[1],{uid:id,attrs:{email:'new@example.com'}});assert.equal(f.calls[2].table,'audit_log');assert.equal(f.calls[2].row.entity_id,id);assert.equal(f.calls[2].row.actor_id,'admin');});
for(const config of [{role:'client'},{session:false},{target:'admin'}])test('rejects unauthorized access '+JSON.stringify(config),async()=>{const f=fixture(config);assert.equal((await f.changeClientAccessEmail(id,f.form)).success,false);assert.deepEqual(f.calls,[]);assert.equal((await f.getClientAccessEmail(id)).success,false);});
for(const [key,value] of [['email','bad'],['confirmation','other@example.com'],['confirmed','no'],['currentEmail','stale@example.com']])test('validates '+key,async()=>{const f=fixture();f.form.set(key,value);assert.equal((await f.changeClientAccessEmail(id,f.form)).success,false);assert.equal(f.calls.length,1);});
test('rejects same email',async()=>{const f=fixture();f.form.set('email','old@example.com');f.form.set('confirmation','old@example.com');assert.equal((await f.changeClientAccessEmail(id,f.form)).success,false);assert.equal(f.calls.length,1);});
test('duplicate is useful error and no audit success',async()=>{const f=fixture({error:{code:'email_exists',message:'duplicate'}});const r=await f.changeClientAccessEmail(id,f.form);assert.equal(r.success,false);assert.match(r.message,/outra conta/);assert.equal(f.calls.length,2);});
test('audit failure does not falsely report email unchanged',async()=>{const f=fixture({auditError:{code:'failure'}});const r=await f.changeClientAccessEmail(id,f.form);assert.equal(r.success,true);assert.match(r.message,/auditoria/);});
test('reads current Auth email after admin authorization',async()=>{const f=fixture();assert.equal((await f.getClientAccessEmail(id)).email,'old@example.com');});
