begin;
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),client_id uuid not null references public.profiles(id),recipient_id uuid not null references public.profiles(id),
 event_key text not null,title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now(),
 email_status text not null default 'pending' check(email_status in ('pending','processing','sent','failed')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),locked_at timestamptz,sent_at timestamptz,last_error text,first_attempt_at timestamptz,
 unique(event_key,recipient_id)
);
alter table public.notifications add column if not exists first_attempt_at timestamptz;
alter table public.notifications enable row level security;
drop policy if exists has_notice_read on public.notifications;
create policy has_notice_read on public.notifications for select to authenticated using(recipient_id=auth.uid() or public.is_admin());
grant select on public.notifications to authenticated;
revoke insert,update,delete on public.notifications from anon,authenticated;
create index if not exists notices_queue on public.notifications(email_status,next_attempt_at);
create or replace function public.mark_notification_read(notice_id uuid) returns void language sql security definer set search_path=public as $$
 update public.notifications set read_at=now() where id=notice_id and (recipient_id=auth.uid() or public.is_admin());
$$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
create or replace function public.notify_document_added() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select new.client_id,p.id,'document:'||new.id,'Novo documento disponível',
 case when new.uploader_role='client' then 'O cliente enviou um arquivo. Consulte a área privada para conferir.' else 'A HAS Analytics disponibilizou um documento. Consulte a área privada para conferir.' end
 from public.profiles p where (p.id=new.client_id or p.role='admin') and p.id is distinct from new.uploaded_by
 on conflict(event_key,recipient_id) do nothing;
 return new;
end $$;
drop trigger if exists notify_document_added on public.client_documents;
create trigger notify_document_added after insert on public.client_documents for each row execute function public.notify_document_added();

create or replace function public.enqueue_deadline_notifications() returns void language plpgsql security definer set search_path=public as $$
declare today date=(now() at time zone 'America/Sao_Paulo')::date;
begin
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select p.client_id,r.id,'deadline:'||p.id||':'||d.kind||':'||d.due::text||':'||case when d.due<today then 'overdue' else 'soon' end,
 case when d.due<today then 'Prazo vencido' else 'Prazo próximo' end,
 case when d.kind='analysis' then 'O prazo de entrega da análise' else 'O prazo para envio de dados pelo cliente' end ||' é '||to_char(d.due,'DD/MM/YYYY')||'. Consulte o projeto na área privada.'
 from public.client_projects p cross join lateral (values('analysis',p.due_date),('client',p.client_due_date)) d(kind,due)
 join public.profiles r on (r.id=p.client_id or r.role='admin')
 where p.status not in ('concluido','cancelado') and d.due<=today+3
 on conflict(event_key,recipient_id) do nothing;
end $$;
-- One worker owns each row for ten minutes. Idempotency key is notification UUID.
create or replace function public.claim_notification_emails(batch_size integer default 20) returns setof public.notifications language plpgsql security definer set search_path=public as $$
begin
 update public.notifications set email_status='failed',last_error='Prazo de tentativa esgotado; revise o provedor antes de reenviar.'
 where attempts>0 and email_status in ('pending','processing') and coalesce(first_attempt_at,created_at)<now()-interval '20 hours';
 return query with candidates as (
 select id from public.notifications where (email_status='pending' or (email_status='processing' and locked_at<now()-interval '10 minutes'))
 and attempts<5 and next_attempt_at<=now() order by created_at for update skip locked limit least(greatest(batch_size,1),50)
 ) update public.notifications n set email_status='processing',locked_at=now(),first_attempt_at=coalesce(n.first_attempt_at,now()),attempts=n.attempts+1
 from candidates c where n.id=c.id returning n.*;
end $$;
revoke all on function public.enqueue_deadline_notifications(),public.claim_notification_emails(integer) from public,anon,authenticated;
grant execute on function public.enqueue_deadline_notifications(),public.claim_notification_emails(integer) to service_role;
grant all on public.notifications to service_role;
commit;
