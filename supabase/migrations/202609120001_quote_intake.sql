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
