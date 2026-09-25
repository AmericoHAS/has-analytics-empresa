# Correção do primeiro acesso — 23/09/2026

## O que foi corrigido

- Aprovar o cadastro agora envia pelo Resend um link temporário para o cliente definir a própria senha. A senha não é enviada em texto aberto. O Admin não precisa inventar uma senha inicial.
- O projeto da solicitação é criado ao vincular a conta. Repetir a vinculação não duplica o projeto. Solicitações já vinculadas, mas sem projeto, são recuperadas pelo SQL abaixo; solicitações ainda sem cliente continuam aguardando aprovação manual.
- O primeiro acesso à área privada apresenta o formulário obrigatório de identificação, contato e endereço. A navegação do painel só é apresentada depois de salvar e confirmar a conclusão. O registro de conclusão é protegido no banco e validado pelo servidor.
- Contas existentes com cadastro completo são preservadas; não precisam preencher novamente. Contas sem os dados obrigatórios completarão o cadastro na próxima entrada. Depois, os dados continuam editáveis em Perfil, sem repetir a etapa inicial.
- Reenviar e-mail de acesso está disponível nas solicitações vinculadas e na ficha administrativa do cliente (Cadastro do cliente).
- O filtro Ativos / Concluídos / Arquivados ficou compacto, junto de “Exibir projetos”, no lado direito.
- O arquivamento continua disponível ao Admin ao editar um projeto. As proteções do histórico e a opção de restaurar foram mantidas.

## Publicação — ordem recomendada

1. No Supabase, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/ATUALIZAR-PRIMEIRO-ACESSO.sql` e execute. Ele pressupõe que a revisão anterior (`REVISAO-FINAL.sql`) já foi aplicada. É reaplicável e não envia e-mails.
2. O mesmo SQL existe em `supabase/migrations/202609230001_client_onboarding.sql`; execute apenas uma das cópias. Não reaplique SQLs antigos depois desta atualização.
3. Envie as alterações do projeto ao GitHub e publique na Vercel.
4. Para o cliente de teste já criado: **Admin → Solicitações de orçamento e acesso → Reenviar e-mail de acesso**. Não cadastre a conta novamente. Se ainda não estiver vinculada, use **Vincular ao cliente já cadastrado com este e-mail** primeiro.
5. O cliente abre o link recebido, define a senha, entra no site e completa o cadastro. O projeto deve aparecer no acompanhamento do cliente e na ficha do Admin.

## Configuração de e-mail

Nenhuma nova variável é exigida. São reutilizadas, somente no servidor:

- `RESEND_API_KEY`: chave existente do Resend.
- `NOTIFICATION_FROM` ou `RESEND_FROM_EMAIL`: remetente do domínio verificado.
- `SITE_URL` ou `NEXT_PUBLIC_SITE_URL`: endereço HTTPS do site, por exemplo `https://hasanalytics.com.br`.
- `SUPABASE_SECRET_KEY` e a URL pública do Supabase: configuração existente do servidor.

O envio de acesso é uma ação transacional explícita do Admin, independente da fila de avisos do atendimento. Não altera cron, webhook, DNS, modelos comerciais ou WhatsApp. O link usa a validade de recuperação definida no Supabase e é de uso único; reenviar gera outro link. A mensagem de sucesso informa que o Resend aceitou o envio, não garante chegada à caixa de entrada. Em caso de ausência, conferir spam e os registros de entrega no Resend.

Se ocorrer falha no e-mail após criar a conta, o sistema mantém a conta e oferece reenvio; não apaga usuário nem exige recadastro. Se faltar a migration de vinculação, informa que o projeto ficou pendente para vínculo posterior.

## Validação

- 62 testes automatizados aprovados.
- Testes PostgreSQL isolados aprovados: reaplicação da migration, recuperação de vínculos antigos, projeto único por solicitação, vínculo restrito ao Admin, isolamento entre clientes e conclusão validada do cadastro.
- Navegador local com componentes reais e serviços simulados: formulário obrigatório, salvar/liberar navegação, ausência de senha manual no formulário administrativo, filtro compacto e responsividade a 390 px.
- TypeScript e build de produção aprovados; lint sem erros, com os dois avisos preexistentes de imagens em `ProjectList.tsx`.
- Nenhum e-mail real enviado, nenhum SQL aplicado remotamente e nenhuma credencial alterada. Confirmar a entrega real do e-mail e o primeiro acesso após a publicação.
