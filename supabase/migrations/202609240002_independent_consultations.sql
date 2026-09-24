-- Aplicar após REVISAO-FINAL.sql. Conclusão técnica independente de consultoria.
-- Não cancela reservas, não altera resultados e não dispara avisos retroativos.
begin;
create or replace function public.consultation_released(p_project uuid,p_revision uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_projects p where p.id=p_project and (p.client_id=auth.uid() or public.is_admin()) and p.archived_at is null and p.status<>'cancelado' and
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
 else update public.project_revisions set analysis_completed_at=now(),completed_at=coalesce(completed_at,now()) where id=p_revision; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p.client_id,p.client_id,'analysis-complete:'||coalesce(p_revision,p_project),'Análise concluída · consultoria liberada',p.title||'. Os resultados finais estão disponíveis. Acesse Projetos e prazos para escolher um horário na agenda.') on conflict do nothing;
end $$;

create or replace function public.close_analysis_project(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.client_projects;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into p from public.client_projects where id=p_project for update;
 if p.id is null or p.archived_at is not null then raise exception 'Selecione um projeto ativo'; end if;
 if p.status='concluido' then return; end if;
 if p.analysis_completed_at is null then raise exception 'Conclua a análise antes de encerrar'; end if;
 if exists(select 1 from public.project_revisions where project_id=p.id and enabled and analysis_completed_at is null) then raise exception 'Conclua as análises das revisões abertas antes de encerrar'; end if;
 if exists(select 1 from public.budget_payments pay join public.client_budgets b on b.id=pay.budget_id where b.project_id=p.id and pay.status='confirmado' and not exists(select 1 from public.commercial_documents d where d.budget_id=b.id and d.kind='recibo' and d.status='enviado')) then raise exception 'Disponibilize o recibo do pagamento antes de encerrar'; end if;
 update public.client_projects set status='concluido',progress=100,updated_at=now() where id=p.id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p.client_id,p.client_id,'project-closed:'||p.id,'Projeto concluído',p.title||'. Documentos e resultados permanecem na sua área privada.') on conflict do nothing;
end $$;

create or replace function public.resume_project_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.enabled and (tg_op='INSERT' or not old.enabled) then
 perform 1 from public.client_projects where id=new.project_id for update;
 if not exists(select 1 from public.client_projects where id=new.project_id and analysis_completed_at is not null and archived_at is null) then raise exception 'Conclua a análise inicial e mantenha o projeto ativo antes de abrir revisão'; end if;
 if exists(select 1 from public.project_revisions where project_id=new.project_id and id<>new.id and enabled and analysis_completed_at is null) then raise exception 'Conclua a análise da revisão aberta antes de iniciar outra revisão'; end if;
 update public.client_projects set status='em_revisao',progress=0,updated_at=now() where id=new.project_id;
 end if;return new;
end $$;

create or replace function public.book_consultation(p_slot uuid,p_project uuid,p_revision uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.consultation_slots;cid uuid;bid uuid;
begin
 perform pg_advisory_xact_lock(72619200);
 select client_id into cid from public.client_projects where id=p_project and status<>'cancelado' and archived_at is null for update;
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
 if p_status='concluido' then if b.revision_id is not null then update public.project_revisions set completed_at=coalesce(completed_at,now()) where id=b.revision_id; end if; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select b.client_id,p.id,'booking-status:'||p_id||':'||p_status,'Consultoria '||p_status,'Confira data, local e link da reunião na área privada.' from public.profiles p where p.role='admin' or p.id=b.client_id on conflict do nothing;
end $$;

-- Revisões já finalizadas tecnicamente não dependem mais da data da reunião.
update public.project_revisions set completed_at=analysis_completed_at
where analysis_completed_at is not null and completed_at is null;
notify pgrst,'reload schema';
commit;
