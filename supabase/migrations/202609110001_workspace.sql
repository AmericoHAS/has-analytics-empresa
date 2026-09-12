-- Apply to the EXISTING HAS database after backup. Fresh databases: schema.sql first.
-- Transactional, additive tables/columns. Existing records are preserved.
begin;

-- Older deployed databases may not have the helper from schema.sql.
-- Define it before any policy or function that depends on it.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

alter table public.client_projects add column if not exists start_date date;
alter table public.client_projects add column if not exists due_date date;
alter table public.client_projects add column if not exists updated_at timestamptz not null default now();
alter table public.client_projects add column if not exists admin_notes text;
alter table public.client_projects add column if not exists stage text not null default 'Recebimento e escopo';
alter table public.client_projects add column if not exists deliverables text;
alter table public.client_projects add column if not exists client_due_date date;

create table if not exists public.client_budgets (
 id uuid primary key default gen_random_uuid(),client_id uuid not null references public.profiles(id),
 project_id uuid references public.client_projects(id) on delete set null,budget_number text not null unique,
 title text not null,description text,subtotal numeric(12,2) not null default 0,discount_percent numeric(5,2) not null default 0,
 total numeric(12,2) not null default 0,status text not null default 'rascunho',valid_until date,notes text,approved_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.client_budget_items (
 id uuid primary key default gen_random_uuid(),budget_id uuid not null references public.client_budgets(id) on delete cascade,
 description text not null,quantity numeric(10,2) not null check(quantity>0),unit_price numeric(12,2) not null check(unit_price>=0),display_order integer not null default 0
);
create table if not exists public.commercial_settings (
 id integer primary key check(id=1),model jsonb not null,updated_at timestamptz not null default now()
);
create or replace function public.validate_commercial_model() returns trigger language plpgsql set search_path=public as $$
begin
 if jsonb_typeof(new.model->'services') is distinct from 'array' or
    (select count(*) from jsonb_array_elements(new.model->'services') s where s->>'initial'='true') <> 3
 then raise exception 'Selecione exatamente três serviços iniciais'; end if;
 if not ((new.model->>'discount')::numeric between 0 and 100) or not ((new.model->>'validityDays')::numeric between 1 and 365)
 or (new.model->>'hourlyRate')::numeric<0 or (new.model->>'baseValue')::numeric<0
 then raise exception 'Parâmetros comerciais inválidos'; end if;
 if exists(select 1 from jsonb_array_elements(new.model->'services') s where coalesce((s->>'quantity')::numeric,0)<=0 or coalesce((s->>'unitPrice')::numeric,-1)<0 or length(trim(coalesce(s->>'description','')))=0)
 then raise exception 'Serviços inválidos'; end if;
 return new;
end $$;
drop trigger if exists validate_commercial_model on public.commercial_settings;
create trigger validate_commercial_model before insert or update on public.commercial_settings for each row execute function public.validate_commercial_model();

create table if not exists public.project_private (
 project_id uuid primary key references public.client_projects(id) on delete cascade,
 admin_notes text not null default '',department text not null default '',research_area text not null default '',data_assessment text not null default '',
 complexity text not null default '',estimated_hours numeric not null default 0 check(estimated_hours>=0),responsible text not null default ''
);
insert into public.project_private(project_id,admin_notes) select id,coalesce(admin_notes,'') from public.client_projects on conflict(project_id) do nothing;
-- Retain old notes for rollback, but never expose that column through the authenticated API.
revoke select on public.client_projects from anon,authenticated;
revoke select(admin_notes) on public.client_projects from anon,authenticated;
grant select(id,client_id,title,description,status,progress,created_at,start_date,due_date,updated_at,stage,deliverables,client_due_date) on public.client_projects to authenticated;
grant insert,update,delete on public.client_projects to authenticated;

create table if not exists public.project_tasks (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.client_projects(id) on delete cascade,
 title text not null check(length(title) between 1 and 300),done boolean not null default false,display_order integer not null default 0
);
create index if not exists project_tasks_project on public.project_tasks(project_id);
create or replace function public.seed_project_tasks() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.project_tasks(project_id,title,display_order) select new.id,v.title,v.n from (values
 (0,'Confirmar objetivos e escopo'),(1,'Receber dados e instrumentos'),(2,'Conferir banco e dicionário de variáveis'),(3,'Definir plano de análise'),
 (4,'Executar análises e verificar pressupostos'),(5,'Revisar tabelas, gráficos e interpretação'),(6,'Disponibilizar relatório e arquivos'),(7,'Conferir entrega e ajustes acordados')) v(n,title);
 return new;
end $$;
drop trigger if exists seed_project_tasks on public.client_projects;
create trigger seed_project_tasks after insert on public.client_projects for each row execute function public.seed_project_tasks();
insert into public.project_tasks(project_id,title,display_order)
select p.id,v.title,v.n from public.client_projects p cross join (values
 (0,'Confirmar objetivos e escopo'),(1,'Receber dados e instrumentos'),(2,'Conferir banco e dicionário de variáveis'),(3,'Definir plano de análise'),
 (4,'Executar análises e verificar pressupostos'),(5,'Revisar tabelas, gráficos e interpretação'),(6,'Disponibilizar relatório e arquivos'),(7,'Conferir entrega e ajustes acordados')) v(n,title)
where not exists(select 1 from public.project_tasks t where t.project_id=p.id);

alter table public.client_documents add column if not exists uploaded_by uuid references auth.users(id);
alter table public.client_documents add column if not exists uploader_role text not null default 'admin';
alter table public.client_documents add column if not exists original_name text;
alter table public.client_documents add column if not exists file_size bigint;
create or replace function public.guard_workspace_document() returns trigger language plpgsql security definer set search_path=public,storage as $$
begin
 if new.project_id is not null and not exists(select 1 from public.client_projects where id=new.project_id and client_id=new.client_id)
 then raise exception 'O projeto não pertence a este cliente'; end if;
 if tg_op='INSERT' then
  if new.storage_path is null or split_part(new.storage_path,'/',1)<>new.client_id::text then raise exception 'Caminho privado inválido'; end if;
  if not exists(select 1 from storage.objects where bucket_id='client-documents' and name=new.storage_path) then raise exception 'Envie o arquivo antes de registrar'; end if;
  new.uploaded_by=auth.uid();new.uploader_role=case when public.is_admin() then 'admin' else 'client' end;
  if not public.is_admin() then
   if new.client_id<>auth.uid() or new.kind<>'arquivo' then raise exception 'Envio não autorizado'; end if;
   new.status='disponivel';new.requires_signature=false;new.signed_at=null;new.file_url=null;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists guard_workspace_document on public.client_documents;
create trigger guard_workspace_document before insert or update on public.client_documents for each row execute function public.guard_workspace_document();

-- Replace policies on these private tables: permissive old policies must not bypass new rules.
do $$ declare p record; begin
 for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in
 ('profiles','client_projects','client_documents','client_budgets','client_budget_items','commercial_settings','project_private','project_tasks')
 loop execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename); end loop;
end $$;
alter table public.profiles enable row level security;
create policy has_profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy has_profile_admin on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.client_projects enable row level security;
create policy has_project_read on public.client_projects for select to authenticated using(client_id=auth.uid() or public.is_admin());
create policy has_project_admin on public.client_projects for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.client_documents enable row level security;
create policy has_document_read on public.client_documents for select to authenticated using(client_id=auth.uid() or public.is_admin());
create policy has_document_admin on public.client_documents for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy has_document_upload on public.client_documents for insert to authenticated with check(client_id=auth.uid() and uploaded_by=auth.uid() and uploader_role='client' and kind='arquivo' and not requires_signature and signed_at is null and file_url is null);
alter table public.client_budgets enable row level security;
create policy has_budget_read on public.client_budgets for select to authenticated using(public.is_admin() or (client_id=auth.uid() and status<>'rascunho'));
create policy has_budget_admin on public.client_budgets for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.client_budget_items enable row level security;
create policy has_item_read on public.client_budget_items for select to authenticated using(exists(select 1 from public.client_budgets b where b.id=budget_id));
create policy has_item_admin on public.client_budget_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.commercial_settings enable row level security;
create policy has_settings_admin on public.commercial_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.project_private enable row level security;
create policy has_private_admin on public.project_private for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.project_tasks enable row level security;
create policy has_task_read on public.project_tasks for select to authenticated using(exists(select 1 from public.client_projects p where p.id=project_id));
create policy has_task_admin on public.project_tasks for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.client_documents,public.client_budgets,public.client_budget_items,public.commercial_settings,public.project_private,public.project_tasks to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('client-documents','client-documents',false,52428800)
on conflict(id) do update set public=false,file_size_limit=52428800;
-- Covers/public portfolio policies are untouched. Review any custom policies covering several buckets.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (coalesce(qual,'')||coalesce(with_check,'')) like '%client-documents%'
 loop execute format('drop policy %I on storage.objects',p.policyname); end loop;
end $$;
create policy has_storage_read on storage.objects for select to authenticated using(bucket_id='client-documents' and (public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text));
create policy has_storage_insert on storage.objects for insert to authenticated with check(bucket_id='client-documents' and (public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text)
 and lower(storage.extension(name)) in ('pdf','zip','png','jpg','jpeg','webp','html','htm','csv','xlsx','xls','docx','doc','txt','r','rmd','sav','rds','pptx'));
create policy has_storage_delete on storage.objects for delete to authenticated using(bucket_id='client-documents' and (public.is_admin() or ((storage.foldername(name))[1]=auth.uid()::text and owner_id=auth.uid()::text and not exists(select 1 from public.client_documents d where d.storage_path=name))));

create or replace function public.save_client_budget(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare bid uuid; cid uuid; pid uuid; subtotal_value numeric; discount_value numeric; i jsonb;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 cid=(payload->>'clientId')::uuid;pid=nullif(payload->>'projectId','')::uuid;bid=nullif(payload->>'id','')::uuid;
 if not exists(select 1 from public.profiles where id=cid and role='client') then raise exception 'Cliente inválido'; end if;
 if pid is not null and not exists(select 1 from public.client_projects where id=pid and client_id=cid) then raise exception 'Projeto de outro cliente'; end if;
 if length(trim(coalesce(payload->>'title','')))=0 or length(payload->>'title')>300 then raise exception 'Título inválido'; end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Itens inválidos'; end if;
 if jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Informe de 1 a 100 itens'; end if;
 discount_value=coalesce((payload->>'discountPercent')::numeric,0);
 if discount_value not between 0 and 100 then raise exception 'Desconto inválido'; end if;
 subtotal_value=0;
 for i in select * from jsonb_array_elements(payload->'items') loop
  if length(trim(coalesce(i->>'description','')))=0 or not(coalesce((i->>'quantity')::numeric,0)>0 and (i->>'quantity')::numeric<=100000) or not(coalesce((i->>'unitPrice')::numeric,-1)>=0 and (i->>'unitPrice')::numeric<=1000000) then raise exception 'Item inválido'; end if;
  if (i->>'quantity')::numeric<>round((i->>'quantity')::numeric,2) or (i->>'unitPrice')::numeric<>round((i->>'unitPrice')::numeric,2) then raise exception 'Use no máximo duas casas decimais'; end if;
  subtotal_value=subtotal_value+round((i->>'quantity')::numeric*(i->>'unitPrice')::numeric,2);
 end loop;
 if bid is null then
  bid=gen_random_uuid();
  insert into public.client_budgets(id,client_id,budget_number,title) values(bid,cid,'ORC-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(bid::text,1,8)),payload->>'title');
 else
  perform 1 from public.client_budgets where id=bid and client_id=cid for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
 end if;
 update public.client_budgets set project_id=pid,title=payload->>'title',description=payload->>'description',notes=payload->>'notes',
 valid_until=nullif(payload->>'validUntil','')::date,subtotal=subtotal_value,discount_percent=discount_value,total=round(subtotal_value*(1-discount_value/100),2),updated_at=now() where id=bid;
 delete from public.client_budget_items where budget_id=bid;
 insert into public.client_budget_items(budget_id,description,quantity,unit_price,display_order)
 select bid,value->>'description',(value->>'quantity')::numeric,(value->>'unitPrice')::numeric,ordinality-1 from jsonb_array_elements(payload->'items') with ordinality;
 return bid;
end $$;
revoke all on function public.save_client_budget(jsonb) from public,anon;
grant execute on function public.save_client_budget(jsonb) to authenticated;
commit;
