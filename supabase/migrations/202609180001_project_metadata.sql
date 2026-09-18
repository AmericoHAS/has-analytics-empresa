begin;
alter table public.projects add column if not exists publication_status text;
alter table public.projects add column if not exists availability text;
alter table public.projects add column if not exists researchers text[] not null default '{}';
-- Existing project RLS is retained: only published projects are public; only admin writes.
commit;
