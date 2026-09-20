-- Atualização acumulada: executar inteira. Preserva dados existentes.
-- Apply after the three workspace migrations. Additive, transactional and repeatable.
begin;
create table if not exists public.budget_requests (
 id uuid primary key default gen_random_uuid(),name text not null,email text not null,phone text,
 service_type text not null,title text not null,description text not null,desired_date date,
 status text not null default 'nova',created_at timestamptz not null default now()
);
alter table public.budget_requests add column if not exists client_id uuid references public.profiles(id);
alter table public.budget_requests add column if not exists project_id uuid references public.client_projects(id);
create index if not exists budget_requests_client_created on public.budget_requests(client_id,created_at desc);
alter table public.budget_requests enable row level security;
drop policy if exists "public budget request" on public.budget_requests;
-- Keep the existing quick-request API working, without letting it forge account links.
create policy "public budget request" on public.budget_requests for insert to anon,authenticated
with check(client_id is null and project_id is null and status='nova');
grant insert on public.budget_requests to anon,authenticated;
revoke update,delete on public.budget_requests from anon,authenticated;
grant select on public.budget_requests to authenticated;
drop policy if exists "own quote requests" on public.budget_requests;
create policy "own quote requests" on public.budget_requests for select to authenticated using(client_id=auth.uid() or public.is_admin());
create or replace function public.submit_quote_request(p_request_id uuid,p_name text,p_phone text,p_service text,p_title text,p_description text,p_desired_date date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_email text; v_project uuid;
begin
 if v_uid is null then raise exception 'Autenticação necessária'; end if;
 select email into v_email from auth.users where id=v_uid;
 if v_email is null then raise exception 'Conta inválida'; end if;
 if p_request_id is null or p_name is null or length(trim(p_name)) not between 2 and 150 or length(coalesce(p_phone,''))>30
 or p_title is null or length(trim(p_title)) not between 5 and 200 or p_description is null or length(trim(p_description)) not between 20 and 5000
 or p_service is null or p_service not in ('Bioestatística e pesquisa','Análises reproduzíveis','Dados e soluções digitais','Orientação sobre meu projeto')
 or p_desired_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Revise os campos da solicitação'; end if;
 -- Serialize submissions per user; retries with the same UUID are idempotent.
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 select project_id into v_project from public.budget_requests where id=p_request_id and client_id=v_uid;
 if found then return v_project; end if;
 if exists(select 1 from public.budget_requests where client_id=v_uid and created_at>now()-interval '2 minutes') then raise exception 'Aguarde antes de enviar outra solicitação'; end if;
 insert into public.profiles(id,full_name,role,phone) values(v_uid,trim(p_name),'client',nullif(trim(p_phone),'')) on conflict(id) do nothing;
 insert into public.client_projects(client_id,title,description,status,progress,stage)
 values(v_uid,trim(p_title),trim(p_description),'solicitado',0,'Recebimento e escopo') returning id into v_project;
 insert into public.budget_requests(id,client_id,project_id,name,email,phone,service_type,title,description,desired_date)
 values(p_request_id,v_uid,v_project,trim(p_name),v_email,nullif(trim(p_phone),''),p_service,trim(p_title),trim(p_description),p_desired_date);
 return v_project;
end $$;
revoke all on function public.submit_quote_request(uuid,text,text,text,text,text,date) from public,anon;
grant execute on function public.submit_quote_request(uuid,text,text,text,text,text,date) to authenticated;
commit;


begin;
alter table public.projects add column if not exists publication_status text;
alter table public.projects add column if not exists availability text;
alter table public.projects add column if not exists researchers text[] not null default '{}';
-- Existing project RLS is retained: only published projects are public; only admin writes.
commit;


-- Run after the earlier migrations. No project or file is deleted by this SQL.
begin;
alter table public.projects add column if not exists project_type text not null default '';

-- Older installations may not have these optional links yet.
alter table public.client_documents add column if not exists project_id uuid;
alter table public.budget_requests add column if not exists project_id uuid;
alter table public.client_documents alter column project_id drop not null;
alter table public.budget_requests alter column project_id drop not null;

-- Preserve documents, budgets and intake requests when an admin deletes a project.
do $$ declare fk record; begin
  for fk in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
    where c.contype='f' and c.confrelid='public.client_projects'::regclass
      and c.conrelid in ('public.client_documents'::regclass, 'public.budget_requests'::regclass)
      and a.attname='project_id'
  loop execute format('alter table %s drop constraint %I',fk.tbl,fk.conname); end loop;
end $$;
alter table public.client_documents add constraint client_documents_project_id_fkey
 foreign key(project_id) references public.client_projects(id) on delete set null;
alter table public.budget_requests add constraint budget_requests_project_id_fkey
 foreign key(project_id) references public.client_projects(id) on delete set null;

-- Invoker retains RLS. This entry point exists only after preservation is configured.
create or replace function public.delete_client_project(p_project_id uuid, p_client_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if not public.is_admin() then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 delete from public.client_projects where id=p_project_id and client_id=p_client_id;
 get diagnostics affected = row_count;
 return affected=1;
end $$;
revoke all on function public.delete_client_project(uuid,uuid) from public,anon;
grant execute on function public.delete_client_project(uuid,uuid) to authenticated;
commit;


-- Repairs the public portfolio fields, including databases missing the earlier metadata migration.
-- Safe to run more than once; retains all existing records and RLS policies.
begin;
alter table public.projects add column if not exists publication_status text;
alter table public.projects add column if not exists availability text;
alter table public.projects add column if not exists researchers text[] not null default '{}';
alter table public.projects add column if not exists project_type text not null default '';
notify pgrst, 'reload schema';
commit;


begin;
create table if not exists public.client_billing_profiles (
 client_id uuid primary key references public.profiles(id) on delete cascade,
 legal_name text not null check(length(legal_name) between 2 and 180),
 tax_id text not null check(length(tax_id) between 11 and 18),
 email text not null,phone text not null,address text not null,city text not null,state text not null,postal_code text not null,
 institution text not null default '',representative text not null default '',updated_at timestamptz not null default now()
);
alter table public.client_billing_profiles enable row level security;
drop policy if exists billing_access on public.client_billing_profiles;
create policy billing_access on public.client_billing_profiles for all to authenticated using(client_id=auth.uid() or public.is_admin()) with check(client_id=auth.uid() or public.is_admin());
grant select,insert,update on public.client_billing_profiles to authenticated;

alter table public.budget_requests add column if not exists intake jsonb not null default '{}';
create or replace function public.submit_quote_request_v2(p_request_id uuid,p_name text,p_phone text,p_service text,p_title text,p_description text,p_desired_date date,p_intake jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Entre novamente'; end if;
 if jsonb_typeof(p_intake)<>'object' or length(p_intake::text)>5000 then raise exception 'Dados complementares inválidos'; end if;
 pid=public.submit_quote_request(p_request_id,p_name,p_phone,p_service,p_title,p_description,p_desired_date);
 update public.budget_requests set intake=p_intake where id=p_request_id and client_id=auth.uid() and intake='{}'::jsonb;
 return pid;
end $$;
revoke all on function public.submit_quote_request_v2(uuid,text,text,text,text,text,date,jsonb) from public,anon;
grant execute on function public.submit_quote_request_v2(uuid,text,text,text,text,text,date,jsonb) to authenticated;

alter table public.client_budgets add column if not exists payment_terms text not null default '';
alter table public.client_budgets add column if not exists final_due_date date;
alter table public.client_budgets add column if not exists sent_at timestamptz;
alter table public.client_budgets add column if not exists revision integer not null default 1;
create table if not exists public.budget_planning (
 budget_id uuid primary key references public.client_budgets(id) on delete cascade,
 request_id uuid references public.budget_requests(id) on delete set null,
 data_assessment text not null default '',complexity text not null default '',internal_notes text not null default '',department text not null default '',
 estimated_hours numeric not null default 0 check(estimated_hours>=0),base_value numeric not null default 0 check(base_value>=0),additions numeric not null default 0 check(additions>=0)
);
alter table public.budget_planning enable row level security;
drop policy if exists planning_admin on public.budget_planning;
create policy planning_admin on public.budget_planning for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.budget_planning to authenticated;
create or replace function public.save_client_budget_v2(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid uuid; rid uuid;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 rid=nullif(payload->>'requestId','')::uuid;
 if rid is not null and not exists(select 1 from public.budget_requests where id=rid and client_id=(payload->>'clientId')::uuid) then raise exception 'Solicitação não vinculada ao cliente'; end if;
 bid=public.save_client_budget(payload);
 update public.client_budgets set payment_terms=coalesce(payload->>'paymentTerms',''),final_due_date=nullif(payload->>'finalDueDate','')::date where id=bid;
 insert into public.budget_planning(budget_id,request_id,data_assessment,complexity,internal_notes,department,estimated_hours,base_value,additions)
 values(bid,rid,coalesce(payload->>'dataAssessment',''),coalesce(payload->>'complexity',''),coalesce(payload->>'internalNotes',''),coalesce(payload->>'department',''),coalesce((payload->>'estimatedHours')::numeric,0),coalesce((payload->>'baseValue')::numeric,0),coalesce((payload->>'additions')::numeric,0))
 on conflict(budget_id) do update set request_id=excluded.request_id,data_assessment=excluded.data_assessment,complexity=excluded.complexity,internal_notes=excluded.internal_notes,department=excluded.department,estimated_hours=excluded.estimated_hours,base_value=excluded.base_value,additions=excluded.additions;
 return bid;
end $$;
revoke all on function public.save_client_budget_v2(jsonb) from public,anon;
grant execute on function public.save_client_budget_v2(jsonb) to authenticated;

create table if not exists public.document_templates (
 kind text primary key check(kind in ('orcamento','contrato')),body text not null default '',provider_name text not null default '',provider_tax_id text not null default '',provider_address text not null default '',provider_contact text not null default ''
);
insert into public.document_templates(kind,body) values
 ('orcamento','Escopo e entregas conforme os itens desta proposta. Mudanças de escopo, condições de pagamento e prazos devem ser acordadas por escrito.'),
 ('contrato','OBJETO: Prestação dos serviços descritos no orçamento aprovado.
EXECUÇÃO: As atividades e os entregáveis seguem o escopo acordado. Alterações exigem novo acordo entre as partes.
DADOS: O cliente fornecerá os dados e autorizações necessários ao trabalho. As partes preservarão a confidencialidade dos materiais recebidos.
CONDIÇÕES ESPECÍFICAS: Ajustar neste campo as condições de pagamento, revisão, cancelamento e demais condições efetivamente acordadas antes de disponibilizar o contrato.')
 on conflict(kind) do nothing;
alter table public.document_templates enable row level security;
drop policy if exists templates_admin on public.document_templates;
create policy templates_admin on public.document_templates for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.document_templates to authenticated;

create table if not exists public.commercial_documents (
 id uuid primary key default gen_random_uuid(),client_id uuid not null references public.profiles(id),budget_id uuid not null references public.client_budgets(id),
 kind text not null check(kind in ('orcamento','contrato')),title text not null,body text not null,snapshot jsonb not null,
 source_revision integer not null,pdf_path text not null unique,word_path text not null unique,
 status text not null default 'rascunho' check(status in ('rascunho','enviado','aprovado','recusado','substituido')),
 created_at timestamptz not null default now(),published_at timestamptz,decided_at timestamptz,decided_by uuid references public.profiles(id),decision_note text,
 signed_path text unique,signature_status text not null default 'pendente' check(signature_status in ('pendente','recebida','validada','rejeitada')),
 signed_submitted_at timestamptz,signature_validated_at timestamptz,signature_validated_by uuid references public.profiles(id)
);
alter table public.commercial_documents add column if not exists external_revision boolean not null default false;
alter table public.commercial_documents enable row level security;
drop policy if exists commercial_read on public.commercial_documents;
create policy commercial_read on public.commercial_documents for select to authenticated using(public.is_admin() or (client_id=auth.uid() and published_at is not null));
drop policy if exists commercial_insert on public.commercial_documents;
create policy commercial_insert on public.commercial_documents for insert to authenticated with check(public.is_admin() and status='rascunho' and published_at is null);
grant select,insert on public.commercial_documents to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('commercial-documents','commercial-documents',false,20971520)
 on conflict(id) do update set public=false,file_size_limit=20971520;
drop policy if exists commercial_storage_read on storage.objects;
create policy commercial_storage_read on storage.objects for select to authenticated using(bucket_id='commercial-documents' and (public.is_admin() or exists(select 1 from public.commercial_documents d where d.client_id=auth.uid() and d.published_at is not null and (d.pdf_path=name or d.signed_path=name))));
drop policy if exists commercial_storage_insert on storage.objects;
create policy commercial_storage_insert on storage.objects for insert to authenticated with check(bucket_id='commercial-documents' and (public.is_admin() or ((storage.foldername(name))[1]=auth.uid()::text and (storage.foldername(name))[2]='signatures' and lower(storage.extension(name))='pdf')));
drop policy if exists commercial_storage_cleanup on storage.objects;
create policy commercial_storage_cleanup on storage.objects for delete to authenticated using(bucket_id='commercial-documents' and (public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text) and not exists(select 1 from public.commercial_documents d where d.pdf_path=name or d.word_path=name or d.signed_path=name));
-- Read only unlinked own uploads so failed submissions can be cleaned up.
drop policy if exists commercial_orphan_read on storage.objects;
create policy commercial_orphan_read on storage.objects for select to authenticated using(bucket_id='commercial-documents' and (storage.foldername(name))[1]=auth.uid()::text and (storage.foldername(name))[2]='signatures');

create or replace function public.guard_commercial_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.client_budgets where id=new.budget_id and client_id=new.client_id and revision=new.source_revision) then raise exception 'Orçamento alterado. Gere uma nova versão'; end if;
 if new.kind='contrato' and not exists(select 1 from public.client_budgets where id=new.budget_id and status='aprovado') then raise exception 'Aprove o orçamento antes do contrato'; end if;
 if not exists(select 1 from storage.objects where bucket_id='commercial-documents' and name=new.pdf_path) or not exists(select 1 from storage.objects where bucket_id='commercial-documents' and name=new.word_path) then raise exception 'Arquivos ausentes'; end if;
 return new;
end $$;
drop trigger if exists guard_commercial_document on public.commercial_documents;
create trigger guard_commercial_document before insert on public.commercial_documents for each row execute function public.guard_commercial_document();

create or replace function public.budget_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.title,new.description,new.notes,new.total,new.discount_percent,new.valid_until,new.payment_terms,new.final_due_date) is distinct from row(old.title,old.description,old.notes,old.total,old.discount_percent,old.valid_until,old.payment_terms,old.final_due_date) then
  new.revision=old.revision+1;new.status='rascunho';new.approved_at=null;
 end if;
 return new;
end $$;
drop trigger if exists budget_revision on public.client_budgets;
create trigger budget_revision before update on public.client_budgets for each row execute function public.budget_revision();
create or replace function public.budget_items_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.client_budgets set revision=revision+1,status='rascunho',approved_at=null where id=coalesce(new.budget_id,old.budget_id);
 return coalesce(new,old);
end $$;
drop trigger if exists budget_items_revision on public.client_budget_items;
create trigger budget_items_revision after insert or update or delete on public.client_budget_items for each row execute function public.budget_items_revision();

create or replace function public.publish_commercial_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null then raise exception 'Documento não encontrado'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'rascunho' then raise exception 'Esta versão já foi disponibilizada'; end if;
 if b.revision<>d.source_revision then raise exception 'Orçamento alterado. Gere novamente'; end if;
 if d.kind='contrato' and b.status<>'aprovado' then raise exception 'Orçamento precisa estar aprovado'; end if;
 if coalesce(d.snapshot->'provider'->>'provider_name','')='' or coalesce(d.snapshot->'provider'->>'provider_tax_id','')='' or coalesce(d.snapshot->'provider'->>'provider_address','')='' then raise exception 'Preencha os dados do prestador no modelo e gere novamente'; end if;
 update public.commercial_documents set status='substituido' where budget_id=d.budget_id and kind=d.kind and status in ('enviado','aprovado','recusado');
 update public.commercial_documents set status='enviado',published_at=now() where id=p_id;
 if d.kind='orcamento' then update public.client_budgets set status='enviado',sent_at=now(),approved_at=null where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(d.client_id,d.client_id,'commercial-published:'||p_id,'Novo documento disponível','Um documento comercial está disponível na sua área privada.') on conflict do nothing;
end $$;

create or replace function public.decide_commercial_document(p_id uuid,p_accept boolean,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null or d.client_id is distinct from auth.uid() then raise exception 'Acesso restrito'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'enviado' or d.source_revision<>b.revision then raise exception 'Esta versão não está disponível para aprovação'; end if;
 if b.valid_until<current_date and d.kind='orcamento' then raise exception 'Orçamento vencido. Solicite atualização'; end if;
 if length(p_note)>2000 then raise exception 'Observação muito longa'; end if;
 update public.commercial_documents set status=case when p_accept then 'aprovado' else 'recusado' end,decided_at=now(),decided_by=auth.uid(),decision_note=p_note where id=p_id;
 if d.kind='orcamento' then update public.client_budgets set status=case when p_accept then 'aprovado' else 'recusado' end,approved_at=case when p_accept then now() else null end where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'commercial-decision:'||p_id,'Resposta a documento comercial','O cliente respondeu a um documento. Confira a área administrativa.' from public.profiles where role='admin' on conflict do nothing;
end $$;

create or replace function public.submit_signed_commercial(p_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;
begin
 select * into d from public.commercial_documents where id=p_id for update;
 if d.client_id is distinct from auth.uid() or d.kind<>'contrato' or d.status not in ('enviado','aprovado') or d.signature_status in ('recebida','validada') then raise exception 'Envio não permitido'; end if;
 if not exists(select 1 from public.client_budgets where id=d.budget_id and revision=d.source_revision and status='aprovado') then raise exception 'Orçamento alterado. Solicite contrato atualizado'; end if;
 if split_part(p_path,'/',1)<>auth.uid()::text or split_part(p_path,'/',2)<>'signatures' or right(lower(p_path),4)<>'.pdf' or not exists(select 1 from storage.objects where bucket_id='commercial-documents' and name=p_path) then raise exception 'Arquivo inválido'; end if;
 update public.commercial_documents set signed_path=p_path,signature_status='recebida',signed_submitted_at=now() where id=p_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'signature:'||p_path,'Contrato devolvido','Um PDF foi devolvido para conferência da assinatura.' from public.profiles where role='admin' on conflict do nothing;
end $$;
create or replace function public.review_commercial_signature(p_id uuid,p_valid boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 update public.commercial_documents set signature_status=case when p_valid then 'validada' else 'rejeitada' end,signature_validated_at=now(),signature_validated_by=auth.uid() where id=p_id and signature_status='recebida';
 if not found then raise exception 'Nenhuma assinatura aguardando conferência'; end if;
end $$;
revoke all on function public.publish_commercial_document(uuid),public.decide_commercial_document(uuid,boolean,text),public.submit_signed_commercial(uuid,text),public.review_commercial_signature(uuid,boolean) from public,anon;
grant execute on function public.publish_commercial_document(uuid),public.decide_commercial_document(uuid,boolean,text),public.submit_signed_commercial(uuid,text),public.review_commercial_signature(uuid,boolean) to authenticated;
create or replace function public.link_budget_request_by_email(p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; req public.budget_requests;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into req from public.budget_requests where id=p_request_id for update;
 if req.id is null then raise exception 'Solicitação não encontrada'; end if;
 if req.client_id is not null then return req.client_id; end if;
 select u.id into cid from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(trim(req.email)) and p.role='client';
 if cid is null then raise exception 'Cadastre primeiro o cliente com o mesmo e-mail da solicitação'; end if;
 update public.budget_requests set client_id=cid where id=p_request_id;
 return cid;
end $$;
revoke all on function public.link_budget_request_by_email(uuid) from public,anon;
grant execute on function public.link_budget_request_by_email(uuid) to authenticated;
notify pgrst,'reload schema';
commit;


begin;
alter table public.client_budgets add column if not exists publication_partnership boolean not null default false;
alter table public.commercial_documents add column if not exists payment_option jsonb;
alter table public.commercial_documents add column if not exists offer_group uuid;
create table if not exists public.payment_settings(id integer primary key check(id=1), options jsonb not null default '[]',pix_key text not null default '',instructions text not null default 'Aguarde as instruções da HAS antes de pagar.');
insert into public.payment_settings(id,options) values(1,'[{"id":"pix","label":"Pix à vista","method":"pix","installments":1,"feePercent":0,"enabled":true}]') on conflict do nothing;
alter table public.payment_settings enable row level security;
drop policy if exists payment_settings_admin on public.payment_settings;
create policy payment_settings_admin on public.payment_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.payment_settings to authenticated;
create table if not exists public.budget_payments (
 id uuid primary key default gen_random_uuid(),budget_id uuid not null unique references public.client_budgets(id),client_id uuid not null references public.profiles(id),document_id uuid not null references public.commercial_documents(id),
 option jsonb not null,amount numeric(14,2) not null check(amount>=0),status text not null default 'assinatura' check(status in ('assinatura','solicitado','aguardando_pagamento','em_conferencia','confirmado','rejeitado')),
 instructions text not null default '',payment_url text not null default '',receipt_path text,requested_at timestamptz,confirmed_at timestamptz,confirmed_by uuid references public.profiles(id),updated_at timestamptz not null default now()
);
alter table public.budget_payments enable row level security;
drop policy if exists payment_read on public.budget_payments;
create policy payment_read on public.budget_payments for select to authenticated using(public.is_admin() or client_id=auth.uid());
grant select on public.budget_payments to authenticated;
revoke insert,update,delete on public.budget_payments from authenticated,anon;
insert into storage.buckets(id,name,public,file_size_limit) values('payment-receipts','payment-receipts',false,10485760) on conflict(id) do update set public=false,file_size_limit=10485760;
drop policy if exists receipt_read on storage.objects;
create policy receipt_read on storage.objects for select to authenticated using(bucket_id='payment-receipts' and (public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text));
drop policy if exists receipt_insert on storage.objects;
create policy receipt_insert on storage.objects for insert to authenticated with check(bucket_id='payment-receipts' and (storage.foldername(name))[1]=auth.uid()::text and lower(storage.extension(name)) in ('pdf','png','jpg','jpeg'));
drop policy if exists receipt_cleanup on storage.objects;
create policy receipt_cleanup on storage.objects for delete to authenticated using(bucket_id='payment-receipts' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.budget_payments p where p.receipt_path=name));

create or replace function public.save_client_budget_v3(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 if exists(select 1 from public.budget_payments where budget_id=nullif(payload->>'id','')::uuid and status='confirmado') then raise exception 'Pagamento confirmado: crie outro orçamento para um novo escopo'; end if;
 bid=public.save_client_budget_v2(payload);
 update public.client_budgets set publication_partnership=coalesce((payload->>'publicationPartnership')::boolean,false) where id=bid;
 return bid;
end $$;

-- Select a pre-rendered offer: no client-supplied price or document content is trusted.
create or replace function public.choose_payment_offer(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;b public.client_budgets;
begin
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null or d.client_id is distinct from auth.uid() or d.kind<>'orcamento' then raise exception 'Acesso restrito'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'enviado' or d.source_revision<>b.revision or d.payment_option is null or b.valid_until<current_date then raise exception 'Proposta indisponível ou vencida'; end if;
 if exists(select 1 from public.budget_payments where budget_id=b.id and (status<>'assinatura' or document_id in(select id from public.commercial_documents where status='aprovado' or signature_status in('recebida','validada')))) then raise exception 'Proposta já aprovada ou pagamento iniciado. Solicite revisão à HAS'; end if;
 insert into public.budget_payments(budget_id,client_id,document_id,option,amount) values(b.id,d.client_id,d.id,d.payment_option,(d.payment_option->>'total')::numeric)
 on conflict(budget_id) do update set document_id=excluded.document_id,option=excluded.option,amount=excluded.amount,updated_at=now();
end $$;

create or replace function public.request_budget_payment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments;d public.commercial_documents;
begin
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null or p.client_id is distinct from auth.uid() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p.document_id;
 if d.status<>'aprovado' or d.signature_status<>'validada' or not exists(select 1 from public.client_budgets where id=p.budget_id and revision=d.source_revision and status='aprovado') then raise exception 'Aprove a proposta e aguarde a conferência da assinatura'; end if;
 if p.status not in ('assinatura','rejeitado') then raise exception 'Pagamento já solicitado'; end if;
 update public.budget_payments set status='solicitado',requested_at=now(),updated_at=now() where id=p_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select p.client_id,id,'payment-request:'||p_id||':'||extract(epoch from now()),'Solicitação de pagamento','Confira a forma escolhida e disponibilize as instruções de pagamento.' from public.profiles where role='admin';
end $$;

create or replace function public.manage_budget_payment(p_id uuid,p_action text,p_instructions text default '',p_url text default '') returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments; d public.commercial_documents;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null then raise exception 'Pagamento não encontrado'; end if;
 select * into d from public.commercial_documents where id=p.document_id;
 if not exists(select 1 from public.client_budgets where id=p.budget_id and revision=d.source_revision and status='aprovado') or d.status<>'aprovado' or d.signature_status<>'validada' then raise exception 'Proposta ou assinatura desatualizada'; end if;
 if p_action='instrucoes' then
  if p.status not in ('solicitado','aguardando_pagamento','rejeitado') then raise exception 'Aguarde a solicitação do cliente'; end if;
  if length(p_instructions)>4000 or length(p_url)>2000 or (p_url<>'' and p_url !~ '^https://[^[:space:]]+$') then raise exception 'Use instruções válidas e link HTTPS'; end if;
  if trim(p_instructions)='' then raise exception 'Informe as instruções de pagamento'; end if;
  update public.budget_payments set instructions=p_instructions,payment_url=p_url,status='aguardando_pagamento',updated_at=now() where id=p_id;
 elsif p_action in ('confirmar','rejeitar') then
  if p.status<>'em_conferencia' then raise exception 'Nenhum comprovante aguardando conferência'; end if;
  update public.budget_payments set status=case when p_action='confirmar' then 'confirmado' else 'rejeitado' end,confirmed_at=case when p_action='confirmar' then now() end,confirmed_by=auth.uid(),updated_at=now() where id=p_id;
 else raise exception 'Ação inválida'; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p.client_id,p.client_id,'payment-update:'||p_id||':'||extract(epoch from now()),'Pagamento atualizado','Confira as instruções e a situação do pagamento na sua área privada.');
end $$;

create or replace function public.submit_payment_receipt(p_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments;
begin
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null or p.client_id is distinct from auth.uid() or p.status not in ('aguardando_pagamento','rejeitado') then raise exception 'Envio não permitido'; end if;
 if split_part(p_path,'/',1)<>auth.uid()::text or lower(storage.extension(p_path)) not in ('pdf','png','jpg','jpeg') or not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p_path) then raise exception 'Comprovante inválido'; end if;
 update public.budget_payments set receipt_path=p_path,status='em_conferencia',updated_at=now() where id=p_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select p.client_id,id,'receipt:'||p_path,'Comprovante recebido','Confira o recebimento no banco antes de liberar a análise.' from public.profiles where role='admin';
end $$;

-- Gate only new transitions; existing in-progress analyses remain untouched.
create or replace function public.require_project_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.status='em_andamento' and old.status is distinct from new.status) or (new.stage in ('Organização do banco','Análise estatística') and new.stage is distinct from old.stage) then
  if exists(select 1 from public.client_budgets where project_id=new.id and status not in ('cancelado','expirado','recusado')) and not exists(select 1 from public.budget_payments p join public.client_budgets b on b.id=p.budget_id join public.commercial_documents d on d.id=p.document_id where b.project_id=new.id and p.status='confirmado' and b.status='aprovado' and b.revision=d.source_revision) then raise exception 'Confirme o pagamento do orçamento antes de iniciar a análise'; end if;
 end if;return new;
end $$;
drop trigger if exists require_project_payment on public.client_projects;
create trigger require_project_payment before update on public.client_projects for each row execute function public.require_project_payment();
revoke all on function public.save_client_budget_v3(jsonb),public.choose_payment_offer(uuid),public.request_budget_payment(uuid),public.manage_budget_payment(uuid,text,text,text),public.submit_payment_receipt(uuid,text) from public,anon;
grant execute on function public.save_client_budget_v3(jsonb),public.choose_payment_offer(uuid),public.request_budget_payment(uuid),public.manage_budget_payment(uuid,text,text,text),public.submit_payment_receipt(uuid,text) to authenticated;
create or replace function public.publish_commercial_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null then raise exception 'Documento não encontrado'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'rascunho' then raise exception 'Esta versão já foi disponibilizada'; end if;
 if exists(select 1 from public.budget_payments where budget_id=b.id and status='confirmado') then raise exception 'Pagamento confirmado: crie novo orçamento'; end if;
 if b.revision<>d.source_revision then raise exception 'Orçamento alterado. Gere novamente'; end if;
 if d.kind='contrato' and b.status<>'aprovado' then raise exception 'Orçamento precisa estar aprovado'; end if;
 if coalesce(d.snapshot->'provider'->>'provider_name','')='' or coalesce(d.snapshot->'provider'->>'provider_tax_id','')='' or coalesce(d.snapshot->'provider'->>'provider_address','')='' then raise exception 'Preencha os dados do prestador no modelo e gere novamente'; end if;
 update public.commercial_documents set status='substituido' where budget_id=d.budget_id and kind=d.kind and status in ('enviado','aprovado','recusado');
 update public.commercial_documents set status='enviado',published_at=now() where id=p_id or (d.offer_group is not null and offer_group=d.offer_group and budget_id=d.budget_id and source_revision=b.revision and status='rascunho');
 if d.kind='orcamento' then delete from public.budget_payments where budget_id=d.budget_id and status<>'confirmado'; end if;
 if d.kind='orcamento' then update public.client_budgets set status='enviado',sent_at=now(),approved_at=null where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(d.client_id,d.client_id,'commercial-published:'||p_id,'Novo documento disponível','Um documento comercial está disponível na sua área privada.') on conflict do nothing;
end $$;


create or replace function public.decide_commercial_document(p_id uuid,p_accept boolean,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null or d.client_id is distinct from auth.uid() then raise exception 'Acesso restrito'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'enviado' or d.source_revision<>b.revision then raise exception 'Esta versão não está disponível para aprovação'; end if;
 if b.valid_until<current_date and d.kind='orcamento' then raise exception 'Orçamento vencido. Solicite atualização'; end if;
 if d.kind='orcamento' and d.payment_option is not null and not exists(select 1 from public.budget_payments where budget_id=d.budget_id and document_id=d.id) then raise exception 'Escolha a forma de pagamento antes de aprovar'; end if;
 if p_accept and d.kind='orcamento' and d.offer_group is not null then update public.commercial_documents set status='substituido' where offer_group=d.offer_group and id<>d.id; end if;
 if length(p_note)>2000 then raise exception 'Observação muito longa'; end if;
 update public.commercial_documents set status=case when p_accept then 'aprovado' else 'recusado' end,decided_at=now(),decided_by=auth.uid(),decision_note=p_note where id=p_id;
 if d.kind='orcamento' then update public.client_budgets set status=case when p_accept then 'aprovado' else 'recusado' end,approved_at=case when p_accept then now() else null end where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'commercial-decision:'||p_id,'Resposta a documento comercial','O cliente respondeu a um documento. Confira a área administrativa.' from public.profiles where role='admin' on conflict do nothing;
end $$;


create or replace function public.submit_signed_commercial(p_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;
begin
 select * into d from public.commercial_documents where id=p_id for update;
 if d.client_id is distinct from auth.uid() or d.status not in ('enviado','aprovado') or d.signature_status in ('recebida','validada') then raise exception 'Envio não permitido'; end if;
 if not exists(select 1 from public.client_budgets where id=d.budget_id and revision=d.source_revision and status='aprovado') then raise exception 'Orçamento alterado. Solicite documento atualizado'; end if;
 if split_part(p_path,'/',1)<>auth.uid()::text or split_part(p_path,'/',2)<>'signatures' or right(lower(p_path),4)<>'.pdf' or not exists(select 1 from storage.objects where bucket_id='commercial-documents' and name=p_path) then raise exception 'Arquivo inválido'; end if;
 update public.commercial_documents set signed_path=p_path,signature_status='recebida',signed_submitted_at=now() where id=p_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'signature:'||p_path,'Documento devolvido','Um PDF foi devolvido para conferência da assinatura.' from public.profiles where role='admin' on conflict do nothing;
end $$;

notify pgrst,'reload schema';
commit;
