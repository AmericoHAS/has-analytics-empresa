# Revisão final integrada — HAS Analytics

Data: 22/09/2026. Base preservada: commit `ee15881`.
Projeto de destino: `H:\Meu Drive\6. Empresarial\has-analytics-empresa`.

## 1. Problemas encontrados e correções

- Upload de qualquer relatório liberava consultoria, mesmo preliminar. Agora só a ação administrativa explícita conclui a análise.
- Pagamento confirmado e dados vinculados não avançavam o status. Ambos os eventos agora usam a mesma transição no banco, independentemente da ordem de chegada.
- Reunião realizada encerrava o projeto cedo demais. Consultoria, revisão, recibo e encerramento agora são etapas distintas.
- Projeto com histórico podia ser apagado e perder os vínculos. A exclusão direta e a função de exclusão agora recusam esses casos; o arquivamento preserva as relações.
- Orçamentos arquivados não tinham lista própria. Há histórico consultável, com downloads preservados e edição bloqueada.
- O contrato usava a logo como marca-d’água e podia imprimir texto sobre a faixa superior nas páginas seguintes. Corrigidas a seleção da imagem e a fragmentação da impressão.
- A proposta dependia de dados atuais do perfil. Agora salva uma cópia cadastral editável por orçamento, sem sobrescrever revisões manuais ao gerar documentos novamente.
- Avisos de prazo podiam continuar após dados recebidos/análise concluída. A consulta de prazos foi alinhada às etapas.
- Solicitações públicas sem conta não geravam aviso ao Admin. Passam pela mesma fila existente; vincular uma conta depois não duplica o aviso.

## 2. Lifecycle e barra de progresso

Fonte comum: função SQL `client_lifecycle` + `lib/workspace/lifecycle.ts`, usada por Admin, Cliente e avisos de pendência.

| Marco | Progresso visual |
| --- | --- |
| Solicitação / orçamento a preparar | 5% |
| Orçamento disponível | 10% |
| Aprovação / assinatura da proposta | 20–25% |
| Contrato, pagamento e envio dos dados | 30–50% |
| Em análise | 50–85%, conforme percentual manual do Admin |
| Análise concluída / consultoria liberada | 90% |
| Consultoria reservada / confirmada | 95% |
| Consultoria realizada / finalização com a HAS | 98% |
| Projeto encerrado | 100% |

Não foram criados novos valores de status. Permanecem `solicitado`, `em_andamento`, `aguardando_cliente`, `em_revisao`, `concluido` e `cancelado`. O arquivamento é uma data separada, preservando o status anterior.

Novos uploads e confirmações de pagamento avançam automaticamente os projetos elegíveis. O percentual manual não é zerado por uploads posteriores. Para atendimentos antigos que já tinham pagamento/dados antes da migration, o Admin dispõe de **Iniciar análise com dados recebidos**; não há disparo retroativo em massa durante a atualização.

Ações atualizam imediatamente os componentes da sessão. Outras sessões consultam periodicamente o banco (15–30 segundos nas consultas principais); não dependem de um novo cache SSR. Ao voltar à janela, a barra também é atualizada.

## 3. Conclusão explícita e revisões

**Concluir análise e liberar consultoria** exige projeto ativo, análise iniciada e pelo menos um relatório visível vinculado à etapa. O Admin confirma que os arquivos são finais. Registra data/hora, atualiza progresso e cria um aviso idempotente para o cliente na fila existente de e-mail.

Uploads permanecem independentes dessa conclusão. Relatório intermediário não libera calendário. Revisões têm conclusão própria; abri-las reinicia o percentual manual da nova etapa, preservando a entrega original. Uma nova revisão exige consultoria realizada e conclusão das revisões anteriores.

**Encerrar projeto após revisões e recibo** verifica análise, reuniões, revisões pendentes e recibo dos pagamentos confirmados. A reunião realizada, sozinha, não encerra o projeto.

Para preservar consultas já reservadas antes da atualização, a liberação legada é inferida da reserva existente. A data utilizada nessa compatibilidade é a criação da reserva, não uma nova afirmação sobre a data histórica real de conclusão da análise. Novas conclusões registram a data real da ação.

## 4. Agenda e consultorias

Mantido o calendário existente de semana/dia, navegação e criação de períodos divididos por duração. Acrescentada edição de início, duração, modalidade e endereço de horários livres, além da remoção da disponibilidade. Reservas confirmadas ganham identificação visual própria.

As constraints originais de duração, modalidade e endereço permanecem. Sobreposição e alterações em horários reservados continuam bloqueadas no banco. A reserva também trava o projeto para evitar concorrência com seu arquivamento.

O Cliente só agenda após liberação explícita. Horários ocupados de outros clientes não são retornados pela função nem pela leitura direta protegida. Sua própria reunião continua visível. Não são permitidas reservas repetidas da mesma etapa após uma consulta realizada; uma nova consulta pertence a uma revisão liberada.

A criação do link Google Meet continua manual pelo botão existente; o Admin informa o link e confirma. Não foi adicionada integração com Google Calendar/Meet.

## 5. Preenchimento automático do orçamento

Origem dos dados: cadastro de faturamento, contato da conta, solicitação, projeto e planejamento interno, além dos Modelos Comerciais existentes.

- Identificação, CPF/CNPJ, contato, endereço, instituição e representante ficam editáveis na proposta.
- O e-mail da conta pode ser recuperado pelo Admin por uma função restrita, sem expor chaves ou metadados de autenticação ao navegador.
- Solicitação fornece título, descrição, informações de entrada e prazo desejado.
- Projeto fornece descrição/prazo; planejamento fornece departamento, avaliação, complexidade e horas quando preenchidos.
- Dados revisados ficam em `client_budgets.client_details`; gerar contrato/recibo usa essa cópia.
- Campos salvos deliberadamente vazios não são substituídos por padrões ao reabrir a proposta.
- Três itens iniciais, catálogo, valores, observações, parceria de publicação e desconto editável permanecem.
- Taxas e parcelamento continuam usando os Modelos Comerciais; a escolha aprovada pelo cliente continua sendo a origem do contrato e recibo.

Orçamentos antigos sem cópia cadastral continuam usando o cadastro existente até a primeira revisão/salvamento. Dados obrigatórios ausentes são solicitados com uma mensagem antes da geração.

## 6. Orçamento, contrato e recibo

| Documento | DOCX | PDF | Imagens |
| --- | --- | --- | --- |
| Orçamento | Gerado, campos preenchidos e imagens originais preservadas | Gerado e páginas conferidas | Logo 1, assinatura 2, marca-d’água 3 |
| Contrato | Gerado, campos preenchidos e imagens originais preservadas | Gerado; marca-d’água e paginação corrigidas | Logo 1, assinatura 2, marca-d’água 3 |
| Recibo | Gerado, campos preenchidos e imagens originais preservadas | Gerado e página conferida | Logo 1, assinatura 2, marca-d’água 3 |

Arquivos oficiais em `templates/has/` não foram alterados. Conferência visual das seis páginas dos exemplos padrão: orçamento 2, contrato 3, recibo 1. Testado também documento com texto longo. Não houve mudança no design oficial, compressão do aceite ou remoção de assinatura/marca-d’água.

`next.config.ts` foi preservado, incluindo `./node_modules/playwright-core/**/*`, Chromium e os demais arquivos de tracing. Docxtemplater, docx-preview e Chromium/Playwright continuam responsáveis pela geração. O ajuste de paginação somente impede que o contêiner flexível atravesse a margem de impressão.

A integridade e preenchimento dos DOCX foram testados; a visualização utilizada foi a própria conversão DOCX → PDF do sistema. Não foi feita inspeção no aplicativo Microsoft Word.

## 7. Arquivamento, exclusão e documentos

Projetos: filtros **Ativos / Concluídos / Arquivados**, arquivar/restaurar e exclusão definitiva apenas sem histórico relevante. Orçamentos, arquivos, solicitações, revisões, reuniões, progresso e atividades concluídas impedem exclusão destrutiva.

Orçamentos: histórico separado; pagamento em conferência impede arquivamento. Pagamento confirmado só permite arquivar depois de concluir o projeto, mantendo pagamento e documentos. Arquivo, aprovação, assinatura e download continuam vinculados.

Documentos: envio pode ficar **interno** ou ser disponibilizado ao cliente. A proteção vale tanto para metadados quanto para Storage, não apenas para esconder um botão. Aviso é criado ao disponibilizar, uma única vez por arquivo/destinatário. Projetos únicos são selecionados automaticamente no envio, reduzindo arquivos sem vínculo.

Buckets continuam privados. Downloads usam autorização e URLs temporárias; Word continua exclusivo do Admin. Relatórios HTML continuam em visualização isolada com recursos externos bloqueados.

## 8. Botões, layout e experiência

Removidos os controles visíveis de pausa da página pública, comentários e login; as animações e a preferência de movimento reduzido permanecem. Comentários também pausam durante foco/leitura com o cursor.

Ações adicionadas/ajustadas: iniciar análise legada pronta, concluir análise/revisão, encerrar projeto, arquivar/restaurar projeto, editar/remover disponibilidade, consultar orçamentos arquivados e controlar visibilidade dos arquivos.

Ações incompatíveis com versões arquivadas não são oferecidas como edição/publicação. Avisos e revisões têm proteção de carregamento/feedback. Recibo trata falhas de envio. Grupos de botões possuem espaçamento, quebra responsiva, foco visível e separação das ações destrutivas.

Mantidos sidebar, identidade azul/navy/ciano, páginas públicas e módulos atuais. Auditoria estática abrangeu rotas, formulários, ações, downloads, autenticação, notificações e permissões. As interações locais abaixo foram exercitadas; não se afirma que todos os botões foram clicados numa sessão real em produção.

## 9. Segurança e notificações

RLS continua separando clientes e administração. Testados: tentativa de concluir análise por cliente, confirmação de pagamento indevida, consulta de outro cliente, arquivos internos, Word privado, reservas prematuras e leitura de horários ocupados por outro cliente elegível.

Resend, `notifications`, cron, Database Webhook, Vault, pg_net, pg_cron, idempotência e retries foram preservados. Novos eventos usam a fila existente. `notifications.client_id` passa a aceitar nulo somente para acomodar solicitações públicas ainda sem conta; destinatários e acesso permanecem protegidos.

O módulo de cliente privilegiado está explicitamente marcado como exclusivo do servidor. Nenhum secret foi colocado em variável `NEXT_PUBLIC_*` ou inserido no navegador.

WhatsApp: adaptador, fila, consentimento, telefone e campos de rastreamento preservados. `WHATSAPP_ENABLED` ausente ou `false` retorna antes de consultar a fila Meta/credenciais. Teste isolado comprovou que o e-mail continua funcionando. Nenhuma chamada real ao WhatsApp ou Resend foi realizada. Botões de conversa manual permanecem. Não foi possível verificar o valor atual da variável na Vercel; deixe-a explicitamente `false` nos ambientes.

## 10. Aplicação no Supabase e Vercel

1. No Supabase, **SQL Editor → New query**, executar integralmente `supabase/REVISAO-FINAL.sql`. Pré-requisito: setup existente e migrations até `202609200007_operations_and_calendar.sql`. Se essa correção anterior ainda não foi aplicada, executar `CORRIGIR-OPERACOES.sql` antes da revisão final.
2. O arquivo `REVISAO-FINAL.sql` é equivalente à migration `202609220001_final_workflow.sql`. Usar um dos dois; não é necessário executar ambos. A atualização foi testada duas vezes sobre banco fictício já populado. Não executar os scripts cumulativos antigos depois desta revisão, pois eles reinstalam versões anteriores de funções.
3. Publicar os arquivos no GitHub e aguardar o deploy da Vercel. Nada foi enviado ao GitHub ou publicado por esta revisão.
4. Manter os webhooks/cron/Vault e todas as credenciais que já funcionam. Não há alteração de domínio, DNS ou bucket público.
5. Em projetos antigos já pagos e com dados, usar **Iniciar análise com dados recebidos**, se aparecer. Relatórios enviados anteriormente não são considerados conclusão automática: usar **Concluir análise e liberar consultoria** quando forem finais.
6. Fazer um atendimento fictício controlado após o deploy para validar a sessão, PDFs na Vercel, links assinados e entrega efetiva do Resend. Usar contas de teste; os testes locais não enviaram mensagens reais.

### Variáveis de ambiente

Não há nova credencial obrigatória.

| Nome | Finalidade / origem | Obrigatoriedade | Ambientes |
| --- | --- | --- | --- |
| `WHATSAPP_ENABLED=false` | Controle de ativação; valor literal, sem obter token | Ausência já desativa; definir `false` explicitamente para garantir | Production e Preview |
| `NOTIFICATIONS_ENABLED` | Controle existente de envio de e-mail | Preservar `true` em produção se já está funcionando; `false` em Preview de teste | Production / Preview conforme finalidade |
| `RESEND_API_KEY` | Chave existente no painel Resend | Já necessária ao envio; não alterar | Production; Preview só em ambiente controlado |
| `NOTIFICATION_FROM` ou `RESEND_FROM_EMAIL` | Remetente já verificado no Resend | Preservar configuração existente | Mesmo ambiente do envio |
| `CRON_SECRET` | Segredo existente compartilhado com agendamento/webhook | Preservar; não gerar outro nesta atualização | Production; Preview isolado se houver cron próprio |
| `SUPABASE_SECRET_KEY` | Chave de servidor existente do Supabase | Preservar | Somente servidor |
| `SITE_URL` / `NEXT_PUBLIC_SITE_URL` | URL do portal já configurada | Preservar URL HTTPS de produção | Production / URL própria de Preview |

Não são exigidos `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` nem outros dados da Meta. Nenhuma variável secreta deve ter prefixo `NEXT_PUBLIC_`.

## 11. Validação e limites

- Lint: aprovado sem erros; dois warnings preexistentes de `<img>` em `components/admin/ProjectList.tsx`, mantido sem alterações para preservar as prévias do portfólio.
- Testes automatizados: **57 aprovados**, sem falhas.
- PostgreSQL isolado (PGlite): migrations reaplicáveis, fluxo completo, dados antes/depois do pagamento, idempotência, RLS, exclusão segura, agenda e história financeira aprovados.
- TypeScript: aprovado; também verificado pelo build.
- Build de produção Next.js: aprovado na cópia local independente, sem modificar `node_modules` do H:.
- Testes locais de navegador com componentes reais e dados simulados: bloqueio/liberação de agenda, ação de conclusão, edição de horário, dados cadastrais editáveis, três itens padrão e larguras desktop/mobile, sem erros de execução.
- PDF/DOCX: geração dos três modelos, campos, valores, imagens, aceite e paginação conferidos.
- Dependências não foram atualizadas. Validação local usou Node 24; o projeto continua configurado para Node 22 na Vercel. A execução final nessa infraestrutura deve ser confirmada após o deploy.

Não foram testados com serviços reais: autenticação de contas de produção, envio real pelo Resend, disparo efetivo do webhook/cron/Vault, Storage remoto ou Chromium Linux da Vercel. Foram preservadas as configurações existentes. Nenhum SQL foi executado em produção; nenhum dado real, secret, arquivo remoto ou domínio foi alterado.

## 12. Arquivos alterados

A lista abaixo contém apenas os arquivos desta entrega. Templates oficiais, `next.config.ts`, arquivos de dependências e portfólio não foram substituídos.

- `app/additions.css`
- `app/admin/commercial-actions.ts`
- `app/login/page.tsx`
- `app/public.css`
- `components/Comments.tsx`
- `components/admin/BudgetPlanningFields.tsx`
- `components/admin/ClientBudgetManager.tsx`
- `components/public/PublicExperience.tsx`
- `components/workspace/AccountAccess.tsx`
- `components/workspace/AdminDeadlines.tsx`
- `components/workspace/ClientWorkspace.tsx`
- `components/workspace/CommercialDocuments.tsx`
- `components/workspace/ConsultationCalendar.tsx`
- `components/workspace/Consultations.tsx`
- `components/workspace/Documents.tsx`
- `components/workspace/Notifications.tsx`
- `components/workspace/ProjectLifecycle.tsx`
- `components/workspace/Projects.tsx`
- `components/workspace/Receipts.tsx`
- `components/workspace/WorkflowOverview.tsx`
- `components/workspace/useLifecycle.ts`
- `lib/commercial/budget-input.ts`
- `lib/commercial/template-engine.ts`
- `lib/supabase/admin.ts`
- `lib/workspace/action-errors.ts`
- `lib/workspace/budget-operations.ts`
- `lib/workspace/calendar.ts`
- `lib/workspace/delete-project.ts`
- `lib/workspace/lifecycle.ts`
- `lib/workspace/types.ts`
- `tests/budget-operations.test.mjs`
- `tests/commercial-documents.test.mjs`
- `tests/lifecycle.test.mjs`
- `tests/notifications.test.mjs`
- `tests/sql.integration.mjs`
- `lib/commercial/budget-defaults.ts`
- `supabase/migrations/202609220001_final_workflow.sql`
- `supabase/REVISAO-FINAL.sql`
- `tests/final-workflow.scenarios.mjs`
- `REVISAO-FINAL.md` (este relatório e checklist).
