# Entrega: PDF, agenda e tamanho das Functions — 25/09/2026

## PDF: evidências e correção

Os logs mostram encerramento do Chromium com 4 MB temporários livres; depois do fechamento havia 25 MB. A geração de propostas percorre as opções de pagamento sequencialmente e só publica os registros quando todo o conjunto termina. Portanto, um PDF gerado com sucesso não significa que o orçamento completo foi disponibilizado. A falha seguinte desfaz o conjunto, conforme a proteção já existente.

Foi encontrado um consumo temporário evitável: o executável de Chromium 153, cerca de 199 MB, era descompactado em /tmp. Agora ele é descompactado durante o build e incluído na aplicação. Durante a execução são extraídas somente as pequenas bibliotecas/fontes de suporte. Isso não prova que todo o espaço ocupado era vazamento: a correção elimina um consumidor conhecido e preserva a liberação dos recursos.

Page, context e browser têm fechamento explícito em finally, inclusive em erro e antes de repetir uma tentativa. A medição da tentativa anterior é zerada antes da seguinte. Nenhuma limpeza genérica de /tmp foi adicionada.

A geração foi movida integralmente para `lib/commercial/generate.ts`, chamada apenas pela rota POST `/api/admin/commercial-documents`. A lógica de montagem, validação administrativa, gravação privada e desfazimento do conjunto foi preservada. A rota também rejeita chamadas de outra origem. O browser usa a sessão existente, sem secrets novos.

Os arquivos oficiais DOCX, watermark image3.png, assinatura, logo, aceite, versões de dependências e fluxo Docxtemplater → docx-preview → Chromium → PDF não foram alterados.

## Functions e armazenamento

Function/Deployment Storage não é o espaço temporário de execução. Foram confirmadas duas fontes de empacotamento excessivo: inclusões globais `/*` e importação do renderizador no módulo de ações compartilhado com o cliente.

Agora as inclusões pesadas pertencem somente à rota dedicada. Playwright completo, incluindo browsers.json, continua presente. Os assets de Chromium continuam disponíveis: seu executável pré-descompactado substitui chromium.br e os três arquivos auxiliares são incluídos explicitamente. A cópia comprimida do executável é excluída para não duplicar 64 MB no pacote.

Medição dos arquivos rastreados no build local (não é o faturamento nem a medição final do dashboard Vercel):

| Rota | Dependências rastreadas |
|---|---:|
| API de geração PDF | 231,40 MiB |
| Admin | 3,12 MiB |
| Área do Cliente | 3,13 MiB |
| Login | 2,00 MiB |
| Cron de notificações | 1,77 MiB |

A auditoria percorreu os 19 manifests locais: somente a rota de geração contém Chromium/Playwright/templates. O build agora falha se esses arquivos vazarem para outra rota, se faltar algum arquivo essencial, se o executável ficar duplicado ou se o pacote rastreado do PDF exceder 250 milhões de bytes.

Não foi possível consultar o painel: a revisão automática de acesso ao navegador atingiu o limite de uso. Portanto NÃO foram confirmados o tamanho faturado das Functions, o acréscimo por deployment, a quantidade de deployments retidos ou os 75% contabilizados da equipe. Nenhum deployment foi apagado. Para avaliar o estoque já acumulado, conferir Usage da equipe e a retenção de deployments; não excluir a versão de produção/rollback sem revisão. Referência oficial: https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage

## Agenda

Causa do cursor: `.dashboard button:disabled` aplicava cursor wait também a células vencidas. Além disso, eventos já cadastrados não bloqueavam a seleção por horário passado.

Datas/horários passados e horários reservados indisponíveis ao cliente agora ficam desabilitados com cursor de indisponibilidade. A comparação usa data e hora de Brasília e é repetida no clique para proteger uma tela que tenha permanecido aberta. Passar o mouse não envia requests nem executa ações. Histórico de reuniões permanece na lista existente. O banco já rejeita horários passados e dupla reserva; não foi necessário alterar SQL.

## Arquivos

PDF/isolamento: `app/admin/commercial-actions.ts`, `lib/commercial/generate.ts`, `lib/commercial/generate-client.ts`, `app/api/admin/commercial-documents/route.ts`, `lib/commercial/template-engine.ts`, `lib/commercial/pdf-runtime.ts`, `components/workspace/CommercialDocuments.tsx`, `components/workspace/Receipts.tsx`.

Empacotamento: `next.config.ts`, `package.json`, `.gitignore`, `scripts/prepare-pdf-runtime.mjs`, `scripts/audit-pdf-bundle.mjs`.

Agenda: `components/workspace/ConsultationCalendar.tsx`, `components/workspace/Consultations.tsx`, `lib/workspace/calendar.ts`, `app/workspace.css`.

Testes: `tests/commercial-documents.test.mjs`, `tests/calendar.test.mjs`, `tests/pdf-packaging.test.mjs`, `tests/pdf-endpoint.test.mjs`.

## Validação

- 90 testes automatizados aprovados.
- Seis PDFs de orçamento consecutivos, além dos três tipos de documento e testes de recuperação de impressão/fechamento: aprovados localmente.
- Perfis e diretórios de artifacts do Playwright verificados após cada geração: nenhum restante. No Windows o driver Intel pode reter seu próprio cache; o teste diferencia esse cache dos diretórios do navegador.
- Agenda no navegador, relógio fixado em 25/09/2026 às 14h de Brasília: dia anterior, 10h e 13h30 indisponíveis; horário futuro do mesmo dia e data futura selecionáveis. Eventos expirados não executam callback. Cursor conferido.
- Banco PostgreSQL isolado: fluxo completo, reserva normal, dupla reserva, permissões e histórico aprovados. Nada executado no Supabase real.
- TypeScript e build de produção aprovados; auditoria dos pacotes aprovada.
- Lint sem erros, com dois avisos preexistentes de imagens em ProjectList.tsx.

## Publicar

1. Enviar os arquivos alterados e os novos arquivos/pastas ao GitHub, incluindo `scripts/` e a nova rota em `app/api/admin/commercial-documents/`.
2. Vercel → projeto → Settings → Build and Deployment → Build Command: usar `npm run build`. Não usar diretamente `next build`, pois isso pula a preparação do Chromium e a auditoria.
3. Fazer o deploy habitual e conferir `[HAS_PDF_BUILD]` e `[HAS_FUNCTION_BUNDLE]` no build.
4. Atualizar a página do Admin e gerar um orçamento com todas as opções de pagamento. Conferir o conjunto, depois contrato e recibo quando aplicável.

Não enviar `.has-pdf-runtime/` ao GitHub: é gerado automaticamente e está no .gitignore. Nenhuma migration SQL ou variável de ambiente nova. Sem alteração de plano, domínio, secrets ou notificações.

Limite da validação: testes de navegador foram realizados no Windows com Edge/Chromium. Não houve execução do Linux da Vercel neste ambiente; estabilidade sob carga real e o armazenamento efetivamente contabilizado precisam ser conferidos depois do deploy. Não foi feita publicação automática.
