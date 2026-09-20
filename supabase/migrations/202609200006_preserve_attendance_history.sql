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
