begin;
create or replace function public.notify_signature_reviewed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.signature_status is distinct from old.signature_status and new.signature_status in('validada','rejeitada') then
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(new.client_id,new.client_id,'signature-review:'||new.id||':'||extract(epoch from now()),case when new.signature_status='validada' then 'Assinatura conferida pela HAS' else 'Reenvie o documento assinado' end,case when new.signature_status='validada' then 'O recebimento do documento assinado foi confirmado. Acompanhe as próximas etapas na área privada.' else 'A assinatura precisa ser corrigida. Consulte a HAS e envie novamente o PDF.' end);
 end if;return new;
end $$;
drop trigger if exists notify_signature_reviewed on public.commercial_documents;
create trigger notify_signature_reviewed after update on public.commercial_documents for each row execute function public.notify_signature_reviewed();
create or replace function public.notify_payment_data_pending() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if new.status='confirmado' and old.status is distinct from new.status then
 select project_id into pid from public.client_budgets where id=new.budget_id;
 if pid is not null and not exists(select 1 from public.client_documents where project_id=pid and uploader_role='client' and kind='arquivo') then
 insert into public.notifications(client_id,recipient_id,event_key,title,body) values(new.client_id,new.client_id,'await-data:'||new.id,'Aguardando os dados do projeto','Contrato e pagamento conferidos. Envie seu banco de dados e documentos na aba Dados e arquivos para iniciarmos a análise.') on conflict do nothing;
 end if;end if;return new;
end $$;
drop trigger if exists notify_payment_data_pending on public.budget_payments;
create trigger notify_payment_data_pending after update on public.budget_payments for each row execute function public.notify_payment_data_pending();
create or replace function public.require_native_project_data() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='em_andamento' and old.status is distinct from new.status and exists(select 1 from public.client_budgets b join public.commercial_documents d on d.budget_id=b.id where b.project_id=new.id and b.status='aprovado' and d.kind='contrato' and d.snapshot->'template'->>'engine'='has-native-v1') and not exists(select 1 from public.client_documents where project_id=new.id and kind='arquivo' and uploader_role='client') then raise exception 'Aguarde os dados do cliente antes de iniciar a análise'; end if;return new;
end $$;
drop trigger if exists require_native_project_data on public.client_projects;
create trigger require_native_project_data before update on public.client_projects for each row execute function public.require_native_project_data();
-- Refinements to document notices keep one event per uploaded file.
create or replace function public.notify_document_added() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(client_id,recipient_id,event_key,title,body)
 select new.client_id,p.id,'document:'||new.id,
 case when new.uploader_role='client' then 'Dados do cliente recebidos' when new.revision_id is not null then 'Novos arquivos da revisão' when new.kind='relatorio' then 'Resultados disponíveis · agende sua consultoria' else 'Novo documento disponível' end,
 case when new.uploader_role='client' then 'O cliente enviou um arquivo. Confira os dados na área privada.' when new.kind='relatorio' then 'Seus resultados estão disponíveis. Acesse o projeto para visualizar os relatórios e escolher um horário de consultoria.' else 'A HAS disponibilizou um documento. Consulte a área privada.' end
 from public.profiles p where (p.id=new.client_id or p.role='admin') and p.id is distinct from new.uploaded_by on conflict(event_key,recipient_id) do nothing;
 return new;
end $$;
create or replace function public.notify_quote_requested() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.client_id is not null then
 insert into public.notifications(client_id,recipient_id,event_key,title,body) select new.client_id,p.id,'quote-request:'||new.id,'Aguardando orçamento','Nova solicitação de orçamento. Abra o cliente para revisar a demanda e preparar a proposta.' from public.profiles p where p.role='admin' on conflict do nothing;
 end if;return new;
end $$;
drop trigger if exists notify_quote_requested on public.budget_requests;
create trigger notify_quote_requested after insert or update of client_id on public.budget_requests for each row execute function public.notify_quote_requested();
notify pgrst,'reload schema';
commit;
