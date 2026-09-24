-- Remove somente rascunhos privados da lista ativa; conserva arquivos e histórico.
begin;
create or replace function public.discard_contract_draft(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.commercial_documents; target_budget uuid;
begin
 if not public.is_admin() then raise exception 'Acesso restrito'; end if;
 select budget_id into target_budget from public.commercial_documents where id=p_id;
 if target_budget is null then raise exception 'Contrato não encontrado'; end if;
 perform 1 from public.client_budgets where id=target_budget for update;
 select * into d from public.commercial_documents where id=p_id for update;
 if d.id is null or d.kind<>'contrato' then raise exception 'Selecione um contrato'; end if;
 if d.published_at is not null or d.decided_at is not null or d.signed_path is not null or d.signature_status<>'pendente'
    or exists(select 1 from public.budget_payments where document_id=p_id) then
   raise exception 'Contrato enviado ou com histórico do cliente não pode ser descartado';
 end if;
 if d.status='substituido' then return; end if;
 if d.status<>'rascunho' then raise exception 'Somente contratos em rascunho podem ser descartados'; end if;
 update public.commercial_documents set status='substituido' where id=p_id;
end $$;
revoke all on function public.discard_contract_draft(uuid) from public,anon;
grant execute on function public.discard_contract_draft(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
