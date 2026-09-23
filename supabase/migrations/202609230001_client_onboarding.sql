-- Executar após REVISAO-FINAL.sql. Reaplicável; não envia e-mails.
begin;
create table if not exists public.client_onboarding (
 client_id uuid primary key references public.profiles(id) on delete cascade,
 completed_at timestamptz not null default now()
);
alter table public.client_onboarding enable row level security;
revoke all on public.client_onboarding from anon,authenticated;
grant select on public.client_onboarding to authenticated;
drop policy if exists onboarding_read on public.client_onboarding;
create policy onboarding_read on public.client_onboarding for select to authenticated using(client_id=auth.uid() or public.is_admin());

create or replace function public.client_billing_complete(p_client uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_billing_profiles b where b.client_id=p_client
 and length(trim(b.legal_name))>=2 and length(regexp_replace(b.tax_id,'[^0-9]','','g')) in(11,14)
 and b.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 and length(trim(b.phone))>=10 and length(trim(b.address))>=5 and length(trim(b.city))>=2
 and length(trim(b.state))=2 and length(regexp_replace(b.postal_code,'[^0-9]','','g'))=8);
$$;
revoke all on function public.client_billing_complete(uuid) from public,anon,authenticated;
-- Contas existentes com cadastro completo não precisam preencher novamente.
insert into public.client_onboarding(client_id)
 select p.id from public.profiles p where p.role='client' and public.client_billing_complete(p.id)
 on conflict(client_id) do nothing;
create or replace function public.complete_client_onboarding() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='client') then raise exception 'Acesso restrito ao cliente'; end if;
 if not public.client_billing_complete(auth.uid()) then raise exception 'Preencha identificação, contato e endereço antes de continuar'; end if;
 insert into public.client_onboarding(client_id) values(auth.uid()) on conflict(client_id) do nothing;
end $$;
revoke all on function public.complete_client_onboarding() from public,anon;
grant execute on function public.complete_client_onboarding() to authenticated;

create or replace function public.link_budget_request_by_email(p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; pid uuid; req public.budget_requests;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into req from public.budget_requests where id=p_request_id for update;
 if req.id is null then raise exception 'Solicitação não encontrada'; end if;
 cid=req.client_id;
 if cid is null then
  select u.id into cid from auth.users u join public.profiles p on p.id=u.id where lower(trim(u.email))=lower(trim(req.email)) and p.role='client';
 end if;
 if cid is null or not exists(select 1 from public.profiles where id=cid and role='client') then raise exception 'Cadastre primeiro o cliente com o mesmo e-mail da solicitação'; end if;
 pid=req.project_id;
 if pid is not null and not exists(select 1 from public.client_projects where id=pid and client_id=cid) then raise exception 'O projeto pertence a outra conta. Confira o vínculo antes de continuar'; end if;
 if pid is null then
  insert into public.client_projects(client_id,title,description,status,progress,stage)
   values(cid,req.title,req.description,'solicitado',0,'Recebimento e escopo') returning id into pid;
 end if;
 update public.budget_requests set client_id=cid,project_id=pid where id=req.id;
 return cid;
end $$;
revoke all on function public.link_budget_request_by_email(uuid) from public,anon;
grant execute on function public.link_budget_request_by_email(uuid) to authenticated;
-- Recupera somente vínculos que o Admin já aprovou. Solicitações sem cliente continuam pendentes.
do $$
declare req public.budget_requests; pid uuid;
begin
 for req in select r.* from public.budget_requests r join public.profiles p on p.id=r.client_id and p.role='client' where r.project_id is null for update of r loop
  insert into public.client_projects(client_id,title,description,status,progress,stage)
   values(req.client_id,req.title,req.description,'solicitado',0,'Recebimento e escopo') returning id into pid;
  update public.budget_requests set project_id=pid where id=req.id;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
