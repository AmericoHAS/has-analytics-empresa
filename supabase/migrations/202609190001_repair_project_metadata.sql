-- Repairs the public portfolio fields, including databases missing the earlier metadata migration.
-- Safe to run more than once; retains all existing records and RLS policies.
begin;
alter table public.projects add column if not exists publication_status text;
alter table public.projects add column if not exists availability text;
alter table public.projects add column if not exists researchers text[] not null default '{}';
alter table public.projects add column if not exists project_type text not null default '';
notify pgrst, 'reload schema';
commit;
