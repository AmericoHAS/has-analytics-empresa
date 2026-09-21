-- Aplicar após ATUALIZAR-COMERCIAL.sql da versão anterior. Não remove dados.
begin;
-- Private profile preferences never grant access to role or billing permissions.
create table if not exists public.account_preferences (
 client_id uuid primary key references public.profiles(id), avatar_path text,
 whatsapp_opt_in boolean not null default false, whatsapp_number text not null default '',
 check(avatar_path is null or split_part(avatar_path,'/',1)=client_id::text),
 check(whatsapp_number='' or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$')
);
alter table public.account_preferences enable row level security;
drop policy if exists preferences_owner on public.account_preferences;
create policy preferences_owner on public.account_preferences for all to authenticated using(client_id=auth.uid()) with check(client_id=auth.uid());
grant select,insert,update on public.account_preferences to authenticated;
grant select on public.account_preferences to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('profile-avatars','profile-avatars',false,2097152) on conflict(id) do update set public=false,file_size_limit=2097152;
drop policy if exists avatar_owner on storage.objects;
create policy avatar_owner on storage.objects for all to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text and lower(storage.extension(name)) in('jpg','jpeg','png','webp'));

create or replace function public.create_client_notice(p_client uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 if length(trim(p_title)) not between 3 and 160 or length(trim(p_body)) not between 1 and 4000 then raise exception 'Informe título e mensagem'; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p_client,p_client,'manual:'||gen_random_uuid(),trim(p_title),trim(p_body));
end $$;
revoke all on function public.create_client_notice(uuid,text,text) from public,anon;
grant execute on function public.create_client_notice(uuid,text,text) to authenticated;

create table if not exists public.project_revisions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.client_projects(id),
 title text not null check(length(title) between 3 and 200), description text not null default '',
 enabled boolean not null default false, completed_at timestamptz, created_at timestamptz not null default now()
);
alter table public.project_revisions enable row level security;
drop policy if exists revisions_read on public.project_revisions;
create policy revisions_read on public.project_revisions for select to authenticated using(public.is_admin() or (enabled and exists(select 1 from public.client_projects p where p.id=project_id and p.client_id=auth.uid())));
drop policy if exists revisions_admin on public.project_revisions;
create policy revisions_admin on public.project_revisions for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.project_revisions to authenticated;
alter table public.client_documents add column if not exists revision_id uuid references public.project_revisions(id);
create or replace function public.check_revision_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.revision_id is not null and not exists(select 1 from public.project_revisions r join public.client_projects p on p.id=r.project_id where r.id=new.revision_id and r.enabled and p.id=new.project_id and p.client_id=new.client_id) then raise exception 'Abra a revisão deste projeto antes de enviar arquivos'; end if;
 return new;
end $$;
drop trigger if exists check_revision_document on public.client_documents;
create trigger check_revision_document before insert or update on public.client_documents for each row execute function public.check_revision_document();
create or replace function public.notify_revision_opened() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if new.enabled and (tg_op='INSERT' or not old.enabled) then
 select client_id into cid from public.client_projects where id=new.project_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(cid,cid,'revision:'||new.id,'Revisão aberta',new.title||'. Acompanhe os arquivos e orientações na área privada.') on conflict do nothing;
 end if;return new;
end $$;
drop trigger if exists notify_revision_opened on public.project_revisions;
create trigger notify_revision_opened after insert or update on public.project_revisions for each row execute function public.notify_revision_opened();

create table if not exists public.consultation_slots (
 id uuid primary key default gen_random_uuid(), starts_at timestamptz not null, ends_at timestamptz not null,
 mode text not null check(mode in('online','presencial')), location text not null default '',
 enabled boolean not null default true, check(ends_at>starts_at and ends_at<=starts_at+interval '8 hours'),
 check(mode<>'presencial' or length(trim(location))>0)
);
create table if not exists public.consultation_bookings (
 id uuid primary key default gen_random_uuid(),slot_id uuid not null references public.consultation_slots(id),
 project_id uuid not null references public.client_projects(id),client_id uuid not null references public.profiles(id),
 revision_id uuid references public.project_revisions(id),status text not null default 'solicitado' check(status in('solicitado','confirmado','concluido','cancelado')),
 meeting_url text not null default '',confirmed_location text not null default '',created_at timestamptz not null default now(),
 check(meeting_url='' or meeting_url ~ '^https://meet\.google\.com/[a-zA-Z0-9?=&/_-]+$')
);
create unique index if not exists consultation_one_booking on public.consultation_bookings(slot_id) where status<>'cancelado';
alter table public.consultation_slots enable row level security;
alter table public.consultation_bookings enable row level security;
drop policy if exists slots_read on public.consultation_slots;
create policy slots_read on public.consultation_slots for select to authenticated using(true);
drop policy if exists slots_admin on public.consultation_slots;
create policy slots_admin on public.consultation_slots for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists bookings_read on public.consultation_bookings;
create policy bookings_read on public.consultation_bookings for select to authenticated using(public.is_admin() or client_id=auth.uid());
grant select,insert,update,delete on public.consultation_slots to authenticated;
grant select on public.consultation_bookings to authenticated;
revoke insert,update,delete on public.consultation_bookings from authenticated,anon;
-- Serialize slot edits with bookings. No extension dependency, including old Supabase projects.
create or replace function public.guard_consultation_slot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(72619200);
 if tg_op<>'INSERT' and exists(select 1 from public.consultation_bookings where slot_id=old.id and status<>'cancelado') then raise exception 'Horário reservado. Cancele o agendamento antes de alterar'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.enabled and exists(select 1 from public.consultation_slots where id<>new.id and enabled and starts_at<new.ends_at and ends_at>new.starts_at) then raise exception 'Este horário se sobrepõe a outro da agenda'; end if;
 return new;
end $$;
drop trigger if exists guard_consultation_slot on public.consultation_slots;
create trigger guard_consultation_slot before insert or update or delete on public.consultation_slots for each row execute function public.guard_consultation_slot();
-- Busy flags reveal no identity, project, booking ID or meeting link of another client.
create or replace function public.list_consultation_slots() returns table(id uuid,starts_at timestamptz,ends_at timestamptz,mode text,location text,busy boolean) language sql stable security definer set search_path='' as $$
 select s.id,s.starts_at,s.ends_at,s.mode,s.location,exists(select 1 from public.consultation_bookings b where b.slot_id=s.id and b.status<>'cancelado') from public.consultation_slots s where auth.uid() is not null and s.enabled and s.ends_at>now() order by s.starts_at limit 300;
$$;
create or replace function public.book_consultation(p_slot uuid,p_project uuid,p_revision uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.consultation_slots;cid uuid;bid uuid;
begin
 perform pg_advisory_xact_lock(72619200);
 select client_id into cid from public.client_projects where id=p_project and status<>'cancelado';
 if cid is null or cid is distinct from auth.uid() then raise exception 'Acesso restrito'; end if;
 if p_revision is not null and not exists(select 1 from public.project_revisions where id=p_revision and project_id=p_project and enabled) then raise exception 'Revisão indisponível'; end if;
 if not exists(select 1 from public.client_documents where project_id=p_project and uploader_role='admin' and kind='relatorio' and (p_revision is null or revision_id=p_revision)) then raise exception 'Aguarde a disponibilização dos resultados'; end if;
 select * into s from public.consultation_slots where id=p_slot for update;
 if s.id is null or not s.enabled or s.starts_at<=now() then raise exception 'Horário indisponível'; end if;
 if exists(select 1 from public.consultation_bookings where slot_id=p_slot and status<>'cancelado') then raise exception 'Este horário acaba de ser reservado. Escolha outro'; end if;
 if exists(select 1 from public.consultation_bookings where project_id=p_project and revision_id is not distinct from p_revision and status in('solicitado','confirmado')) then raise exception 'Este projeto já tem consulta agendada'; end if;
 insert into public.consultation_bookings(slot_id,project_id,client_id,revision_id) values(p_slot,p_project,cid,p_revision) returning id into bid;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select cid,p.id,'booking:'||bid,'Consultoria solicitada','Horário: '||to_char(s.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||' (Brasília). A HAS confirmará o local ou o link da reunião.' from public.profiles p where p.role='admin' or p.id=cid;
end $$;
create or replace function public.manage_consultation(p_id uuid,p_status text,p_link text default '',p_location text default '') returns void language plpgsql security definer set search_path='' as $$
declare b public.consultation_bookings;s public.consultation_slots;
begin
 perform pg_advisory_xact_lock(72619200);
 select * into b from public.consultation_bookings where id=p_id for update;
 if b.id is null or (not public.is_admin() and (b.client_id is distinct from auth.uid() or p_status<>'cancelado')) then raise exception 'Acesso restrito'; end if;
 if b.status in('concluido','cancelado') then raise exception 'Agendamento encerrado'; end if;
 select * into s from public.consultation_slots where id=b.slot_id;
 if p_status not in('confirmado','concluido','cancelado') then raise exception 'Situação inválida'; end if;
 if p_status='confirmado' and ((s.mode='online' and p_link !~ '^https://meet\.google\.com/[a-zA-Z0-9?=&/_-]+$') or (s.mode='presencial' and trim(p_location)='')) then raise exception 'Informe o link Google Meet ou confirme o endereço presencial'; end if;
 if p_status='concluido' and (b.status<>'confirmado' or s.starts_at>now()) then raise exception 'Aguarde a reunião confirmada'; end if;
 update public.consultation_bookings set status=p_status,meeting_url=case when p_status='confirmado' then p_link else meeting_url end,confirmed_location=case when p_status='confirmado' then p_location else confirmed_location end where id=p_id;
 if p_status='concluido' then update public.client_projects set status='concluido',updated_at=now() where id=b.project_id; if b.revision_id is not null then update public.project_revisions set completed_at=now() where id=b.revision_id; end if; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select b.client_id,p.id,'booking-status:'||p_id||':'||p_status,'Consultoria '||p_status,'Confira data, local e link da reunião na área privada.' from public.profiles p where p.role='admin' or p.id=b.client_id on conflict do nothing;
end $$;
create or replace function public.enqueue_consultation_reminders() returns void language sql security definer set search_path='' as $$
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select b.client_id,p.id,'meeting-reminder:'||b.id||':'||r.kind,'Lembrete de consultoria','Reunião em '||to_char(s.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||' (Brasília). Confira local ou link na sua conta.'
 from public.consultation_bookings b join public.consultation_slots s on s.id=b.slot_id join public.profiles p on p.id=b.client_id or p.role='admin'
 cross join (values('day',interval '24 hours'),('hour',interval '1 hour')) r(kind,horizon)
 where b.status='confirmado' and s.starts_at>now() and s.starts_at<=now()+r.horizon on conflict do nothing;
$$;
revoke all on function public.list_consultation_slots(),public.book_consultation(uuid,uuid,uuid),public.manage_consultation(uuid,text,text,text),public.enqueue_consultation_reminders() from public,anon;
grant execute on function public.list_consultation_slots(),public.book_consultation(uuid,uuid,uuid),public.manage_consultation(uuid,text,text,text) to authenticated;
revoke all on function public.enqueue_consultation_reminders() from authenticated;
grant execute on function public.enqueue_consultation_reminders() to service_role;
notify pgrst,'reload schema';
commit;


begin;
alter table public.commercial_documents drop constraint if exists commercial_documents_kind_check;
alter table public.commercial_documents add constraint commercial_documents_kind_check check(kind in('orcamento','contrato','recibo'));

alter table public.document_templates add column if not exists native_body text not null default '';
create or replace function public.client_lifecycle(p_client uuid,p_project uuid default null) returns table(id uuid,title text,facts jsonb) language sql stable security definer set search_path='' as $$
 with subjects as (
 select p.id,p.title,p.id project_id,p.status,p.progress,b.id budget_id,b.revision
 from public.client_projects p left join lateral(select id,revision from public.client_budgets where project_id=p.id and status not in('cancelado','expirado','recusado') order by created_at desc limit 1)b on true
 where p.client_id=p_client and p.status<>'cancelado' and (p_project is null or p.id=p_project)
 union all select b.id,b.title,null,'solicitado',0,b.id,b.revision from public.client_budgets b where b.client_id=p_client and b.project_id is null and p_project is null and b.status not in('cancelado','expirado','recusado')
 ), visible as(select subjects.*,(select r.id from public.project_revisions r where r.project_id=subjects.project_id and r.enabled order by r.created_at desc limit 1) latest_revision from subjects where auth.uid()=p_client or public.is_admin())
 select s.id,s.title,jsonb_build_object(
 'proposalSent',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='orcamento' and d.source_revision=s.revision and d.status='enviado'),
 'proposalApproved',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='orcamento' and d.source_revision=s.revision and d.status='aprovado'),
 'proposalSigned',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='orcamento' and d.source_revision=s.revision and d.status='aprovado' and d.signature_status in('recebida','validada')),
 'contractSent',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='contrato' and d.source_revision=s.revision and d.status in('enviado','aprovado')),
 'contractSigned',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='contrato' and d.source_revision=s.revision and d.status in('enviado','aprovado') and d.signature_status in('recebida','validada')),
 'paymentSent',exists(select 1 from public.budget_payments where budget_id=s.budget_id and status in('em_conferencia','confirmado')),
 'paymentConfirmed',exists(select 1 from public.budget_payments where budget_id=s.budget_id and status='confirmado'),
 'dataReceived',exists(select 1 from public.client_documents where project_id=s.project_id and uploader_role='client' and kind='arquivo'),
 'results',exists(select 1 from public.client_documents where project_id=s.project_id and revision_id is not distinct from s.latest_revision and uploader_role='admin' and kind='relatorio'),
 'meeting',exists(select 1 from public.consultation_bookings where project_id=s.project_id and revision_id is not distinct from s.latest_revision and status in('solicitado','confirmado')),
 'meetingDone',exists(select 1 from public.consultation_bookings where project_id=s.project_id and revision_id is not distinct from s.latest_revision and status='concluido'),
 'analysis',s.status in('em_andamento','em_revisao','concluido'),'manualProgress',s.progress) from visible s;
$$;
revoke all on function public.client_lifecycle(uuid,uuid) from public,anon;
grant execute on function public.client_lifecycle(uuid,uuid) to authenticated;

-- Archive budgets with documents instead of violating the document history foreign keys.
alter table public.client_budgets add column if not exists archived_at timestamptz;
create or replace function public.archive_client_budget(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 perform 1 from public.client_budgets where id=p_id for update;
 if not found then raise exception 'Orçamento não encontrado'; end if;
 if exists(select 1 from public.budget_payments where budget_id=p_id and status in('em_conferencia','confirmado')) then raise exception 'Há um pagamento em conferência ou confirmado. Resolva o pagamento antes de arquivar'; end if;
 update public.client_budgets set archived_at=now(),status='cancelado' where id=p_id;
 update public.commercial_documents set status='substituido' where budget_id=p_id and status in('enviado','rascunho');
end $$;
revoke all on function public.archive_client_budget(uuid) from public,anon;
grant execute on function public.archive_client_budget(uuid) to authenticated;

create or replace function public.submit_contract_package(p_id uuid,p_path text,p_receipt text) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;p public.budget_payments;
begin
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null or d.client_id is distinct from auth.uid() or d.kind<>'contrato' then raise exception 'Acesso restrito'; end if;
 select * into p from public.budget_payments where budget_id=d.budget_id for update;
 if p.id is null or p.status not in('aguardando_pagamento','rejeitado','em_conferencia') then raise exception 'Aguarde as instruções de pagamento da HAS'; end if;
 if p.status='em_conferencia' and d.signature_status<>'rejeitada' then raise exception 'Documentos já estão em conferência'; end if;
 perform public.submit_signed_commercial(p_id,p_path);
 if p.status='em_conferencia' then update public.budget_payments set status='aguardando_pagamento' where id=p.id; end if;
 perform public.submit_payment_receipt(p.id,p_receipt);
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(d.client_id,d.client_id,'package:'||p_path,'Contrato e comprovante recebidos','Agora envie os dados do projeto em Dados e arquivos, caso ainda não tenha enviado. A HAS fará a conferência dos documentos.');
end $$;
revoke all on function public.submit_contract_package(uuid,text,text) from public,anon;
grant execute on function public.submit_contract_package(uuid,text,text) to authenticated;

-- Native-template contracts require the provider's signed PDF before publication.
alter table public.commercial_documents add column if not exists provider_signed boolean not null default false;
create or replace function public.guard_native_contract() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='contrato' and new.status='enviado' and old.status='rascunho' and new.snapshot->'template'->>'engine'='has-native-v1' then
 if not new.provider_signed then raise exception 'Envie o PDF do contrato assinado pela HAS antes de disponibilizar'; end if;
 if not exists(select 1 from public.budget_payments p join public.commercial_documents d on d.id=p.document_id where p.budget_id=new.budget_id and d.status='aprovado' and d.signature_status='validada' and d.source_revision=new.source_revision) then raise exception 'Confira a assinatura do orçamento antes de enviar o contrato'; end if;
 update public.budget_payments set status='aguardando_pagamento',instructions=concat_ws(E'\n',nullif(new.snapshot->'template'->>'pixKey',''),nullif(new.snapshot->'template'->>'paymentInstructions','')),payment_url=coalesce(new.snapshot->'template'->>'paymentLink',''),updated_at=now() where budget_id=new.budget_id and status in('assinatura','solicitado','rejeitado');
 end if;
 return new;
end $$;
drop trigger if exists guard_native_contract on public.commercial_documents;
create trigger guard_native_contract before update on public.commercial_documents for each row execute function public.guard_native_contract();
create or replace function public.register_provider_signature(p_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.kind<>'contrato' or d.status<>'rascunho' then raise exception 'Use um contrato em rascunho'; end if;
 if split_part(p_path,'/',1)<>d.client_id::text or split_part(p_path,'/',2)<>d.id::text or right(lower(p_path),4)<>'.pdf' or not exists(select 1 from storage.objects where bucket_id='commercial-documents' and name=p_path) then raise exception 'PDF inválido'; end if;
 update public.commercial_documents set pdf_path=p_path,provider_signed=true where id=p_id;
end $$;
revoke all on function public.register_provider_signature(uuid,text) from public,anon;
grant execute on function public.register_provider_signature(uuid,text) to authenticated;
create or replace function public.publish_commercial_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null then raise exception 'Documento não encontrado'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'rascunho' then raise exception 'Esta versão já foi disponibilizada'; end if;
 if d.kind<>'recibo' and exists(select 1 from public.budget_payments where budget_id=b.id and status='confirmado') then raise exception 'Pagamento confirmado: crie novo orçamento'; end if;
 if d.kind='recibo' and not exists(select 1 from public.budget_payments where budget_id=b.id and status='confirmado') then raise exception 'Confirme o recebimento antes de emitir recibo'; end if;
 if b.revision<>d.source_revision then raise exception 'Orçamento alterado. Gere novamente'; end if;
 if d.kind='contrato' and b.status<>'aprovado' then raise exception 'Orçamento precisa estar aprovado'; end if;
 if coalesce(d.snapshot->'provider'->>'provider_name','')='' or coalesce(d.snapshot->'provider'->>'provider_tax_id','')='' or coalesce(d.snapshot->'provider'->>'provider_address','')='' then raise exception 'Preencha os dados do prestador no modelo e gere novamente'; end if;
 update public.commercial_documents set status='substituido' where budget_id=d.budget_id and kind=d.kind and status in ('enviado','aprovado','recusado');
 update public.commercial_documents set status='enviado',published_at=now() where id=p_id or (d.offer_group is not null and offer_group=d.offer_group and budget_id=d.budget_id and source_revision=b.revision and status='rascunho');
 if d.kind='orcamento' then delete from public.budget_payments where budget_id=d.budget_id and status<>'confirmado'; end if;
 if d.kind='orcamento' then update public.client_budgets set status='enviado',sent_at=now(),approved_at=null where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(d.client_id,d.client_id,'commercial-published:'||p_id,case when d.kind='orcamento' then 'Aguardando aprovação do orçamento' when d.kind='recibo' then 'Recibo disponível' else 'Aguardando assinatura do contrato e pagamento' end,'Confira o PDF e as orientações na área privada.') on conflict do nothing;
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
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'commercial-decision:'||p_id,case when p_accept then case when d.kind='orcamento' then 'Orçamento aprovado' else 'Contrato aprovado' end else 'Cliente solicitou revisão' end,'O cliente respondeu. Confira a assinatura e a forma de pagamento na área administrativa.' from public.profiles where role='admin' on conflict do nothing;
end $$;



create or replace function public.manage_budget_payment(p_id uuid,p_action text,p_instructions text default '',p_url text default '') returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments; d public.commercial_documents;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null then raise exception 'Pagamento não encontrado'; end if;
 select * into d from public.commercial_documents where id=p.document_id;
 if not exists(select 1 from public.client_budgets where id=p.budget_id and revision=d.source_revision and status='aprovado') or d.status<>'aprovado' or d.signature_status<>'validada' then raise exception 'Proposta ou assinatura desatualizada'; end if;
 if p_action='confirmar' and exists(select 1 from public.commercial_documents where budget_id=p.budget_id and kind='contrato' and snapshot->'template'->>'engine'='has-native-v1') and not exists(select 1 from public.commercial_documents where budget_id=p.budget_id and kind='contrato' and source_revision=d.source_revision and status in('enviado','aprovado') and signature_status='validada') then raise exception 'Confira primeiro a assinatura do contrato'; end if;
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


notify pgrst,'reload schema';
commit;

begin;
create or replace function public.notify_signature_reviewed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.signature_status is distinct from old.signature_status and new.signature_status in('validada','rejeitada') then
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(new.client_id,new.client_id,'signature-review:'||new.id||':'||extract(epoch from now()),case when new.signature_status='validada' then 'Assinatura conferida pela HAS' else 'Reenvie o documento assinado' end,case when new.signature_status='validada' then 'O recebimento do documento assinado foi confirmado. Acompanhe as próximas etapas na área privada.' else 'A assinatura precisa ser corrigida. Consulte a HAS e envie novamente o PDF.' end);
 end if;return new;
end $$;
drop trigger if exists notify_signature_reviewed on public.commercial_documents;
create trigger notify_signature_reviewed after update on public.commercial_documents for each row execute function public.notify_signature_reviewed();
create or replace function public.notify_payment_data_pending() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if new.status='confirmado' and old.status is distinct from new.status then
 select project_id into pid from public.client_budgets where id=new.budget_id;
 if pid is not null and not exists(select 1 from public.client_documents where project_id=pid and uploader_role='client' and kind='arquivo') then
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(new.client_id,new.client_id,'await-data:'||new.id,'Aguardando os dados do projeto','Contrato e pagamento conferidos. Envie seu banco de dados e documentos na aba Dados e arquivos para iniciarmos a análise.') on conflict do nothing;
 end if;end if;return new;
end $$;
drop trigger if exists notify_payment_data_pending on public.budget_payments;
create trigger notify_payment_data_pending after update on public.budget_payments for each row execute function public.notify_payment_data_pending();
create or replace function public.require_native_project_data() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='em_andamento' and old.status is distinct from new.status and exists(select 1 from public.client_budgets b join public.commercial_documents d on d.budget_id=b.id where b.project_id=new.id and b.status='aprovado' and d.kind='contrato' and d.snapshot->'template'->>'engine'='has-native-v1') and not exists(select 1 from public.client_documents where project_id=new.id and kind='arquivo' and uploader_role='client') then raise exception 'Aguarde os dados do cliente antes de iniciar a análise'; end if;return new;
end $$;
drop trigger if exists require_native_project_data on public.client_projects;
create trigger require_native_project_data before update on public.client_projects for each row execute function public.require_native_project_data();
-- Refinements to document notices keep one event per uploaded file.
create or replace function public.notify_document_added() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select new.client_id,p.id,'document:'||new.id,
 case when new.uploader_role='client' then 'Dados do cliente recebidos' when new.revision_id is not null then 'Novos arquivos da revisão' when new.kind='relatorio' then 'Resultados disponíveis · agende sua consultoria' else 'Novo documento disponível' end,
 case when new.uploader_role='client' then 'O cliente enviou um arquivo. Confira os dados na área privada.' when new.kind='relatorio' then 'Seus resultados estão disponíveis. Acesse o projeto para visualizar os relatórios e escolher um horário de consultoria.' else 'A HAS disponibilizou um documento. Consulte a área privada.' end
 from public.profiles p where (p.id=new.client_id or p.role='admin') and p.id is distinct from new.uploaded_by on conflict(event_key,recipient_id) do nothing;
 return new;
end $$;
create or replace function public.notify_quote_requested() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.client_id is not null then
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select new.client_id,p.id,'quote-request:'||new.id,'Aguardando orçamento','Nova solicitação de orçamento. Abra o cliente para revisar a demanda e preparar a proposta.' from public.profiles p where p.role='admin' on conflict do nothing;
 end if;return new;
end $$;
drop trigger if exists notify_quote_requested on public.budget_requests;
create trigger notify_quote_requested after insert or update of client_id on public.budget_requests for each row execute function public.notify_quote_requested();
notify pgrst,'reload schema';
commit;

begin;
alter table public.notifications add column if not exists whatsapp_status text not null default 'pending' check(whatsapp_status in('pending','processing','sent','failed','skipped'));
alter table public.notifications add column if not exists whatsapp_error text;
alter table public.notifications add column if not exists whatsapp_sent_at timestamptz;
create or replace function public.claim_notification_whatsapp() returns setof public.notifications language sql security definer set search_path='' as $$
 with candidate as(select id from public.notifications where whatsapp_status='pending' and created_at>now()-interval '24 hours' order by created_at for update skip locked limit 1)
 update public.notifications n set whatsapp_status='processing' from candidate c where n.id=c.id returning n.*;
$$;
revoke all on function public.claim_notification_whatsapp() from public,anon,authenticated;
grant execute on function public.claim_notification_whatsapp() to service_role;
notify pgrst,'reload schema';
commit;

begin;
alter table public.project_revisions add column if not exists client_id uuid references public.profiles(id);
update public.project_revisions r set client_id=p.client_id from public.client_projects p where p.id=r.project_id and r.client_id is null;
create or replace function public.set_revision_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.project_id is not null then select client_id into new.client_id from public.client_projects where id=new.project_id; end if;
 return new;
end $$;
drop trigger if exists set_revision_owner on public.project_revisions;
create trigger set_revision_owner before insert or update on public.project_revisions for each row execute function public.set_revision_owner();
alter table public.project_revisions alter column project_id drop not null;
alter table public.project_revisions drop constraint if exists project_revisions_project_id_fkey;
alter table public.project_revisions add constraint project_revisions_project_id_fkey foreign key(project_id) references public.client_projects(id) on delete set null;
alter table public.consultation_bookings alter column project_id drop not null;
alter table public.consultation_bookings drop constraint if exists consultation_bookings_project_id_fkey;
alter table public.consultation_bookings add constraint consultation_bookings_project_id_fkey foreign key(project_id) references public.client_projects(id) on delete set null;
drop policy if exists revisions_read on public.project_revisions;
create policy revisions_read on public.project_revisions for select to authenticated using(public.is_admin() or (enabled and client_id=auth.uid()));
create or replace function public.check_revision_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.project_id is null and new.revision_id is not distinct from old.revision_id and new.client_id=old.client_id and public.is_admin() then return new; end if;
 if new.revision_id is not null and not exists(select 1 from public.project_revisions r join public.client_projects p on p.id=r.project_id where r.id=new.revision_id and r.enabled and p.id=new.project_id and p.client_id=new.client_id) then raise exception 'Abra a revisão deste projeto antes de enviar arquivos'; end if;
 return new;
end $$;
create or replace function public.delete_client_project(p_project_id uuid,p_client_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if not public.is_admin() then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 if exists(select 1 from public.consultation_bookings where project_id=p_project_id and status in('solicitado','confirmado')) then raise exception 'Cancele ou conclua a consultoria agendada antes de excluir o projeto';end if;
 delete from public.client_projects where id=p_project_id and client_id=p_client_id;
 get diagnostics affected=row_count;return affected=1;
end $$;
notify pgrst,'reload schema';
commit;

-- CORREÇÃO DE OPERAÇÕES E CALENDÁRIO 202609200007
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
