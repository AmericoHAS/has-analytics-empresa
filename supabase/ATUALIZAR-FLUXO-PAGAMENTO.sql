-- Requer ATUALIZAR-COMERCIAL.sql anterior aplicado. Se houver dúvida, use o arquivo acumulado atualizado.
begin;
alter table public.client_budgets add column if not exists publication_partnership boolean not null default false;
alter table public.commercial_documents add column if not exists payment_option jsonb;
alter table public.commercial_documents add column if not exists offer_group uuid;
create table if not exists public.payment_settings(id integer primary key check(id=1), options jsonb not null default '[]',pix_key text not null default '',instructions text not null default 'Aguarde as instruções da HAS antes de pagar.');
insert into public.payment_settings(id,options) values(1,'[{"id":"pix","label":"Pix à vista","method":"pix","installments":1,"feePercent":0,"enabled":true}]') on conflict do nothing;
alter table public.payment_settings enable row level security;
drop policy if exists payment_settings_admin on public.payment_settings;
create policy payment_settings_admin on public.payment_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.payment_settings to authenticated;
create table if not exists public.budget_payments (
 id uuid primary key default gen_random_uuid(),budget_id uuid not null unique references public.client_budgets(id),client_id uuid not null references public.profiles(id),document_id uuid not null references public.commercial_documents(id),
 option jsonb not null,amount numeric(14,2) not null check(amount>=0),status text not null default 'assinatura' check(status in ('assinatura','solicitado','aguardando_pagamento','em_conferencia','confirmado','rejeitado')),
 instructions text not null default '',payment_url text not null default '',receipt_path text,requested_at timestamptz,confirmed_at timestamptz,confirmed_by uuid references public.profiles(id),updated_at timestamptz not null default now()
);
alter table public.budget_payments enable row level security;
drop policy if exists payment_read on public.budget_payments;
create policy payment_read on public.budget_payments for select to authenticated using(public.is_admin() or client_id=auth.uid());
grant select on public.budget_payments to authenticated;
revoke insert,update,delete on public.budget_payments from authenticated,anon;
insert into storage.buckets(id,name,public,file_size_limit) values('payment-receipts','payment-receipts',false,10485760) on conflict(id) do update set public=false,file_size_limit=10485760;
drop policy if exists receipt_read on storage.objects;
create policy receipt_read on storage.objects for select to authenticated using(bucket_id='payment-receipts' and (public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text));
drop policy if exists receipt_insert on storage.objects;
create policy receipt_insert on storage.objects for insert to authenticated with check(bucket_id='payment-receipts' and (storage.foldername(name))[1]=auth.uid()::text and lower(storage.extension(name)) in ('pdf','png','jpg','jpeg'));
drop policy if exists receipt_cleanup on storage.objects;
create policy receipt_cleanup on storage.objects for delete to authenticated using(bucket_id='payment-receipts' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.budget_payments p where p.receipt_path=name));

create or replace function public.save_client_budget_v3(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 if exists(select 1 from public.budget_payments where budget_id=nullif(payload->>'id','')::uuid and status='confirmado') then raise exception 'Pagamento confirmado: crie outro orçamento para um novo escopo'; end if;
 bid=public.save_client_budget_v2(payload);
 update public.client_budgets set publication_partnership=coalesce((payload->>'publicationPartnership')::boolean,false) where id=bid;
 return bid;
end $$;

-- Select a pre-rendered offer: no client-supplied price or document content is trusted.
create or replace function public.choose_payment_offer(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;b public.client_budgets;
begin
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null or d.client_id is distinct from auth.uid() or d.kind<>'orcamento' then raise exception 'Acesso restrito'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'enviado' or d.source_revision<>b.revision or d.payment_option is null or b.valid_until<current_date then raise exception 'Proposta indisponível ou vencida'; end if;
 if exists(select 1 from public.budget_payments where budget_id=b.id and (status<>'assinatura' or document_id in(select id from public.commercial_documents where status='aprovado' or signature_status in('recebida','validada')))) then raise exception 'Proposta já aprovada ou pagamento iniciado. Solicite revisão à HAS'; end if;
 insert into public.budget_payments(budget_id,client_id,document_id,option,amount) values(b.id,d.client_id,d.id,d.payment_option,(d.payment_option->>'total')::numeric)
 on conflict(budget_id) do update set document_id=excluded.document_id,option=excluded.option,amount=excluded.amount,updated_at=now();
end $$;

create or replace function public.request_budget_payment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments;d public.commercial_documents;
begin
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null or p.client_id is distinct from auth.uid() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p.document_id;
 if d.status<>'aprovado' or d.signature_status<>'validada' or not exists(select 1 from public.client_budgets where id=p.budget_id and revision=d.source_revision and status='aprovado') then raise exception 'Aprove a proposta e aguarde a conferência da assinatura'; end if;
 if p.status not in ('assinatura','rejeitado') then raise exception 'Pagamento já solicitado'; end if;
 update public.budget_payments set status='solicitado',requested_at=now(),updated_at=now() where id=p_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select p.client_id,id,'payment-request:'||p_id||':'||extract(epoch from now()),'Solicitação de pagamento','Confira a forma escolhida e disponibilize as instruções de pagamento.' from public.profiles where role='admin';
end $$;

create or replace function public.manage_budget_payment(p_id uuid,p_action text,p_instructions text default '',p_url text default '') returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments; d public.commercial_documents;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null then raise exception 'Pagamento não encontrado'; end if;
 select * into d from public.commercial_documents where id=p.document_id;
 if not exists(select 1 from public.client_budgets where id=p.budget_id and revision=d.source_revision and status='aprovado') or d.status<>'aprovado' or d.signature_status<>'validada' then raise exception 'Proposta ou assinatura desatualizada'; end if;
 if p_action='instrucoes' then
  if p.status not in ('solicitado','aguardando_pagamento','rejeitado') then raise exception 'Aguarde a solicitação do cliente'; end if;
  if length(p_instructions)>4000 or length(p_url)>2000 or (p_url<>'' and p_url !~ '^https://[^[:space:]]+$') then raise exception 'Use instruções válidas e link HTTPS'; end if;
  if trim(p_instructions)='' then raise exception 'Informe as instruções de pagamento'; end if;
  update public.budget_payments set instructions=p_instructions,payment_url=p_url,status='aguardando_pagamento',updated_at=now() where id=p_id;
 elsif p_action in ('confirmar','rejeitar') then
  if p.status<>'em_conferencia' then raise exception 'Nenhum comprovante aguardando conferência'; end if;
  update public.budget_payments set status=case when p_action='confirmar' then 'confirmado' else 'rejeitado' end,confirmed_at=case when p_action='confirmar' then now() end,confirmed_by=auth.uid(),updated_at=now() where id=p_id;
 else raise exception 'Ação inválida'; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(p.client_id,p.client_id,'payment-update:'||p_id||':'||extract(epoch from now()),'Pagamento atualizado','Confira as instruções e a situação do pagamento na sua área privada.');
end $$;

create or replace function public.submit_payment_receipt(p_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments;
begin
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null or p.client_id is distinct from auth.uid() or p.status not in ('aguardando_pagamento','rejeitado') then raise exception 'Envio não permitido'; end if;
 if split_part(p_path,'/',1)<>auth.uid()::text or lower(storage.extension(p_path)) not in ('pdf','png','jpg','jpeg') or not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p_path) then raise exception 'Comprovante inválido'; end if;
 update public.budget_payments set receipt_path=p_path,status='em_conferencia',updated_at=now() where id=p_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select p.client_id,id,'receipt:'||p_path,'Comprovante recebido','Confira o recebimento no banco antes de liberar a análise.' from public.profiles where role='admin';
end $$;

-- Gate only new transitions; existing in-progress analyses remain untouched.
create or replace function public.require_project_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.status='em_andamento' and old.status is distinct from new.status) or (new.stage in ('Organização do banco','Análise estatística') and new.stage is distinct from old.stage) then
  if exists(select 1 from public.client_budgets where project_id=new.id and status not in ('cancelado','expirado','recusado')) and not exists(select 1 from public.budget_payments p join public.client_budgets b on b.id=p.budget_id join public.commercial_documents d on d.id=p.document_id where b.project_id=new.id and p.status='confirmado' and b.status='aprovado' and b.revision=d.source_revision) then raise exception 'Confirme o pagamento do orçamento antes de iniciar a análise'; end if;
 end if;return new;
end $$;
drop trigger if exists require_project_payment on public.client_projects;
create trigger require_project_payment before update on public.client_projects for each row execute function public.require_project_payment();
revoke all on function public.save_client_budget_v3(jsonb),public.choose_payment_offer(uuid),public.request_budget_payment(uuid),public.manage_budget_payment(uuid,text,text,text),public.submit_payment_receipt(uuid,text) from public,anon;
grant execute on function public.save_client_budget_v3(jsonb),public.choose_payment_offer(uuid),public.request_budget_payment(uuid),public.manage_budget_payment(uuid,text,text,text),public.submit_payment_receipt(uuid,text) to authenticated;
create or replace function public.publish_commercial_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null then raise exception 'Documento não encontrado'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'rascunho' then raise exception 'Esta versão já foi disponibilizada'; end if;
 if exists(select 1 from public.budget_payments where budget_id=b.id and status='confirmado') then raise exception 'Pagamento confirmado: crie novo orçamento'; end if;
 if b.revision<>d.source_revision then raise exception 'Orçamento alterado. Gere novamente'; end if;
 if d.kind='contrato' and b.status<>'aprovado' then raise exception 'Orçamento precisa estar aprovado'; end if;
 if coalesce(d.snapshot->'provider'->>'provider_name','')='' or coalesce(d.snapshot->'provider'->>'provider_tax_id','')='' or coalesce(d.snapshot->'provider'->>'provider_address','')='' then raise exception 'Preencha os dados do prestador no modelo e gere novamente'; end if;
 update public.commercial_documents set status='substituido' where budget_id=d.budget_id and kind=d.kind and status in ('enviado','aprovado','recusado');
 update public.commercial_documents set status='enviado',published_at=now() where id=p_id or (d.offer_group is not null and offer_group=d.offer_group and budget_id=d.budget_id and source_revision=b.revision and status='rascunho');
 if d.kind='orcamento' then delete from public.budget_payments where budget_id=d.budget_id and status<>'confirmado'; end if;
 if d.kind='orcamento' then update public.client_budgets set status='enviado',sent_at=now(),approved_at=null where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(d.client_id,d.client_id,'commercial-published:'||p_id,'Novo documento disponível','Um documento comercial está disponível na sua área privada.') on conflict do nothing;
end $$;


create or replace function public.decide_commercial_document(p_id uuid,p_accept boolean,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null or d.client_id is distinct from auth.uid() then raise exception 'Acesso restrito'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'enviado' or d.source_revision<>b.revision then raise exception 'Esta versão não está disponível para aprovação'; end if;
 if b.valid_until<current_date and d.kind='orcamento' then raise exception 'Orçamento vencido. Solicite atualização'; end if;
 if d.kind='orcamento' and d.payment_option is not null and not exists(select 1 from public.budget_payments where budget_id=d.budget_id and document_id=d.id) then raise exception 'Escolha a forma de pagamento antes de aprovar'; end if;
 if p_accept and d.kind='orcamento' and d.offer_group is not null then update public.commercial_documents set status='substituido' where offer_group=d.offer_group and id<>d.id; end if;
 if length(p_note)>2000 then raise exception 'Observação muito longa'; end if;
 update public.commercial_documents set status=case when p_accept then 'aprovado' else 'recusado' end,decided_at=now(),decided_by=auth.uid(),decision_note=p_note where id=p_id;
 if d.kind='orcamento' then update public.client_budgets set status=case when p_accept then 'aprovado' else 'recusado' end,approved_at=case when p_accept then now() else null end where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'commercial-decision:'||p_id,'Resposta a documento comercial','O cliente respondeu a um documento. Confira a área administrativa.' from public.profiles where role='admin' on conflict do nothing;
end $$;


create or replace function public.submit_signed_commercial(p_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;
begin
 select * into d from public.commercial_documents where id=p_id for update;
 if d.client_id is distinct from auth.uid() or d.status not in ('enviado','aprovado') or d.signature_status in ('recebida','validada') then raise exception 'Envio não permitido'; end if;
 if not exists(select 1 from public.client_budgets where id=d.budget_id and revision=d.source_revision and status='aprovado') then raise exception 'Orçamento alterado. Solicite documento atualizado'; end if;
 if split_part(p_path,'/',1)<>auth.uid()::text or split_part(p_path,'/',2)<>'signatures' or right(lower(p_path),4)<>'.pdf' or not exists(select 1 from storage.objects where bucket_id='commercial-documents' and name=p_path) then raise exception 'Arquivo inválido'; end if;
 update public.commercial_documents set signed_path=p_path,signature_status='recebida',signed_submitted_at=now() where id=p_id;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'signature:'||p_path,'Documento devolvido','Um PDF foi devolvido para conferência da assinatura.' from public.profiles where role='admin' on conflict do nothing;
end $$;

notify pgrst,'reload schema';
commit;
