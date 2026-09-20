begin;
alter table public.commercial_documents drop constraint if exists commercial_documents_kind_check;
alter table public.commercial_documents add constraint commercial_documents_kind_check check(kind in('orcamento','contrato','recibo'));

alter table public.document_templates add column if not exists native_body text not null default '';
create or replace function public.client_lifecycle(p_client uuid,p_project uuid default null) returns table(id uuid,title text,facts jsonb) language sql stable security definer set search_path='' as $$
 with subjects as (
 select p.id,p.title,p.id project_id,p.status,p.progress,b.id budget_id,b.revision
 from public.client_projects p left join lateral(select id,revision from public.client_budgets where project_id=p.id and status not in('cancelado','expirado','recusado') order by created_at desc limit 1)b on true
 where p.client_id=p_client and p.status<>'cancelado' and (p_project is null or p.id=p_project)
 union all select b.id,b.title,null,'solicitado',0,b.id,b.revision from public.client_budgets b where b.client_id=p_client and b.project_id is null and p_project is null and b.status not in('cancelado','expirado','recusado')
 ), visible as(select subjects.*,(select r.id from public.project_revisions r where r.project_id=subjects.project_id and r.enabled order by r.created_at desc limit 1) latest_revision from subjects where auth.uid()=p_client or public.is_admin())
 select s.id,s.title,jsonb_build_object(
 'proposalSent',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='orcamento' and d.source_revision=s.revision and d.status='enviado'),
 'proposalApproved',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='orcamento' and d.source_revision=s.revision and d.status='aprovado'),
 'proposalSigned',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='orcamento' and d.source_revision=s.revision and d.status='aprovado' and d.signature_status in('recebida','validada')),
 'contractSent',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='contrato' and d.source_revision=s.revision and d.status in('enviado','aprovado')),
 'contractSigned',exists(select 1 from public.commercial_documents d where d.budget_id=s.budget_id and d.kind='contrato' and d.source_revision=s.revision and d.status in('enviado','aprovado') and d.signature_status in('recebida','validada')),
 'paymentSent',exists(select 1 from public.budget_payments where budget_id=s.budget_id and status in('em_conferencia','confirmado')),
 'paymentConfirmed',exists(select 1 from public.budget_payments where budget_id=s.budget_id and status='confirmado'),
 'dataReceived',exists(select 1 from public.client_documents where project_id=s.project_id and uploader_role='client' and kind='arquivo'),
 'results',exists(select 1 from public.client_documents where project_id=s.project_id and revision_id is not distinct from s.latest_revision and uploader_role='admin' and kind='relatorio'),
 'meeting',exists(select 1 from public.consultation_bookings where project_id=s.project_id and revision_id is not distinct from s.latest_revision and status in('solicitado','confirmado')),
 'meetingDone',exists(select 1 from public.consultation_bookings where project_id=s.project_id and revision_id is not distinct from s.latest_revision and status='concluido'),
 'analysis',s.status in('em_andamento','em_revisao','concluido'),'manualProgress',s.progress) from visible s;
$$;
revoke all on function public.client_lifecycle(uuid,uuid) from public,anon;
grant execute on function public.client_lifecycle(uuid,uuid) to authenticated;

-- Archive budgets with documents instead of violating the document history foreign keys.
alter table public.client_budgets add column if not exists archived_at timestamptz;
create or replace function public.archive_client_budget(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 perform 1 from public.client_budgets where id=p_id for update;
 if not found then raise exception 'Orçamento não encontrado'; end if;
 if exists(select 1 from public.budget_payments where budget_id=p_id and status in('em_conferencia','confirmado')) then raise exception 'Há um pagamento em conferência ou confirmado. Resolva o pagamento antes de arquivar'; end if;
 update public.client_budgets set archived_at=now(),status='cancelado' where id=p_id;
 update public.commercial_documents set status='substituido' where budget_id=p_id and status in('enviado','rascunho');
end $$;
revoke all on function public.archive_client_budget(uuid) from public,anon;
grant execute on function public.archive_client_budget(uuid) to authenticated;

create or replace function public.submit_contract_package(p_id uuid,p_path text,p_receipt text) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;p public.budget_payments;
begin
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null or d.client_id is distinct from auth.uid() or d.kind<>'contrato' then raise exception 'Acesso restrito'; end if;
 select * into p from public.budget_payments where budget_id=d.budget_id for update;
 if p.id is null or p.status not in('aguardando_pagamento','rejeitado','em_conferencia') then raise exception 'Aguarde as instruções de pagamento da HAS'; end if;
 if p.status='em_conferencia' and d.signature_status<>'rejeitada' then raise exception 'Documentos já estão em conferência'; end if;
 perform public.submit_signed_commercial(p_id,p_path);
 if p.status='em_conferencia' then update public.budget_payments set status='aguardando_pagamento' where id=p.id; end if;
 perform public.submit_payment_receipt(p.id,p_receipt);
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(d.client_id,d.client_id,'package:'||p_path,'Contrato e comprovante recebidos','Agora envie os dados do projeto em Dados e arquivos, caso ainda não tenha enviado. A HAS fará a conferência dos documentos.');
end $$;
revoke all on function public.submit_contract_package(uuid,text,text) from public,anon;
grant execute on function public.submit_contract_package(uuid,text,text) to authenticated;

-- Native-template contracts require the provider's signed PDF before publication.
alter table public.commercial_documents add column if not exists provider_signed boolean not null default false;
create or replace function public.guard_native_contract() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='contrato' and new.status='enviado' and old.status='rascunho' and new.snapshot->'template'->>'engine'='has-native-v1' then
 if not new.provider_signed then raise exception 'Envie o PDF do contrato assinado pela HAS antes de disponibilizar'; end if;
 if not exists(select 1 from public.budget_payments p join public.commercial_documents d on d.id=p.document_id where p.budget_id=new.budget_id and d.status='aprovado' and d.signature_status='validada' and d.source_revision=new.source_revision) then raise exception 'Confira a assinatura do orçamento antes de enviar o contrato'; end if;
 update public.budget_payments set status='aguardando_pagamento',instructions=concat_ws(E'\n',nullif(new.snapshot->'template'->>'pixKey',''),nullif(new.snapshot->'template'->>'paymentInstructions','')),payment_url=coalesce(new.snapshot->'template'->>'paymentLink',''),updated_at=now() where budget_id=new.budget_id and status in('assinatura','solicitado','rejeitado');
 end if;
 return new;
end $$;
drop trigger if exists guard_native_contract on public.commercial_documents;
create trigger guard_native_contract before update on public.commercial_documents for each row execute function public.guard_native_contract();
create or replace function public.register_provider_signature(p_id uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.kind<>'contrato' or d.status<>'rascunho' then raise exception 'Use um contrato em rascunho'; end if;
 if split_part(p_path,'/',1)<>d.client_id::text or split_part(p_path,'/',2)<>d.id::text or right(lower(p_path),4)<>'.pdf' or not exists(select 1 from storage.objects where bucket_id='commercial-documents' and name=p_path) then raise exception 'PDF inválido'; end if;
 update public.commercial_documents set pdf_path=p_path,provider_signed=true where id=p_id;
end $$;
revoke all on function public.register_provider_signature(uuid,text) from public,anon;
grant execute on function public.register_provider_signature(uuid,text) to authenticated;
create or replace function public.publish_commercial_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; b public.client_budgets;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into d from public.commercial_documents where id=p_id;
 if d.id is null then raise exception 'Documento não encontrado'; end if;
 select * into b from public.client_budgets where id=d.budget_id for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.status<>'rascunho' then raise exception 'Esta versão já foi disponibilizada'; end if;
 if d.kind<>'recibo' and exists(select 1 from public.budget_payments where budget_id=b.id and status='confirmado') then raise exception 'Pagamento confirmado: crie novo orçamento'; end if;
 if d.kind='recibo' and not exists(select 1 from public.budget_payments where budget_id=b.id and status='confirmado') then raise exception 'Confirme o recebimento antes de emitir recibo'; end if;
 if b.revision<>d.source_revision then raise exception 'Orçamento alterado. Gere novamente'; end if;
 if d.kind='contrato' and b.status<>'aprovado' then raise exception 'Orçamento precisa estar aprovado'; end if;
 if coalesce(d.snapshot->'provider'->>'provider_name','')='' or coalesce(d.snapshot->'provider'->>'provider_tax_id','')='' or coalesce(d.snapshot->'provider'->>'provider_address','')='' then raise exception 'Preencha os dados do prestador no modelo e gere novamente'; end if;
 update public.commercial_documents set status='substituido' where budget_id=d.budget_id and kind=d.kind and status in ('enviado','aprovado','recusado');
 update public.commercial_documents set status='enviado',published_at=now() where id=p_id or (d.offer_group is not null and offer_group=d.offer_group and budget_id=d.budget_id and source_revision=b.revision and status='rascunho');
 if d.kind='orcamento' then delete from public.budget_payments where budget_id=d.budget_id and status<>'confirmado'; end if;
 if d.kind='orcamento' then update public.client_budgets set status='enviado',sent_at=now(),approved_at=null where id=d.budget_id; end if;
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(d.client_id,d.client_id,'commercial-published:'||p_id,case when d.kind='orcamento' then 'Aguardando aprovação do orçamento' when d.kind='recibo' then 'Recibo disponível' else 'Aguardando assinatura do contrato e pagamento' end,'Confira o PDF e as orientações na área privada.') on conflict do nothing;
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
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select d.client_id,id,'commercial-decision:'||p_id,case when p_accept then case when d.kind='orcamento' then 'Orçamento aprovado' else 'Contrato aprovado' end else 'Cliente solicitou revisão' end,'O cliente respondeu. Confira a assinatura e a forma de pagamento na área administrativa.' from public.profiles where role='admin' on conflict do nothing;
end $$;



create or replace function public.manage_budget_payment(p_id uuid,p_action text,p_instructions text default '',p_url text default '') returns void language plpgsql security definer set search_path='' as $$
declare p public.budget_payments; d public.commercial_documents;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select * into p from public.budget_payments where id=p_id for update;
 if p.id is null then raise exception 'Pagamento não encontrado'; end if;
 select * into d from public.commercial_documents where id=p.document_id;
 if not exists(select 1 from public.client_budgets where id=p.budget_id and revision=d.source_revision and status='aprovado') or d.status<>'aprovado' or d.signature_status<>'validada' then raise exception 'Proposta ou assinatura desatualizada'; end if;
 if p_action='confirmar' and exists(select 1 from public.commercial_documents where budget_id=p.budget_id and kind='contrato' and snapshot->'template'->>'engine'='has-native-v1') and not exists(select 1 from public.commercial_documents where budget_id=p.budget_id and kind='contrato' and source_revision=d.source_revision and status in('enviado','aprovado') and signature_status='validada') then raise exception 'Confira primeiro a assinatura do contrato'; end if;
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


notify pgrst,'reload schema';
commit;
