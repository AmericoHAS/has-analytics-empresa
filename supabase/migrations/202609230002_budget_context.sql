-- Executar após REVISAO-FINAL.sql. Extensão compatível; não envia mensagens.
begin;
alter table public.client_budgets add column if not exists request_details jsonb;
create or replace function public.save_client_budget_with_context(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 if not(payload ? 'requestDetails') or jsonb_typeof(payload->'requestDetails')<>'object' or length((payload->'requestDetails')::text)>6000 then raise exception 'Contexto da solicitação inválido'; end if;
 if exists(select 1 from jsonb_each(payload->'requestDetails') f where jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>500) then raise exception 'Revise os campos da solicitação'; end if;
 bid=public.save_client_budget_v3(payload);
 update public.client_budgets set request_details=payload->'requestDetails' where id=bid;
 return bid;
end $$;
create or replace function public.budget_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.title,new.description,new.notes,new.total,new.discount_percent,new.valid_until,new.payment_terms,new.final_due_date,new.client_details,new.project_id,new.request_details) is distinct from row(old.title,old.description,old.notes,old.total,old.discount_percent,old.valid_until,old.payment_terms,old.final_due_date,old.client_details,old.project_id,old.request_details) then
 new.revision=old.revision+1;new.status='rascunho';new.approved_at=null;
 end if;return new;
end $$;

revoke all on function public.save_client_budget_with_context(jsonb) from public,anon;
grant execute on function public.save_client_budget_with_context(jsonb) to authenticated;
create or replace function public.submit_quote_request(p_request_id uuid,p_name text,p_phone text,p_service text,p_title text,p_description text,p_desired_date date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_email text; v_project uuid;
begin
 if v_uid is null then raise exception 'Autenticação necessária'; end if;
 select email into v_email from auth.users where id=v_uid;
 if v_email is null then raise exception 'Conta inválida'; end if;
 if p_request_id is null or p_name is null or length(trim(p_name)) not between 2 and 150 or length(coalesce(p_phone,''))>30
 or p_title is null or length(trim(p_title)) not between 5 and 200 or p_description is null or length(trim(p_description)) not between 20 and 5000
 or p_service is null or p_service not in ('Bioestatística e pesquisa','Análises reproduzíveis','Dados e soluções digitais','Orientação sobre meu projeto','Consultoria estatística','Ciência de dados e indicadores','Desenvolvimento digital','Comunicação e educação','Quero orientação sobre meu projeto')
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

notify pgrst,'reload schema';
commit;
