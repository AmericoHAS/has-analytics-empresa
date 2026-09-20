-- Optional setup after all migrations. Enable pg_cron, pg_net and Vault in Supabase.
-- In Vault create has_notification_url = https://YOUR-DOMAIN/api/cron/notifications
-- and has_cron_secret = the same strong CRON_SECRET saved in Vercel. Never commit its value.
-- Every 5 minutes: retry queue and generate 24h / 1h meeting reminders, including Vercel Hobby.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='has_notification_url') or not exists(select 1 from vault.decrypted_secrets where name='has_cron_secret') then raise exception 'Crie os dois segredos no Vault antes de agendar';end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='has-notification-dispatch';
select cron.schedule('has-notification-dispatch','*/5 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='has_notification_url' limit 1),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='has_cron_secret' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
-- For immediate dispatch, add a Supabase Database Webhook on notifications INSERT,
-- POST to the same URL and Authorization: Bearer <CRON_SECRET>. The scheduled worker is fallback.
