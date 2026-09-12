# HAS Analytics — ativação das áreas Admin e Cliente

## Antes da ativação

- Faça backup do Supabase (banco e Storage) e preserve as variáveis de ambiente atuais.
- O código original foi preservado em `has-site-backup-before.zip` na pasta de trabalho desta tarefa; nenhuma credencial foi incluída nesse backup.
- Banco existente: execute, em ordem, os três arquivos de `supabase/migrations/`: `202609110001_workspace.sql`, `202609110002_commercial_seed.sql` e `202609110003_notifications.sql`. **Não execute novamente `schema.sql` em um banco existente.** Banco novo: execute primeiro `schema.sql`, depois as migrações.
- A primeira migração preserva os dados, cria as tabelas ausentes e substitui as políticas das tabelas privadas para impedir que permissões antigas contornem a separação entre clientes. Revise políticas personalizadas de Storage que abranjam vários buckets antes de executar. O portfólio público não é alterado.
- As notas antigas continuam na coluna `client_projects.admin_notes` para recuperação, mas a API autenticada não pode lê-la. Uma cópia passa a `project_private`, visível só ao admin. Consultas de projeto usam a lista explícita de campos de `lib/workspace/types.ts`.
- Confira no Supabase os papéis em `profiles`: administrador = `admin`, demais usuários = `client`. Não conceda atualização do próprio papel aos clientes.
- Arquivos existentes com `storage_path` continuam disponíveis. Documentos que só tenham `file_url` precisam ser reenviados ao bucket privado; o painel não expõe esses links legados.

## Modelos comerciais

- Em **Admin → Modelos comerciais**, confira e salve os serviços, valores, textos, validade e exatamente três itens iniciais.
- Fonte: `HAS Analytics - Controle de Orçamentos.xlsx`, aba `Parametros`, e `modelo_orcamento_HAS.docx`, extraídos do ZIP enviado. Nenhum cadastro histórico ou dado pessoal da planilha foi importado para o site.
- Valor-hora: R$ 70; base: R$ 250; desconto padrão: 0%. Coeficientes preservados, inclusive os rótulos alternativos existentes na planilha.
- Fórmula reconstruída: `base + horas × valor-hora + base × soma dos coeficientes`; depois aplica-se o desconto percentual. Conferida com ORC-002, ORC-004 e ORC-005. O XLSX contém valores calculados, mas o ZIP **não contém o código Apps Script**; não foi possível copiar ou auditar o script original.
- As três fases do Word viraram três serviços iniciais. A distribuição inicial (base na organização; 8 horas na análise; relatório incluído a R$ 0) é uma adaptação editável, não uma tabela por fase presente no original. Validade inicial de 15 dias também é configurável.
- A calculadora aplica a estimativa aos três itens explicitamente. Em seguida, todos os itens, quantidades, valores e observações podem ser alterados.
- O orçamento é salvo em transação única no banco, com validação de cliente/projeto e recálculo dos totais. Padrões novos não alteram propostas antigas.

## Projetos e arquivos

- As etapas incluem recebimento/escopo, organização do banco, análise, relatório/revisão e entrega/suporte. Cada projeto recebe oito atividades iniciais, editáveis.
- O progresso percentual é administrativo, independente do checklist; marque o status `concluido` ao encerrar. A barra temporal mede o tempo decorrido, não a quantidade de trabalho feita.
- Registre início, entrega da análise e prazo do cliente para enviar dados. Ao receber todos os dados, limpe ou atualize o prazo do cliente para cessar avisos dessa pendência.
- O bucket `client-documents` deve permanecer **privado**, limitado a 50 MB por arquivo. Arquivos maiores precisam ser divididos ou ter limite/fluxo de upload revistos conjuntamente.
- Downloads usam URL assinada de 60 segundos e modo de download, inclusive HTML. Não há execução/visualização de HTML arbitrário dentro do painel.
- PDFs e imagens também têm botão **Visualizar**, com leitura autenticada do bucket e abertura em aba separada, sem acesso à aba do painel. O tipo de conteúdo do visualizador é fixado; HTML não usa esse caminho.
- O cliente envia arquivos apenas para a própria pasta; somente o admin remove registros já cadastrados, altera status e registra recebimento de assinatura. Registrar assinatura é uma conferência administrativa, não assinatura eletrônica jurídica.
- Caso o cadastro de um upload falhe, o componente tenta remover o objeto recém-enviado. Falha nessa compensação é mostrada ao usuário; confira objetos órfãos no Storage nesses casos.

## Resend, agendamento e Vercel

Configure apenas no servidor / variáveis do projeto Vercel:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SITE_URL=https://seu-dominio
RESEND_API_KEY=...
NOTIFICATION_FROM=HAS Analytics <avisos@seu-dominio-verificado>
ADMIN_NOTIFICATION_EMAIL=antunnyamerico@gmail.com
CRON_SECRET=gere-um-segredo-longo-aleatorio
NOTIFICATIONS_ENABLED=false
```

Preserve o nome da variável pública Supabase já usada por `lib/supabase/client.ts`. Nenhuma chave secreta deve começar com `NEXT_PUBLIC_`.

1. Verifique seu domínio/remetente no Resend e configure as variáveis acima.
2. Publique o projeto na Vercel após aplicar as migrações. `vercel.json` agenda o processamento diariamente às 12h UTC (9h de Brasília). Avisos de documentos por e-mail podem levar até 24 horas nessa configuração. No painel, surgem após o upload e a atualização da lista.
3. Para notificações mais rápidas, configure agendamento mais frequente compatível com seu plano. O worker processa lotes limitados por execução; monitore a fila para ajustar frequência à demanda.
4. Ative `NOTIFICATIONS_ENABLED=true` somente após revisar destinatários e o remetente. Não foi feito nenhum envio real durante o desenvolvimento.
5. A rota `/api/cron/notifications` exige `Authorization: Bearer CRON_SECRET`; nunca exponha esse segredo no navegador. Com e-mails desativados, a rotina ainda pode gerar avisos de prazo no painel.
6. Avisos próximos são gerados quando faltam até três dias; vencidos, após a data. São deduplicados por projeto, tipo de prazo, data, situação e destinatário. Alterar a data permite um novo aviso. Projetos concluídos/cancelados não geram novos alertas.
7. Eventos de documentos notificam o cliente e administradores, exceto quem enviou. Cada destinatário usa o e-mail cadastrado no Auth; o admin pode usar `ADMIN_NOTIFICATION_EMAIL`. Se houver vários admins com o mesmo endereço substituto, poderão chegar cópias destinadas a cada conta; prefira endereços próprios nesse cenário.
8. A fila tem reserva de processamento, repetição limitada e chave de idempotência no Resend. Não reenvie manualmente avisos com resultado incerto sem conferir os logs do provedor. Tentativas têm janela conservadora para evitar duplicação após a expiração da chave do provedor.

Referências técnicas: [Supabase Storage e RLS](https://supabase.com/docs/guides/storage/security/access-control), [URLs assinadas](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl), [Resend: idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## WhatsApp

`lib/notifications/whatsapp.ts` define o contrato de integração, desativado. Para ativar futuramente: selecionar Meta WhatsApp Business Platform ou BSP oficial, cadastrar número empresarial, obter consentimento dos destinatários, aprovar templates e implementar adaptador + fila/status próprios. Não existe automação por sessão do WhatsApp pessoal, credencial embutida ou envio por WhatsApp nesta entrega.

## Conferência após migração

- [ ] Admin cria/edita modelo; novo orçamento abre com 3 itens. Testar desconto, edição, status e detalhes.
- [ ] Criar projeto; verificar etapas, checklist, dados internos, progresso e ambos os prazos.
- [ ] Cliente A envia PDF/ZIP/HTML e admin baixa; admin envia resultado e Cliente A baixa.
- [ ] Cliente B não lista nem baixa os arquivos/projetos/orçamentos de A, mesmo tentando IDs e caminhos de A diretamente.
- [ ] Cliente não lê `project_private` nem `client_projects.admin_notes`, não altera papel, progresso, orçamento ou destinatários de avisos.
- [ ] Sessão anônima não abre `/admin`, `/area-cliente` nem downloads privados; cron sem segredo retorna 401.
- [ ] Testar prazo hoje, daqui a três dias, vencido e concluído. Confirmar que leitura repetida/cron repetido não duplica o evento.
- [ ] Com contas de teste e Resend configurado, validar entrega real, erro de provedor, repetição, logs e destinatários.
- [ ] Verificar desktop e celular com dados reais. A validação local de componentes não substitui a homologação com Supabase remoto.

## Comandos

`npm run lint` · `npm run build` · `npm test`

Não há aplicação automática de SQL nem alteração de credenciais. Os passos acima dependem do projeto Supabase, domínio de envio e ambiente de publicação.

## Arquivos principais

| Arquivo                                                                          | Responsabilidade                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `components/admin/ClientOverview.tsx`                                            | Seleção de cliente e composição, sem concentrar regras dos módulos.          |
| `components/workspace/ClientWorkspace.tsx`                                       | Navegação comum entre projetos, documentos, orçamentos e avisos.             |
| `components/workspace/CommercialSettings.tsx`                                    | Catálogo e textos comerciais editáveis.                                      |
| `components/admin/ClientBudgetManager.tsx` e `app/admin/budget-actions.ts`       | Propostas, três itens iniciais, calculadora, edição e gravação transacional. |
| `components/workspace/Projects.tsx` e `Deadline.tsx`                             | Fluxo, checklist, campos internos e visualização temporal.                   |
| `components/workspace/Documents.tsx`                                             | Upload, filtros, assinatura recebida e downloads privados.                   |
| `components/workspace/Notifications.tsx` e `app/api/cron/notifications/route.ts` | Avisos no painel e processamento seguro de e-mail.                           |
| `app/workspace.css`                                                              | Identidade visual, responsividade, estados de foco e redução de movimento.   |
| `supabase/migrations/`                                                           | Evolução do banco, modelos iniciais, RLS, Storage e fila de notificações.    |
| `tests/`                                                                         | Testes de domínio, do worker e integração PostgreSQL isolada.                |

## Verificações realizadas nesta entrega

- Build Next.js e TypeScript: aprovados.
- Rotas reais em execução local: `/admin` e `/area-cliente` redirecionam visitantes para login; cron sem segredo retorna 401; login retorna 200.
- 18 testes locais de domínio e notificações: aprovados; incluem reconciliação com a planilha, desconto, prazos no fuso de Brasília, proteção do cron, configuração ausente, idempotência e erros do provedor com envio simulado.
- Migrações executadas duas vezes em PostgreSQL isolado (PGlite), com schemas Auth/Storage simulados: aprovadas. Testados RLS entre dois clientes e admin, notas privadas, tentativa de promoção de papel, permissões de arquivos, rascunhos, transação de orçamento e reserva/deduplicação da fila.
- Componentes reais testados no navegador com dados fictícios, em desktop e celular: navegação, abertura dos três itens, desconto ao vivo, modelos comerciais e documentos; sem erros de execução nem transbordamento lateral nas telas verificadas.
- A homologação com Auth e Storage reais, entrega de e-mail e publicação continua pendente dos passos manuais acima. As migrações não foram aplicadas ao banco remoto.

Para repetir o teste PostgreSQL opcional, instale `@electric-sql/pglite` em uma pasta de ferramentas separada e execute `node tests/sql.integration.mjs`, definindo `PGLITE_MODULE` como a URL de arquivo do `dist/index.js` instalado. Não é dependência de produção.
