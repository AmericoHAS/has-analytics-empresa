-- Correção incremental: execute após o setup de atendimento. Não apaga documentos.
begin;
-- Instalações antigas podem conservar um FK que impede apagar um projeto de teste.
do $$ declare rel text; con record; begin
 foreach rel in array array['client_budgets','client_documents','budget_requests'] loop
  for con in select c.conname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.conrelid=('public.'||rel)::regclass and c.contype='f' and a.attname='project_id' loop
   execute format('alter table public.%I drop constraint %I',rel,con.conname);
  end loop;
  execute format('alter table public.%I alter column project_id drop not null',rel);
  execute format('alter table public.%I add constraint %I foreign key(project_id) references public.client_projects(id) on delete set null',rel,rel||'_project_id_fkey');
 end loop;
end $$;
-- Reinstala as funções compatíveis entre si, inclusive a função base de instalações antigas.
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
create or replace function public.save_client_budget_v3(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 if exists(select 1 from public.budget_payments where budget_id=nullif(payload->>'id','')::uuid and status='confirmado') then raise exception 'Pagamento confirmado: crie outro orçamento para um novo escopo'; end if;
 bid=public.save_client_budget_v2(payload);
 update public.client_budgets set publication_partnership=coalesce((payload->>'publicationPartnership')::boolean,false) where id=bid;
 return bid;
end $$;
create or replace function public.archive_client_budget(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 perform 1 from public.client_budgets where id=p_id for update;
 if not found then raise exception 'Orçamento não encontrado'; end if;
 if exists(select 1 from public.budget_payments where budget_id=p_id and status in('em_conferencia','confirmado')) then raise exception 'Há um pagamento em conferência ou confirmado. Resolva o pagamento antes de arquivar'; end if;
 update public.client_budgets set archived_at=now(),status='cancelado' where id=p_id;
 update public.commercial_documents set status='substituido' where budget_id=p_id and status in('enviado','rascunho');
end $$;
create or replace function public.delete_client_project(p_project_id uuid,p_client_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if not public.is_admin() then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 if exists(select 1 from public.consultation_bookings where project_id=p_project_id and status in('solicitado','confirmado')) then raise exception 'Cancele ou conclua a consultoria agendada antes de excluir o projeto';end if;
 delete from public.client_projects where id=p_project_id and client_id=p_client_id;
 get diagnostics affected=row_count;return affected=1;
end $$;

revoke all on function public.save_client_budget(jsonb),public.save_client_budget_v2(jsonb),public.save_client_budget_v3(jsonb),public.archive_client_budget(uuid),public.delete_client_project(uuid,uuid) from public,anon;
grant execute on function public.save_client_budget(jsonb),public.save_client_budget_v2(jsonb),public.save_client_budget_v3(jsonb),public.archive_client_budget(uuid),public.delete_client_project(uuid,uuid) to authenticated;
create or replace function public.create_consultation_availability(p_start timestamptz,p_end timestamptz,p_minutes integer,p_mode text,p_location text default '') returns integer language plpgsql security definer set search_path='' as $$
declare count_slots integer;
begin
 if not public.is_admin() then raise exception 'Acesso restrito' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start<=now() then raise exception 'Escolha um início futuro'; end if;
 if p_end<=p_start or p_end>p_start+interval '24 hours' then raise exception 'O fim deve ser posterior ao início, em um período de até 24 horas'; end if;
 if p_minutes is null or p_minutes not in(15,30,45,60,90,120) or mod(extract(epoch from p_end-p_start),p_minutes*60)<>0 then raise exception 'Ajuste o período à duração completa de cada reunião'; end if;
 if p_mode is null or p_mode not in('online','presencial') then raise exception 'Escolha a modalidade'; end if;
 if length(coalesce(p_location,''))>500 or (p_mode='presencial' and trim(coalesce(p_location,''))='') then raise exception 'Informe o endereço do atendimento presencial'; end if;
 perform pg_advisory_xact_lock(72619200);
 if exists(select 1 from public.consultation_slots where enabled and starts_at<p_end and ends_at>p_start) then raise exception 'O período se sobrepõe a horários existentes. Escolha um intervalo livre'; end if;
 insert into public.consultation_slots(starts_at,ends_at,mode,location) select t,t+make_interval(mins=>p_minutes),p_mode,coalesce(p_location,'') from generate_series(p_start,p_end-make_interval(mins=>p_minutes),make_interval(mins=>p_minutes)) t;
 get diagnostics count_slots=row_count; return count_slots;
end $$;
revoke all on function public.create_consultation_availability(timestamptz,timestamptz,integer,text,text) from public,anon;
grant execute on function public.create_consultation_availability(timestamptz,timestamptz,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
