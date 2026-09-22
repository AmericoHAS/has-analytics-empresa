-- Revisão integrada. Executar após o setup de atendimento / CORRIGIR-OPERACOES.
-- Preserva documentos, modelos, notificações e estados existentes. Não envia mensagens diretamente.
begin;
alter table public.client_projects add column if not exists analysis_completed_at timestamptz;
alter table public.client_projects add column if not exists archived_at timestamptz;
alter table public.project_revisions add column if not exists analysis_completed_at timestamptz;
alter table public.client_documents add column if not exists is_visible boolean not null default true;
alter table public.client_budgets add column if not exists client_details jsonb;
grant select(analysis_completed_at,archived_at) on public.client_projects to authenticated;
-- Preserve release for already booked consultations only. An upload is never proof of completion.
update public.client_projects p set analysis_completed_at=b.created_at from
 (select project_id,min(created_at) created_at from public.consultation_bookings where revision_id is null and status<>'cancelado' group by project_id)b
 where p.id=b.project_id and p.analysis_completed_at is null;
update public.project_revisions r set analysis_completed_at=b.created_at from
 (select revision_id,min(created_at) created_at from public.consultation_bookings where revision_id is not null and status<>'cancelado' group by revision_id)b
 where r.id=b.revision_id and r.analysis_completed_at is null;

create or replace function public.consultation_released(p_project uuid,p_revision uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_projects p where p.id=p_project and (p.client_id=auth.uid() or public.is_admin()) and p.archived_at is null and p.status not in('cancelado','concluido') and
 case when p_revision is null then p.analysis_completed_at is not null else exists(select 1 from public.project_revisions r where r.id=p_revision and r.project_id=p.id and r.enabled and r.analysis_completed_at is not null) end);
$$;
create or replace function public.complete_project_analysis(p_project uuid,p_revision uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare p public.client_projects; finished timestamptz;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into p from public.client_projects where id=p_project for update;
 if p.id is null or p.archived_at is not null or p.status in('cancelado','concluido') then raise exception 'Selecione um projeto ativo'; end if;
 if p_revision is null then finished=p.analysis_completed_at;
 else
 select analysis_completed_at into finished from public.project_revisions where id=p_revision and project_id=p_project and enabled for update;
 if not found then raise exception 'Revisão indisponível'; end if;
 end if;
 if finished is not null then return; end if;
 if p.status not in('em_andamento','em_revisao') then raise exception 'Inicie a análise antes de concluir'; end if;
 if not exists(select 1 from public.client_documents where project_id=p_project and revision_id is not distinct from p_revision and uploader_role='admin' and kind='relatorio' and is_visible) then raise exception 'Disponibilize ao menos um resultado final do tipo Relatório antes de concluir'; end if;
 if p_revision is null then update public.client_projects set analysis_completed_at=now(),progress=100,stage='Entrega e suporte',updated_at=now() where id=p_project;
 else update public.project_revisions set analysis_completed_at=now() where id=p_revision; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p.client_id,p.client_id,'analysis-complete:'||coalesce(p_revision,p_project),'Análise concluída · consultoria liberada',p.title||'. Os resultados finais estão disponíveis. Acesse Projetos e prazos para escolher um horário na agenda.') on conflict do nothing;
end $$;
-- One source of automatic transitions, shared by data upload and payment confirmation.
create or replace function public.advance_project_analysis(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.client_projects; budget uuid;
begin
 select * into p from public.client_projects where id=p_project for update;
 if p.id is null or p.archived_at is not null or p.analysis_completed_at is not null or p.status not in('solicitado','aguardando_cliente') then return; end if;
 select id into budget from public.client_budgets where project_id=p.id and archived_at is null and status not in('cancelado','expirado','recusado') order by created_at desc limit 1;
 if exists(select 1 from public.budget_payments pay join public.client_budgets b on b.id=pay.budget_id join public.commercial_documents d on d.id=pay.document_id where b.id=budget and b.status='aprovado' and pay.status='confirmado' and d.source_revision=b.revision)
 and exists(select 1 from public.client_documents where project_id=p.id and uploader_role='client' and kind='arquivo') then
 update public.client_projects set status='em_andamento',stage='Análise estatística',updated_at=now() where id=p.id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p.client_id,p.client_id,'analysis-start:'||p.id,'Análise em andamento',p.title||'. Pagamento confirmado e dados recebidos. O próximo passo está com a HAS.') on conflict do nothing;
 end if;
end $$;
create or replace function public.sync_analysis_from_event() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if tg_table_name='budget_payments' then select project_id into pid from public.client_budgets where id=new.budget_id;
 else pid=new.project_id; end if;
 if pid is not null then perform public.advance_project_analysis(pid); end if; return new;
end $$;
drop trigger if exists sync_analysis_payment on public.budget_payments;
create trigger sync_analysis_payment after insert or update of status on public.budget_payments for each row execute function public.sync_analysis_from_event();
drop trigger if exists sync_analysis_data on public.client_documents;
create trigger sync_analysis_data after insert or update of project_id on public.client_documents for each row execute function public.sync_analysis_from_event();
create or replace function public.start_project_analysis(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 perform public.advance_project_analysis(p_project);
 if not exists(select 1 from public.client_projects where id=p_project and status='em_andamento' and archived_at is null) then raise exception 'Confira o pagamento confirmado e os dados vinculados a este projeto'; end if;
end $$;

create or replace function public.archive_analysis_project(p_project uuid,p_archive boolean default true) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 perform 1 from public.client_projects where id=p_project for update;
 if not found then raise exception 'Projeto não encontrado'; end if;
 if p_archive and exists(select 1 from public.consultation_bookings where project_id=p_project and status in('solicitado','confirmado')) then raise exception 'Conclua ou cancele a reunião antes de arquivar'; end if;
 update public.client_projects set archived_at=case when p_archive then now() end,updated_at=now() where id=p_project;
end $$;
create or replace function public.close_analysis_project(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.client_projects;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into p from public.client_projects where id=p_project for update;
 if p.id is null or p.archived_at is not null then raise exception 'Selecione um projeto ativo'; end if;
 if p.status='concluido' then return; end if;
 if p.analysis_completed_at is null then raise exception 'Conclua a análise antes de encerrar'; end if;
 if not exists(select 1 from public.consultation_bookings where project_id=p.id and revision_id is null and status='concluido') or exists(select 1 from public.consultation_bookings where project_id=p.id and status in('solicitado','confirmado')) then raise exception 'Registre a consultoria realizada antes de encerrar'; end if;
 if exists(select 1 from public.project_revisions where project_id=p.id and enabled and (completed_at is null or analysis_completed_at is null)) then raise exception 'Conclua as revisões e suas consultorias antes de encerrar'; end if;
 if exists(select 1 from public.budget_payments pay join public.client_budgets b on b.id=pay.budget_id where b.project_id=p.id and pay.status='confirmado' and not exists(select 1 from public.commercial_documents d where d.budget_id=b.id and d.kind='recibo' and d.status='enviado')) then raise exception 'Disponibilize o recibo do pagamento antes de encerrar'; end if;
 update public.client_projects set status='concluido',progress=100,updated_at=now() where id=p.id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p.client_id,p.client_id,'project-closed:'||p.id,'Projeto concluído',p.title||'. Documentos e resultados permanecem na sua área privada.') on conflict do nothing;
end $$;
-- Protect direct DELETE too; this cannot be bypassed using the table instead of the RPC.
create or replace function public.protect_project_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.progress>0 or old.status not in('solicitado','cancelado') or old.analysis_completed_at is not null
 or exists(select 1 from public.client_budgets where project_id=old.id)
 or exists(select 1 from public.client_documents where project_id=old.id)
 or exists(select 1 from public.budget_requests where project_id=old.id)
 or exists(select 1 from public.project_revisions where project_id=old.id)
 or exists(select 1 from public.consultation_bookings where project_id=old.id)
 or exists(select 1 from public.project_tasks where project_id=old.id and done)
 or exists(select 1 from public.project_private where project_id=old.id and (coalesce(admin_notes,'')<>'' or coalesce(data_assessment,'')<>'' or coalesce(department,'')<>'' or coalesce(research_area,'')<>'' or coalesce(complexity,'')<>'' or coalesce(responsible,'')<>'' or coalesce(estimated_hours,0)>0)) then raise exception 'Este projeto tem histórico. Use Arquivar para preservar os vínculos e documentos'; end if;
 return old;
end $$;
drop trigger if exists protect_project_history on public.client_projects;
create trigger protect_project_history before delete on public.client_projects for each row execute function public.protect_project_history();
-- Opening a revision resumes analysis but keeps the original delivery timestamp.
create or replace function public.resume_project_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.enabled and (tg_op='INSERT' or not old.enabled) then
 if not exists(select 1 from public.client_projects where id=new.project_id and analysis_completed_at is not null and archived_at is null) then raise exception 'Conclua a análise inicial e mantenha o projeto ativo antes de abrir revisão'; end if;
 if not exists(select 1 from public.consultation_bookings where project_id=new.project_id and status='concluido') or exists(select 1 from public.project_revisions where project_id=new.project_id and id<>new.id and enabled and completed_at is null) then raise exception 'Conclua a consultoria e as revisões abertas antes de iniciar outra revisão'; end if;
 update public.client_projects set status='em_revisao',progress=0,updated_at=now() where id=new.project_id;
 end if;return new;
end $$;
drop trigger if exists resume_project_revision on public.project_revisions;
create trigger resume_project_revision before insert or update of enabled on public.project_revisions for each row execute function public.resume_project_revision();

-- Private drafts are not exposed via metadata OR storage, including known paths.
drop policy if exists has_document_read on public.client_documents;
create policy has_document_read on public.client_documents for select to authenticated using(public.is_admin() or (client_id=auth.uid() and is_visible));
drop policy if exists has_document_upload on public.client_documents;
create policy has_document_upload on public.client_documents for insert to authenticated with check(client_id=auth.uid() and uploaded_by=auth.uid() and uploader_role='client' and kind='arquivo' and is_visible and not requires_signature and signed_at is null and file_url is null);
drop policy if exists has_storage_read on storage.objects;
create policy has_storage_read on storage.objects for select to authenticated using(bucket_id='client-documents' and (public.is_admin() or ((storage.foldername(name))[1]=auth.uid()::text and (exists(select 1 from public.client_documents d where d.storage_path=name and d.client_id=auth.uid() and d.is_visible) or (owner_id=auth.uid()::text and not exists(select 1 from public.client_documents d where d.storage_path=name))))));
create or replace function public.client_lifecycle(p_client uuid,p_project uuid default null) returns table(id uuid,title text,facts jsonb) language sql stable security definer set search_path='' as $$
 with subjects as (
 select p.id,p.title,p.id project_id,p.status,p.progress,p.analysis_completed_at,p.archived_at,b.id budget_id,b.revision
 from public.client_projects p left join lateral(select id,revision from public.client_budgets where project_id=p.id and status not in('cancelado','expirado','recusado') order by created_at desc limit 1)b on true
 where p.client_id=p_client and p.status<>'cancelado' and p.archived_at is null and (p_project is null or p.id=p_project)
 union all select b.id,b.title,null,'solicitado',0,null::timestamptz,null::timestamptz,b.id,b.revision from public.client_budgets b where b.client_id=p_client and b.project_id is null and p_project is null and b.status not in('cancelado','expirado','recusado')
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
 'completed',s.status='concluido',
 'analysisCompleted',case when s.latest_revision is null then s.analysis_completed_at is not null else exists(select 1 from public.project_revisions where id=s.latest_revision and analysis_completed_at is not null) end,
 'revision',s.latest_revision is not null,
 'results',exists(select 1 from public.client_documents where project_id=s.project_id and revision_id is not distinct from s.latest_revision and uploader_role='admin' and kind='relatorio' and is_visible),
 'meeting',exists(select 1 from public.consultation_bookings where project_id=s.project_id and revision_id is not distinct from s.latest_revision and status in('solicitado','confirmado')),
 'meetingDone',exists(select 1 from public.consultation_bookings where project_id=s.project_id and revision_id is not distinct from s.latest_revision and status='concluido'),
 'analysis',s.status in('em_andamento','em_revisao','concluido'),'manualProgress',s.progress) from visible s;
$$;
create or replace function public.book_consultation(p_slot uuid,p_project uuid,p_revision uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.consultation_slots;cid uuid;bid uuid;
begin
 perform pg_advisory_xact_lock(72619200);
 select client_id into cid from public.client_projects where id=p_project and status not in('cancelado','concluido') and archived_at is null for update;
 if cid is null or cid is distinct from auth.uid() then raise exception 'Acesso restrito'; end if;
 if p_revision is not null and not exists(select 1 from public.project_revisions where id=p_revision and project_id=p_project and enabled) then raise exception 'Revisão indisponível'; end if;
 if not public.consultation_released(p_project,p_revision) then raise exception 'Aguarde a conclusão da análise e liberação da consultoria pela HAS'; end if;
 select * into s from public.consultation_slots where id=p_slot for update;
 if s.id is null or not s.enabled or s.starts_at<=now() then raise exception 'Horário indisponível'; end if;
 if exists(select 1 from public.consultation_bookings where slot_id=p_slot and status<>'cancelado') then raise exception 'Este horário acaba de ser reservado. Escolha outro'; end if;
 if exists(select 1 from public.consultation_bookings where project_id=p_project and revision_id is not distinct from p_revision and status<>'cancelado') then raise exception 'Esta etapa já tem consultoria reservada ou realizada. Uma nova consulta requer revisão liberada pela HAS'; end if;
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
 if p_status='concluido' then if b.revision_id is not null then update public.project_revisions set completed_at=now() where id=b.revision_id; end if; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select b.client_id,p.id,'booking-status:'||p_id||':'||p_status,'Consultoria '||p_status,'Confira data, local e link da reunião na área privada.' from public.profiles p where p.role='admin' or p.id=b.client_id on conflict do nothing;
end $$;
create or replace function public.notify_document_added() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not new.is_visible then return new; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select new.client_id,p.id,'document:'||new.id,
 case when new.uploader_role='client' then 'Dados do cliente recebidos' when new.revision_id is not null then 'Novos arquivos da revisão' when new.kind='relatorio' then 'Arquivo de análise disponível' else 'Novo documento disponível' end,
 case when new.uploader_role='client' then 'O cliente enviou um arquivo. Confira os dados na área privada.' when new.kind='relatorio' then 'Há um arquivo de análise disponível. A HAS avisará quando a análise estiver concluída e a consultoria liberada.' else 'A HAS disponibilizou um documento. Consulte a área privada.' end
 from public.profiles p where (p.id=new.client_id or p.role='admin') and p.id is distinct from new.uploaded_by on conflict(event_key,recipient_id) do nothing;
 return new;
end $$;
drop trigger if exists notify_document_visibility on public.client_documents;
create trigger notify_document_visibility after update of is_visible on public.client_documents for each row when(new.is_visible and not old.is_visible) execute function public.notify_document_added();
-- No identities or private addresses from another client's booked slot.
create or replace function public.consultation_slot_available(p_slot uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.consultation_slots s where s.id=p_slot and s.enabled and s.starts_at>now() and not exists(select 1 from public.consultation_bookings b where b.slot_id=s.id and b.status<>'cancelado'))
 and (public.is_admin() or exists(select 1 from public.client_projects p where p.client_id=auth.uid() and public.consultation_released(p.id,null)) or exists(select 1 from public.project_revisions r where public.consultation_released(r.project_id,r.id)));
$$;
revoke all on function public.consultation_slot_available(uuid) from public,anon;
grant execute on function public.consultation_slot_available(uuid) to authenticated;
drop policy if exists slots_read on public.consultation_slots;
create policy slots_read on public.consultation_slots for select to authenticated using(public.is_admin() or exists(select 1 from public.consultation_bookings b where b.slot_id=consultation_slots.id and b.client_id=auth.uid()) or public.consultation_slot_available(id));
create or replace function public.list_consultation_slots() returns table(id uuid,starts_at timestamptz,ends_at timestamptz,mode text,location text,busy boolean) language sql stable security definer set search_path='' as $$
 select s.id,s.starts_at,s.ends_at,s.mode,s.location,exists(select 1 from public.consultation_bookings b where b.slot_id=s.id and b.status<>'cancelado')
 from public.consultation_slots s where auth.uid() is not null and s.enabled and s.starts_at>now() and
 (public.is_admin() or ((exists(select 1 from public.client_projects p where p.client_id=auth.uid() and public.consultation_released(p.id,null)) or exists(select 1 from public.project_revisions r where public.consultation_released(r.project_id,r.id))) and not exists(select 1 from public.consultation_bookings b where b.slot_id=s.id and b.status<>'cancelado')))
 order by s.starts_at limit 1000;
$$;
revoke all on function public.advance_project_analysis(uuid),public.sync_analysis_from_event(),public.protect_project_history(),public.resume_project_revision() from public,anon,authenticated;
revoke all on function public.consultation_released(uuid,uuid),public.complete_project_analysis(uuid,uuid),public.start_project_analysis(uuid),public.archive_analysis_project(uuid,boolean),public.close_analysis_project(uuid) from public,anon;
grant execute on function public.consultation_released(uuid,uuid),public.complete_project_analysis(uuid,uuid),public.start_project_analysis(uuid),public.archive_analysis_project(uuid,boolean),public.close_analysis_project(uuid) to authenticated;
create or replace function public.save_client_budget_v3(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 if exists(select 1 from public.budget_payments where budget_id=nullif(payload->>'id','')::uuid and status='confirmado') then raise exception 'Pagamento confirmado: crie outro orçamento para um novo escopo'; end if;
 if exists(select 1 from public.client_budgets where id=nullif(payload->>'id','')::uuid and archived_at is not null) then raise exception 'Orçamento arquivado: consulte o histórico'; end if;
 if payload ? 'clientDetails' and (jsonb_typeof(payload->'clientDetails')<>'object' or length((payload->'clientDetails')::text)>10000) then raise exception 'Dados cadastrais inválidos'; end if;
 bid=public.save_client_budget_v2(payload);
 update public.client_budgets set publication_partnership=coalesce((payload->>'publicationPartnership')::boolean,false) where id=bid;
 if payload ? 'clientDetails' then update public.client_budgets set client_details=payload->'clientDetails' where id=bid; end if;
 return bid;
end $$;

-- Snapshot identity changes invalidate old offers just like scope/price changes.
create or replace function public.budget_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.title,new.description,new.notes,new.total,new.discount_percent,new.valid_until,new.payment_terms,new.final_due_date,new.client_details,new.project_id) is distinct from row(old.title,old.description,old.notes,old.total,old.discount_percent,old.valid_until,old.payment_terms,old.final_due_date,old.client_details,old.project_id) then
 new.revision=old.revision+1;new.status='rascunho';new.approved_at=null;
 end if;return new;
end $$;
create or replace function public.archive_client_budget(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.client_budgets; paid boolean;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into b from public.client_budgets where id=p_id for update;
 if b.id is null then raise exception 'Orçamento não encontrado'; end if;
 if b.archived_at is not null then return; end if;
 if exists(select 1 from public.budget_payments where budget_id=p_id and status='em_conferencia') then raise exception 'Confira o pagamento recebido antes de arquivar'; end if;
 paid=exists(select 1 from public.budget_payments where budget_id=p_id and status='confirmado');
 if paid and not exists(select 1 from public.client_projects where id=b.project_id and status='concluido') then raise exception 'Pagamento confirmado: conclua o projeto antes de arquivar o orçamento'; end if;
 update public.client_budgets set archived_at=now(),status=case when paid then status else 'cancelado' end where id=p_id;
 if not paid then update public.commercial_documents set status='substituido' where budget_id=p_id and status in('enviado','rascunho'); end if;
end $$;

create or replace function public.enqueue_deadline_notifications() returns void language plpgsql security definer set search_path=public as $$
declare today date=(now() at time zone 'America/Sao_Paulo')::date;
begin
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select p.client_id,r.id,'deadline:'||p.id||':'||d.kind||':'||d.due::text||':'||case when d.due<today then 'overdue' else 'soon' end,
 case when d.due<today then 'Prazo vencido' else 'Prazo próximo' end,
 case when d.kind='analysis' then 'O prazo de entrega da análise' else 'O prazo para envio de dados pelo cliente' end ||' é '||to_char(d.due,'DD/MM/YYYY')||'. Consulte o projeto na área privada.'
 from public.client_projects p cross join lateral (values('analysis',p.due_date),('client',p.client_due_date)) d(kind,due)
 join public.profiles r on (r.id=p.client_id or r.role='admin')
 where p.status not in ('concluido','cancelado') and p.archived_at is null and d.due<=today+3
 and (d.kind<>'analysis' or coalesce((select r.analysis_completed_at is null from public.project_revisions r where r.project_id=p.id and r.enabled order by r.created_at desc limit 1),p.analysis_completed_at is null))
 and (d.kind<>'client' or not exists(select 1 from public.client_documents where project_id=p.id and uploader_role='client' and kind='arquivo'))
 on conflict(event_key,recipient_id) do nothing;
end $$;

-- Public quick requests have no account yet. Notify the admin through the same queue.
-- Linking the request later updates its scope without resending the same notice.
alter table public.notifications alter column client_id drop not null;
create or replace function public.notify_quote_requested() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select new.client_id,p.id,'quote-request:'||new.id,'Aguardando orçamento','Nova solicitação de orçamento. Abra Solicitações no Admin para revisar a demanda e preparar a proposta.' from public.profiles p where p.role='admin'
 on conflict(event_key,recipient_id) do update set client_id=excluded.client_id;
 return new;
end $$;


-- Return only the contact fields needed by the admin, never Auth metadata or secrets.
create or replace function public.budget_client_contact(p_client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare contact jsonb;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select jsonb_build_object('full_name',p.full_name,'phone',coalesce(p.phone,''),'email',coalesce(u.email,'')) into contact from public.profiles p join auth.users u on u.id=p.id where p.id=p_client and p.role='client';
 if contact is null then raise exception 'Cliente não encontrado'; end if;
 return contact;
end $$;
revoke all on function public.budget_client_contact(uuid) from public,anon;
grant execute on function public.budget_client_contact(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
