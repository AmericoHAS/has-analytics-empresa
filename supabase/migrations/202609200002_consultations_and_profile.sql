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

