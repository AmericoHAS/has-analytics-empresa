# Integração da página pública e orçamento — 18/09/2026

A versão visual do commit c657627 foi preservada: órbitas, logo animado, marca d’água, carrossel, gráficos interativos, navegação e seções empresariais. Esta integração corrige a foto e acrescenta o fluxo autenticado de orçamento sem remover o formulário rápido existente.

## O que foi integrado

- Foto do perfil pessoal em `public/perfil-haward.png`, ligada em `lib/public-site.ts`.
- `/orcamento` mantém o pedido rápido e oferece a opção de criar ou usar uma conta.
- `/orcamento/acesso` cadastra/autentica o cliente e envia o pedido vinculado ao perfil e a um projeto inicial.
- A solicitação é salva de forma transacional. Reenvios com o mesmo identificador não duplicam o projeto. Há validação, intervalo entre pedidos e isolamento entre contas.
- A aba administrativa existente preserva seus filtros/status e abre a ficha de clientes já vinculados. Pedidos rápidos continuam com o cadastro manual existente.
- Área do cliente inclui novo pedido e encaminha contas ainda sem perfil para completar a solicitação.
- Callback de autenticação bloqueia redirecionamentos para endereços externos.

## Configuração antes de disponibilizar o novo fluxo

1. No Supabase, SQL Editor → New query, executar `supabase/migrations/202609120001_quote_intake.sql`, depois das migrations existentes de 11/09. Não executar novamente schema.sql. A migration preserva os pedidos e o formulário rápido.
2. Supabase → Authentication → URL Configuration: manter Site URL no domínio final e adicionar às Redirect URLs:
   - `https://hasanalytics.com.br/auth/callback?next=/orcamento/acesso`
   - `https://www.hasanalytics.com.br/auth/callback?next=/orcamento/acesso`
   - `https://has-analytics-empresa.vercel.app/auth/callback?next=/orcamento/acesso`, caso esse endereço seja usado.
   Preservar os endereços já configurados para recuperação. No template Confirm signup, usar o link padrão `{{ .ConfirmationURL }}`. Para completar o retorno PKCE, abrir a confirmação no mesmo navegador do cadastro; se a conta confirmar em outro navegador, entrar novamente no formulário.
3. Conferir o SMTP do Supabase para enviar confirmação aos clientes. A chave Resend na Vercel não configura automaticamente o e-mail de autenticação. Supabase → Authentication → Email → SMTP Settings: host `smtp.resend.com`, porta `465`, usuário `resend`, senha = sua API key do Resend inserida diretamente no painel, nome `HAS Analytics`, remetente `contato@envios.hasanalytics.com.br` (domínio já verificado). Não há mudança de DNS nesta atualização. Manter cadastro por e-mail e confirmação habilitados.
4. Após enviar o código ao GitHub e concluir o deploy, testar cadastro, confirmação, solicitação, abertura do cliente no Admin e consulta do projeto na área privada. O prazo desejado não é convertido automaticamente em prazo contratado.

Documentação oficial: [SMTP Resend/Supabase](https://resend.com/docs/send-with-supabase-smtp), [envio padrão do Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls).

## Verificação e limites

- Banco PostgreSQL local isolado: migrations reaplicáveis, RLS, idempotência, limite de envio, validação, criação de perfil client e compatibilidade do pedido rápido.
- Testes de domínio, notificações e pedidos rápidos executados junto da integração.
- Build de produção com webpack e TypeScript; a cópia de validação usa dependências por junction, que não é aceita pelo Turbopack. Nenhuma configuração de build do repositório foi alterada.
- Nenhuma conta real criada, nenhum e-mail enviado e nenhuma migration aplicada no Supabase remoto durante a validação.
- O arquivo de foto original é pequeno; uma imagem de resolução maior poderá substituir a atual no mesmo caminho.
- Os dados de portfólio e comentários continuam os já publicados no Supabase. Não foram inventados depoimentos.
