import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
// Isolated Postgres engine. Simulates Supabase auth/storage schemas; never connects remotely.
await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text default auth.uid()::text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
 create function storage.extension(name text) returns text language sql as $$select reverse(split_part(reverse(name),'.',1))$$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 grant all on storage.objects to authenticated,service_role;
`);
await db.exec(
  readFileSync("supabase/schema.sql", "utf8").replace(
    "create extension if not exists pgcrypto;",
    "",
  ),
);
await db.exec(
  "grant all on all tables in schema public to authenticated,service_role; grant all on auth.users to service_role;",
);
const admin = "00000000-0000-4000-8000-000000000001",
  a = "00000000-0000-4000-8000-000000000002",
  b = "00000000-0000-4000-8000-000000000003",
  project = "10000000-0000-4000-8000-000000000001";
await db.exec(
  `insert into auth.users(id) values('${admin}'),('${a}'),('${b}'); insert into profiles(id,full_name,role) values('${admin}','Admin','admin'),('${a}','Client A','client'),('${b}','Client B','client');insert into client_projects(id,client_id,title) values('${project}','${a}','Research');`,
);
if (process.env.TEST_MISSING_ADMIN_HELPER === "true")
  await db.exec("drop function public.is_admin() cascade");
for (let pass = 0; pass < 2; pass++)
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
console.log("PASS migrations apply and can be reapplied without losing data");
// Reproduce older deployments with intake project links missing.
await db.exec("alter table budget_requests drop column project_id cascade; alter table client_documents drop column project_id cascade;");
await db.exec(readFileSync("supabase/ATUALIZAR-COMERCIAL.sql", "utf8"));
await db.exec(readFileSync("supabase/ATUALIZAR-COMERCIAL.sql", "utf8"));
console.log("PASS consolidated update repairs missing project links and is repeatable");

await db.exec(
  `update project_private set admin_notes='INTERNAL ONLY' where project_id='${project}';`,
);
async function as(id, role = "authenticated") {
  await db.exec(
    `reset role;set role ${role};set request.jwt.claim.sub='${id}';`,
  );
}
async function denied(sql) {
  await assert.rejects(() => db.exec(sql));
}
await as(a);
assert.equal((await db.query("select id from client_projects")).rows.length, 1);
assert.equal((await db.query("select * from project_private")).rows.length, 0);
await denied("select admin_notes from client_projects");
await db.exec(`update profiles set role='admin' where id='${a}'`);
assert.equal(
  (await db.query(`select role from profiles where id='${a}'`)).rows[0].role,
  "client",
);
assert.equal((await db.query("select * from project_tasks")).rows.length, 8);
await denied(
  `insert into project_tasks(project_id,title) values('${project}','unauthorized')`,
);
await denied(
  `insert into storage.objects(bucket_id,name) values('client-documents','${b}/bad.pdf')`,
);
await denied(
  `insert into storage.objects(bucket_id,name) values('client-documents','${a}/bad.exe')`,
);
await db.exec(
  `insert into storage.objects(bucket_id,name) values('client-documents','${a}/data.csv')`,
);
await db.exec(
  `insert into client_documents(client_id,title,kind,storage_path,requires_signature,signed_at) values('${a}','Dataset','arquivo','${a}/data.csv',true,now())`,
);
const document = (await db.query("select * from client_documents")).rows[0];
assert.equal(document.requires_signature, false);
assert.equal(document.signed_at, null);
assert.equal(document.uploaded_by, a);
await db.exec(`delete from storage.objects where name='${a}/data.csv'`);
assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
await denied(
  `insert into client_documents(client_id,title,kind,storage_path) values('${b}','Wrong client','arquivo','${a}/data.csv')`,
);
await as(b);
assert.equal((await db.query("select id from client_projects")).rows.length, 0);
assert.equal(
  (await db.query("select id from client_documents")).rows.length,
  0,
);
assert.equal((await db.query("select id from storage.objects")).rows.length, 0);
assert.equal((await db.query("select id from project_tasks")).rows.length, 0);
await denied("select enqueue_deadline_notifications()");
console.log(
  "PASS client isolation, private notes, role escalation, storage upload and cleanup permissions",
);
await as(admin);
assert.equal(
  (await db.query("select admin_notes from project_private")).rows[0]
    .admin_notes,
  "INTERNAL ONLY",
);
const payload = {
  clientId: a,
  projectId: project,
  title: "Budget",
  description: "Scope",
  notes: "Terms",
  discountPercent: 14,
  validUntil: "2026-10-01",
  items: [{ description: "Research", quantity: 1, unitPrice: 935 }],
};
const budget = (
  await db.query("select save_client_budget($1::jsonb) id", [
    JSON.stringify(payload),
  ])
).rows[0].id;
assert.equal(
  Number((await db.query("select total from client_budgets")).rows[0].total),
  804.1,
);
await denied(
  `select save_client_budget('${JSON.stringify({ ...payload, clientId: b })}'::jsonb)`,
);
await denied(
  `select save_client_budget('${JSON.stringify({ ...payload, items: [] })}'::jsonb)`,
);
assert.equal((await db.query("select id from client_budgets")).rows.length, 1);
await as(a);
assert.equal((await db.query("select id from client_budgets")).rows.length, 0);
assert.equal(
  (await db.query("select id from client_budget_items")).rows.length,
  0,
);
await denied(`select save_client_budget('${JSON.stringify(payload)}'::jsonb)`);
await as(admin);
await db.exec(
  `update client_budgets set status='enviado' where id='${budget}'`,
);
await as(a);
assert.equal(
  (await db.query("select id from client_budget_items")).rows.length,
  1,
);
console.log(
  "PASS atomic budgets, amounts, invalid payloads and draft visibility",
);
await as(admin);
await db.exec(
  `update client_projects set due_date=(now() at time zone 'America/Sao_Paulo')::date-1 where id='${project}'`,
);
await as("", "service_role");
await db.exec(
  "select enqueue_deadline_notifications(); select enqueue_deadline_notifications();",
);
const notices = (await db.query("select * from notifications")).rows;
assert.equal(notices.length, 3); // one upload to admin; overdue to client and admin.
const first = (await db.query("select * from claim_notification_emails(2)"))
  .rows;
const second = (await db.query("select * from claim_notification_emails(2)"))
  .rows;
assert.equal(first.length, 2);
assert.equal(second.length, 1);
assert(!first.some((x) => second.some((y) => x.id === y.id)));
await as(b);
assert.equal((await db.query("select * from notifications")).rows.length, 0);
await denied("update notifications set email_status='sent'");
console.log(
  "PASS notification deduplication, queue reservation and recipient isolation",
);
await db.exec(
  "reset role;update auth.users set email='client@example.test' where id='" +
    a +
    "';",
);
const quoteId = "20000000-0000-4000-8000-000000000001";
const quoteCall = `select submit_quote_request('${quoteId}','Client A','44900000000','Bioestatística e pesquisa','Projeto de pesquisa','Analisar as associações entre as variáveis do estudo.',null) as project_id`;
await as("", "anon");
await denied(quoteCall);
await as(a);
const submitted = (await db.query(quoteCall)).rows[0].project_id;
assert.equal((await db.query(quoteCall)).rows[0].project_id, submitted);
assert.equal((await db.query("select id from budget_requests")).rows.length, 1);
assert.equal(
  (
    await db.query(
      `select due_date from client_projects where id='${submitted}'`,
    )
  ).rows[0].due_date,
  null,
);
await denied(
  "insert into budget_requests(client_id,name,email,service_type,title,description) values('00000000-0000-4000-8000-000000000002','Fake','fake@example.test','test','Test','Test')",
);
await denied(
  quoteCall.replace(quoteId, "20000000-0000-4000-8000-000000000002"),
);
await as(b);
assert.equal((await db.query("select id from budget_requests")).rows.length, 0);
await as(admin);
assert.equal((await db.query("select id from budget_requests")).rows.length, 1);
await db.exec(
  "reset role;insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000004','new@example.test');",
);
await as("00000000-0000-4000-8000-000000000004");
await denied(
  quoteCall
    .replace(quoteId, "20000000-0000-4000-8000-000000000003")
    .replace("'Client A'", "null"),
);
assert.equal((await db.query("select id from profiles")).rows.length, 0);
await db.query(
  quoteCall.replace(quoteId, "20000000-0000-4000-8000-000000000003"),
);
assert.equal(
  (await db.query("select role from profiles")).rows[0].role,
  "client",
);
console.log(
  "PASS quote authentication, RLS isolation, idempotency, throttling, profile creation and validation",
);
await as('', 'anon');
await db.exec("insert into budget_requests(name,email,service_type,title,description) values('Quick request','quick@example.test','test','Quick project','A quick project request')");
console.log('PASS existing anonymous quick-request flow preserved');
await as(admin);
await db.exec("insert into projects(slug,title,category,summary,published,publication_status,researchers) values('public-test','Public study','Research','Summary',true,'Manuscrito em submissão',ARRAY['Researcher A']),('draft-test','Draft study','Research','Summary',false,'Em preparação',ARRAY['Researcher B']);insert into comments(author_name,content,approved) values('Reader','A published comment for testing',true),('Reader 2','A pending comment for testing',false);");
await db.exec('reset role;grant select on projects,comments to anon;');
await as('', 'anon');
assert.equal((await db.query('select slug from projects')).rows.length,1);
assert.equal((await db.query('select id from comments')).rows.length,1);
await as(a);
await denied("insert into projects(slug,title,category,summary) values('blocked','Blocked','test','test')");
await db.exec("delete from comments where approved=true");
assert.equal((await db.query('select id from comments')).rows.length,1);
await as(admin);
assert.equal((await db.query('select id from comments')).rows.length,2);
await db.exec("update comments set approved=false where approved=true");
await as('', 'anon');
assert.equal((await db.query('select id from comments')).rows.length,0);
console.log('PASS project metadata publication isolation and moderation of approved comments');
await as(admin);
const removable = "10000000-0000-4000-8000-000000000099";
await db.exec(`insert into client_projects(id,client_id,title) values('${removable}','${a}','Delete test');
insert into project_private(project_id,admin_notes) values('${removable}','Test notes');
insert into storage.objects(bucket_id,name) values('client-documents','${a}/preserved.pdf');
insert into client_documents(client_id,project_id,title,kind,storage_path) values('${a}','${removable}','Preserved file','arquivo','${a}/preserved.pdf');
insert into client_budgets(client_id,project_id,budget_number,title) values('${a}','${removable}','DELETE-TEST','Preserved budget');
reset role; insert into budget_requests(client_id,project_id,name,email,service_type,title,description) values('${a}','${removable}','Client A','a@example.test','Test','Preserved request','Test description');`);
await as(a);
await denied(`select public.delete_client_project('${removable}','${a}')`);
await as('', 'anon');
await denied(`select public.delete_client_project('${removable}','${a}')`);
await as(admin);
assert.equal((await db.query(`select public.delete_client_project('${removable}','${b}') as deleted`)).rows[0].deleted,false);
assert.equal((await db.query(`select public.delete_client_project('${removable}','${a}') as deleted`)).rows[0].deleted,true);
assert.equal((await db.query(`select id from client_projects where id='${removable}'`)).rows.length,0);
assert.equal((await db.query(`select id from project_tasks where project_id='${removable}'`)).rows.length,0);
assert.equal((await db.query(`select project_id from project_private where project_id='${removable}'`)).rows.length,0);
for (const [table,condition] of [['client_documents',"title='Preserved file'"],['client_budgets',"budget_number='DELETE-TEST'"],['budget_requests',"title='Preserved request'"]]) {
 const rows = (await db.query(`select project_id from ${table} where ${condition}`)).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].project_id,null);
}
assert.equal((await db.query(`select id from storage.objects where name='${a}/preserved.pdf'`)).rows.length,1);
await as(a);
assert.equal((await db.query("select id from client_documents where title='Preserved file'")).rows.length,1);
await as(b);
assert.equal((await db.query("select id from client_documents where title='Preserved file'")).rows.length,0);
console.log('PASS admin-only project deletion preserves documents/storage/budgets/requests and client isolation');
// New commercial flow: public PDF access is version-bound; Word remains admin-only.
await as(a);
await db.exec(`insert into client_billing_profiles(client_id,legal_name,tax_id,email,phone,address,city,state,postal_code) values('${a}','Cliente Teste','12345678901','a@example.test','44999998888','Rua de teste 10','Maringá','PR','87000000')`);
await denied(`insert into client_billing_profiles(client_id,legal_name,tax_id,email,phone,address,city,state,postal_code) values('${b}','Outro Cliente','12345678901','b@example.test','44999998888','Rua 10','Maringá','PR','87000000')`);
await as(b);assert.equal((await db.query('select client_id from client_billing_profiles')).rows.length,0);
await as(admin);
const cPayload={...payload,id:null,paymentTerms:'Pix em duas parcelas',finalDueDate:'2028-12-20',dataAssessment:'INTERNAL PRIVATE',estimatedHours:8,baseValue:250,additions:45};
const cb=(await db.query('select save_client_budget_v2($1::jsonb) id',[JSON.stringify(cPayload)])).rows[0].id;
await db.exec(`update client_budgets set valid_until=current_date+30 where id='${cb}'`);
let rev=(await db.query(`select revision from client_budgets where id='${cb}'`)).rows[0].revision;
const cd='30000000-0000-4000-8000-000000000001',ct='30000000-0000-4000-8000-000000000002';
const snap=JSON.stringify({provider:{provider_name:'HAS Teste',provider_tax_id:'12345678901',provider_address:'Rua Teste'}});
async function makeDoc(id,kind){await db.exec(`insert into storage.objects(bucket_id,name) values('commercial-documents','${a}/${id}/document.pdf'),('commercial-documents','${a}/${id}/editable.docx');insert into commercial_documents(id,client_id,budget_id,kind,title,body,snapshot,source_revision,pdf_path,word_path) values('${id}','${a}','${cb}','${kind}','Test document','Test terms','${snap}',${rev},'${a}/${id}/document.pdf','${a}/${id}/editable.docx')`);}
await makeDoc(cd,'orcamento');
await as(a);assert.equal((await db.query('select id from commercial_documents')).rows.length,0);
assert.equal((await db.query('select budget_id from budget_planning')).rows.length,0);
assert.equal((await db.query("select name from storage.objects where bucket_id='commercial-documents'")).rows.length,0);
await denied(`select publish_commercial_document('${cd}')`);
await as(admin);await db.exec(`select publish_commercial_document('${cd}')`);
await as(b);await denied(`select decide_commercial_document('${cd}',true,'')`);assert.equal((await db.query('select id from commercial_documents')).rows.length,0);
await as(a);assert.equal((await db.query('select id from commercial_documents')).rows.length,1);
const visibleFiles=(await db.query("select name from storage.objects where bucket_id='commercial-documents'")).rows;
assert.equal(visibleFiles.length,1);assert.ok(visibleFiles[0].name.endsWith('.pdf'));
await denied(`update commercial_documents set status='aprovado' where id='${cd}'`);
await db.exec(`select decide_commercial_document('${cd}',true,'Aceito esta versão')`);
await denied(`select decide_commercial_document('${cd}',false,'duplicate')`);
await as(admin);assert.equal((await db.query(`select status from client_budgets where id='${cb}'`)).rows[0].status,'aprovado');
await makeDoc(ct,'contrato');await db.exec(`select publish_commercial_document('${ct}')`);
await as(a);
await db.exec(`insert into storage.objects(bucket_id,name) values('commercial-documents','${a}/signatures/signed.pdf')`);
await denied(`select submit_signed_commercial('${ct}','${b}/signatures/forged.pdf')`);
await db.exec(`select submit_signed_commercial('${ct}','${a}/signatures/signed.pdf')`);
await denied(`select review_commercial_signature('${ct}',true)`);
await as(admin);await db.exec(`select review_commercial_signature('${ct}',true)`);
assert.equal((await db.query(`select signature_status from commercial_documents where id='${ct}'`)).rows[0].signature_status,'validada');
await db.exec(`update client_budget_items set description='Changed item' where budget_id='${cb}'`);
assert.ok((await db.query(`select revision from client_budgets where id='${cb}'`)).rows[0].revision>rev);
assert.equal((await db.query(`select status from client_budgets where id='${cb}'`)).rows[0].status,'rascunho');
await as(a);await denied(`select decide_commercial_document('${ct}',true,'stale')`);
console.log('PASS commercial billing isolation, private drafts and Word, version approval, signature review and stale-version rejection');
// Payment workflow: only the pre-rendered price is accepted, signed approval precedes collection.
await as(admin);
const payBudget=(await db.query('select save_client_budget_v3($1::jsonb) id',[JSON.stringify({...cPayload,id:null,publicationPartnership:true})])).rows[0].id;
await db.exec(`update client_budgets set valid_until=current_date+30 where id='${payBudget}'`);
const payRev=(await db.query(`select revision from client_budgets where id='${payBudget}'`)).rows[0].revision;
assert.equal((await db.query(`select publication_partnership from client_budgets where id='${payBudget}'`)).rows[0].publication_partnership,true);
const offer1='40000000-0000-4000-8000-000000000001',offer2='40000000-0000-4000-8000-000000000002',group='40000000-0000-4000-8000-000000000003';
for(const [id,total] of [[offer1,100],[offer2,105.26]])await db.exec(`insert into storage.objects(bucket_id,name) values('commercial-documents','${a}/${id}/document.pdf'),('commercial-documents','${a}/${id}/editable.docx');insert into commercial_documents(id,client_id,budget_id,kind,title,body,snapshot,source_revision,pdf_path,word_path,payment_option,offer_group) values('${id}','${a}','${payBudget}','orcamento','Proposta com pagamento','Termos','${snap}',${payRev},'${a}/${id}/document.pdf','${a}/${id}/editable.docx','{"total":${total},"label":"Opção testada"}','${group}');`);
await db.exec(`select publish_commercial_document('${offer1}')`);
assert.equal((await db.query(`select count(*)::int n from commercial_documents where offer_group='${group}' and status='enviado'`)).rows[0].n,2);
assert.equal((await db.query(`select status from client_budgets where id='${payBudget}'`)).rows[0].status,'enviado');
await as(b);await denied(`select choose_payment_offer('${offer1}')`);
await as(a);await denied(`select decide_commercial_document('${offer1}',true,'')`);
await db.exec(`select choose_payment_offer('${offer2}')`);
let payment=(await db.query(`select * from budget_payments where budget_id='${payBudget}'`)).rows[0];
assert.equal(Number(payment.amount),105.26);
await denied(`update budget_payments set amount=1 where id='${payment.id}'`);
await denied(`select request_budget_payment('${payment.id}')`);
await db.exec(`select decide_commercial_document('${offer2}',true,'Aceito o total')`);
await denied(`select choose_payment_offer('${offer1}')`);
await db.exec(`insert into storage.objects(bucket_id,name) values('commercial-documents','${a}/signatures/quote.pdf');select submit_signed_commercial('${offer2}','${a}/signatures/quote.pdf')`);
await denied(`select request_budget_payment('${payment.id}')`);
await as(admin);await db.exec(`select review_commercial_signature('${offer2}',true)`);
await denied(`update client_projects set status='em_andamento' where id='${project}'`);
await as(a);await db.exec(`select request_budget_payment('${payment.id}')`);
await denied(`select manage_budget_payment('${payment.id}','instrucoes','Pix','')`);
await as(admin);await denied(`select manage_budget_payment('${payment.id}','instrucoes','Pix','javascript:alert(1)')`);
await db.exec(`select manage_budget_payment('${payment.id}','instrucoes','Instruções de teste','https://example.test/pay')`);
await as(b);assert.equal((await db.query('select * from budget_payments')).rows.length,0);await denied(`select submit_payment_receipt('${payment.id}','${b}/bad.pdf')`);
await as(a);await db.exec(`insert into storage.objects(bucket_id,name) values('payment-receipts','${a}/receipt.pdf')`);
await denied(`select submit_payment_receipt('${payment.id}','${b}/bad.pdf')`);
await db.exec(`select submit_payment_receipt('${payment.id}','${a}/receipt.pdf')`);
await denied(`select manage_budget_payment('${payment.id}','confirmar')`);
await as(b);assert.equal((await db.query("select name from storage.objects where bucket_id='payment-receipts'")).rows.length,0);
await as(admin);await db.exec(`select manage_budget_payment('${payment.id}','confirmar')`);
assert.equal((await db.query(`select status from budget_payments where id='${payment.id}'`)).rows[0].status,'confirmado');
await db.exec(`update client_projects set status='em_andamento' where id='${project}'`);
await denied(`select publish_commercial_document('${offer1}')`);
console.log('PASS payment selection, correct totals, signed approval, private receipts, admin confirmation and analysis gate');
await db.close();
