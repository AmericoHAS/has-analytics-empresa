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
