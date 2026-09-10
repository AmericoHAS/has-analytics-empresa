create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','client');
create type public.document_kind as enum ('orcamento','contrato','recibo','relatorio','arquivo');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'client',
  phone text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  summary text not null,
  details text,
  cover_path text,
  external_url text,
  technologies text[] not null default '{}',
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  content text not null check (char_length(content) between 10 and 900),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.client_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'solicitado',
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.client_projects(id) on delete cascade,
  title text not null,
  kind public.document_kind not null,
  status text not null default 'disponível',
  storage_path text,
  file_url text,
  requires_signature boolean not null default false,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.budget_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,email text not null,phone text,
  service_type text not null,title text not null,description text not null,
  desired_date date,status text not null default 'nova',created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),action text not null,
  entity_type text not null,entity_id text,created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.comments enable row level security;
alter table public.client_projects enable row level security;
alter table public.client_documents enable row level security;
alter table public.budget_requests enable row level security;
alter table public.audit_log enable row level security;

create policy "public projects" on public.projects for select using (published or public.is_admin());
create policy "admin projects" on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy "public approved comments" on public.comments for select using (approved or public.is_admin());
create policy "public submit comments" on public.comments for insert with check (approved=false);
create policy "admin comments" on public.comments for all using (public.is_admin()) with check (public.is_admin());
create policy "own profile" on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy "admin profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "own client projects" on public.client_projects for select using (client_id=auth.uid() or public.is_admin());
create policy "admin client projects" on public.client_projects for all using (public.is_admin()) with check (public.is_admin());
create policy "own documents" on public.client_documents for select using (client_id=auth.uid() or public.is_admin());
create policy "admin documents" on public.client_documents for all using (public.is_admin()) with check (public.is_admin());
create policy "public budget request" on public.budget_requests for insert with check (true);
create policy "admin budget requests" on public.budget_requests for select using (public.is_admin());
create policy "admin audit" on public.audit_log for select using (public.is_admin());

insert into storage.buckets(id,name,public) values ('project-covers','project-covers',true),('client-documents','client-documents',false) on conflict(id) do nothing;
create policy "public project covers" on storage.objects for select using (bucket_id='project-covers');
create policy "admin project cover upload" on storage.objects for all using (bucket_id='project-covers' and public.is_admin()) with check (bucket_id='project-covers' and public.is_admin());
create policy "client document access" on storage.objects for select using (bucket_id='client-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy "admin client document upload" on storage.objects for all using (bucket_id='client-documents' and public.is_admin()) with check (bucket_id='client-documents' and public.is_admin());

create index idx_comments_approved_created on public.comments(approved,created_at desc);
create index idx_projects_published_order on public.projects(published,display_order);
create index idx_client_documents_client on public.client_documents(client_id,created_at desc);
create index idx_client_projects_client on public.client_projects(client_id,created_at desc);

-- Após criar seu usuário no Authentication, torne-o administrador:
-- insert into public.profiles(id,full_name,role) values ('SEU-UUID','Haward Américo','admin');
