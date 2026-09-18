-- Run after the earlier migrations. No project or file is deleted by this SQL.
begin;
alter table public.projects add column if not exists project_type text not null default '';

-- Preserve documents, budgets and intake requests when an admin deletes a project.
do $$ declare fk record; begin
  for fk in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
    where c.contype='f' and c.confrelid='public.client_projects'::regclass
      and c.conrelid in ('public.client_documents'::regclass, 'public.budget_requests'::regclass)
      and a.attname='project_id'
  loop execute format('alter table %s drop constraint %I',fk.tbl,fk.conname); end loop;
end $$;
alter table public.client_documents add constraint client_documents_project_id_fkey
 foreign key(project_id) references public.client_projects(id) on delete set null;
alter table public.budget_requests add constraint budget_requests_project_id_fkey
 foreign key(project_id) references public.client_projects(id) on delete set null;

-- Invoker retains RLS. This entry point exists only after preservation is configured.
create or replace function public.delete_client_project(p_project_id uuid, p_client_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if not public.is_admin() then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 delete from public.client_projects where id=p_project_id and client_id=p_client_id;
 get diagnostics affected = row_count;
 return affected=1;
end $$;
revoke all on function public.delete_client_project(uuid,uuid) from public,anon;
grant execute on function public.delete_client_project(uuid,uuid) to authenticated;
commit;
