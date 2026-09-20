# Ativação do atendimento HAS Analytics

## 1. Atualize o Supabase antes do deploy

No projeto correto: **SQL Editor → New query**. Execute o conteúdo completo de `supabase/ATUALIZAR-COMERCIAL.sql` desta versão. É uma atualização cumulativa e repetível; não apaga os projetos, orçamentos nem documentos existentes. Requer as migrations iniciais de workspace já usadas pelo site.

Se a atualização comercial anterior já foi aplicada integralmente, `supabase/ATUALIZAR-ATENDIMENTO.sql` contém somente as novidades desta entrega. Execute um dos dois caminhos, não precisa executar ambos.

Novas migrations: `202609200002_consultations_and_profile`, `202609200003_lifecycle`, `202609200004_workflow_notices`, `202609200005_whatsapp_queue`, `202609200006_preserve_attendance_history`.

Criam preferências de conta, bucket privado de fotos, agenda, reservas, revisões e regras do fluxo. Documentos continuam privados, com links temporários; Word é exclusivo do admin. Outros clientes veem apenas a ocupação dos horários.

## 2. Vercel → projeto → Settings → Environment Variables

Mantenha as variáveis públicas Supabase e site existentes. Configure também:

| Nome | Valor / origem |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys → Secret keys. Somente servidor. |
| `RESEND_API_KEY` | Sua chave de envio do Resend |
| `RESEND_FROM_EMAIL` | `HAS Analytics <notificacoes@envios.hasanalytics.com.br>` (o domínio já foi verificado) |
| `SITE_URL` | `https://hasanalytics.com.br` ou o endereço principal definitivo |
| `ADMIN_NOTIFICATION_EMAIL` | Seu e-mail para receber avisos administrativos |
| `NOTIFICATIONS_ENABLED` | `true` |
| `CRON_SECRET` | Segredo aleatório forte criado por você; nunca colocar no código |

`NOTIFICATION_FROM` também é aceito como remetente; se estiver definido, tem prioridade sobre `RESEND_FROM_EMAIL`. Use apenas um ou mantenha os dois coerentes. Faça novo deploy depois de configurar.

## 3. Avisos imediatos e lembretes

No Supabase, crie **Database Webhook** para a tabela `public.notifications`, evento **INSERT**:

- Método POST, URL `https://hasanalytics.com.br/api/cron/notifications`.
- Header `Authorization`: `Bearer SEU_CRON_SECRET`.
- Header `Content-Type`: `application/json`.
- Não configure UPDATE, para evitar disparos recursivos ao registrar o envio.

Para retentativas e lembretes 24 horas / 1 hora antes das reuniões, ative `pg_cron`, `pg_net` e Vault. Em **Vault**, cadastre `has_notification_url` com a URL acima e `has_cron_secret` com o mesmo segredo da Vercel. Execute `supabase/AGENDAR-AVISOS.sql`. Esse agendamento roda a cada 5 minutos e funciona sem depender de um cron frequente da Vercel Hobby. O cron diário já existente permanece como contingência.

A aba **Avisos** mostra o estado de envio. “Aceito pelo provedor” significa que a API aceitou a mensagem, não comprova leitura nem entrega na caixa de entrada; consulte Logs no Resend para acompanhar entrega/bounce. E-mail usa chave de idempotência e retentativas limitadas. Não foram enviados avisos reais durante o desenvolvimento.

## 4. Modelos e operação

- Os três modelos originais estão em `templates/has`: orçamento, contrato e recibo. O site preenche os campos do Word e gera PDF, preservando logotipo, marca d'água, imagens e cláusulas. O PDF pode ter paginação ligeiramente diferente do Word.
- Os modelos têm identidade e assinatura visual fixas do prestador conforme os arquivos fornecidos. A imagem da assinatura não é assinatura digital gov.br. Confira o cadastro do prestador e o PDF antes de assinar; mudanças na identidade fixa devem ser feitas nos modelos Word.
- Textos extras ficam em `document_templates.native_body`; textos antigos são preservados em `body` e não são anexados automaticamente como cláusulas duplicadas.
- Admin: gere a proposta, confira cada opção de pagamento e disponibilize. O orçamento muda para Enviado e o aviso entra na fila. O cliente escolhe a opção, aprova, assina o PDF e devolve. Confira a assinatura no validador oficial.
- Gere o contrato com a opção escolhida. Informe revisões, foro e link de cobrança quando aplicável. A chave Pix/instruções vêm de Modelos Comerciais. Baixe, assine e envie o PDF assinado pela HAS no formulário do contrato; só então disponibilize.
- O cliente aprova o contrato, assina e envia contrato + comprovante juntos. Confira a assinatura e depois confirme o recebimento no banco. O comprovante não confirma pagamento automaticamente. As taxas do Mercado Pago precisam ser preenchidas no admin antes de ativar cartão.
- Os dados devem ser vinculados ao projeto em **Dados e arquivos**. Durante a análise, o percentual administrativo representa somente o trabalho estatístico; o site converte isso para o trecho intermediário da barra geral. Antes e depois, a barra acompanha as etapas registradas.
- Para liberar consultoria, envie resultados com tipo **Resultado / relatório** e projeto vinculado. HTML do R deve ser autocontido (`self_contained: true`); a visualização bloqueia rede externa, acesso à sessão, formulários e navegação superior.
- Admin → **Agenda de consultorias**: abra horários online/presenciais. Horários sobrepostos são recusados. Confirme reservas com endereço ou link criado pelo botão Google Meet. O site não cria eventos na sua conta Google automaticamente.
- Dentro de um projeto, **Abrir nova revisão** torna a rodada visível ao cliente. Envie arquivos dentro da própria revisão e use sua agenda para nova reunião.
- Após confirmação integral do pagamento, **Recibo de pagamento** usa o modelo fornecido. Informe valor por extenso e identificação da transação, confira o PDF e disponibilize. O recibo não representa pagamentos parciais.
- Arquivar orçamento retira-o da lista ativa e mantém seu histórico. Orçamentos com pagamento em conferência/confirmado não podem ser arquivados inadvertidamente.

## 5. WhatsApp opcional — integração separada do Resend

O adaptador usa a **WhatsApp Business Platform / Cloud API oficial da Meta**, não automação de WhatsApp pessoal. Fica desligado até configurar:

`WHATSAPP_ENABLED=true`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` (versão ativa da Graph API), `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE=pt_BR`, `ADMIN_WHATSAPP_NUMBER` no formato internacional `+55...`.

Crie e aprove na Meta um template de utilidade com **dois parâmetros no corpo**, nesta ordem: título do aviso e URL da área privada. Exemplo de estrutura: “HAS Analytics: {{1}}. Acesse sua conta: {{2}}”. Não inclua dados de pesquisa no template.

O cliente informa seu número e autoriza os avisos em **Perfil → Preferências de avisos**. Sem consentimento, o envio é ignorado. O admin usa o número da variável acima. Resend continua enviando e-mail. Falhas/timeout do WhatsApp ficam para conferência manual para evitar duplicação; não há retentativa automática nem confirmação de leitura. “sent” é aceite da API. Registros `processing` após interrupção do servidor devem ser conferidos na Meta antes de qualquer reenvio.

## 6. Conferência em produção

Com um cliente de teste: solicite orçamento → confira aviso admin → gere/envie → escolha pagamento/aprove/assine → valide assinatura → gere/assine/envie contrato → devolva contrato e comprovante → confirme → envie dados → inicie análise → envie relatório → reserve/confirme consulta → abra revisão. Confira e-mails, acesso privado, links PDF/Word e agenda em duas contas diferentes.

Os testes locais usam dados fictícios. Supabase, Resend, Meta e Vercel de produção não foram alterados nem acessados com credenciais nesta entrega.

## Arquivos de referência

A pasta original `Orçamentos HAS Analytics` contém também documentos preenchidos de clientes e já estava versionada no repositório. Ela permanece intacta e foi excluída do pacote de deploy por `.vercelignore`; `.gitignore` evita novas inclusões. Isso não remove arquivos já rastreados nem apaga histórico do Git. Mantenha esse arquivo de trabalho privado. Somente os três modelos em `templates/has` são usados pelo gerador.

## Desenvolvimento local nesta máquina

A extração de dependências npm na unidade H: (Google Drive) retornou erros de escrita `TAR_ENTRY_ERROR` / `EBADF` e foi interrompida. Os 53 arquivos salvos foram conferidos por hash e permanecem íntegros. A compilação e os testes passaram em cópia local fora do Drive, com configuração fictícia. Para executar o site localmente, use uma cópia em disco local fora da sincronização e rode `npm ci` com Node 22. Na Vercel, a instalação usa o `package-lock.json` atualizado e não depende da pasta `node_modules` de H:.
