# Orçamentos e geração de documentos — 24/09/2026

## Impressão PDF

O erro informado vem de `Page.printToPDF`, depois do preenchimento do Word. O salvamento é conjunto; por isso a falha no PDF também impede disponibilizar o Word desta nova versão.

- Mantidos os modelos DOCX originais, marca-d’água, assinatura, logo e espaços de aceite.
- Mantidos Docxtemplater, docx-preview, Chromium/Playwright e toda a configuração de empacotamento da Vercel, incluindo `playwright-core/**/*`.
- Preparação explícita do modo de impressão e carregamento das quatro variações da fonte antes da impressão.
- A impressão normal mantém seu cabeçalho/rodapé. Somente quando o Chromium retorna `Printing failed`, há uma segunda tentativa sem o renderizador auxiliar de cabeçalho/rodapé. As mesmas faixas azuis são desenhadas nas margens de todas as páginas com pdf-lib, já presente no projeto.
- A segunda tentativa não ignora falha persistente e não publica um documento parcial.
- Se houver falha, a tela mostra uma referência que também aparece nos logs de execução da Vercel, sob `[HAS_PDF_FAILED]`. Os logs registram etapa, versão do navegador, tamanho do arquivo e uso de memória, sem nomes, dados cadastrais, texto do orçamento ou credenciais.
- Recuperações bem-sucedidas geram `[HAS_PDF_RETRY]` e `[HAS_PDF_RECOVERED]`.

A causa específica do documento real na Vercel não foi reproduzida neste computador. A recuperação foi testada com a mesma mensagem de falha injetada e uma segunda impressão real dos três documentos, além da impressão normal. O teste real na Vercel continua necessário após o deploy.

Referências técnicas consultadas: [restrições de cabeçalhos/rodapés no Playwright](https://playwright.dev/docs/api/class-page#page-pdf) e [relato confirmado de falha de impressão com cabeçalhos/fontes no Chromium](https://github.com/puppeteer/puppeteer/issues/10407). Esse relato orienta a alternativa de impressão; não confirma a causa do caso em produção.

## Valores das etapas

Removida a inclusão automática de quantidade × preço unitário dos serviços no texto do contrato e dos serviços adicionais do orçamento. As etapas apresentam suas descrições. O investimento global, desconto e condições de pagamento permanecem nos documentos.

Os valores por item continuam disponíveis no Admin para cálculo. Textos digitados manualmente não são apagados. Documentos já emitidos não foram modificados: gere uma nova versão para aplicar esta apresentação.

## Preenchimento e organização

- Contexto da solicitação passa a ter campos próprios na proposta: tipo de serviço, área da pesquisa, situação do banco, urgência, finalidade, modelo de entrega e departamento/instituição.
- Os menus do contexto usam a mesma origem do formulário público. O formulário autenticado de solicitação também passa a usar os mesmos tipos de serviço; valores antigos continuam aceitos no banco.
- Título, descrição, contexto, contato, cadastro, prazo e dados administrativos existentes são reaproveitados quando disponíveis. A data acordada no projeto tem prioridade sobre o prazo desejado na solicitação.
- Respostas equivalentes pré-selecionam critérios da estimativa. Respostas ambíguas não viram acréscimos automaticamente; o Admin confere e precisa clicar em Aplicar estimativa para alterar os valores.
- Removida a segunda seleção independente da solicitação dentro do planejamento, que podia divergir da origem usada no formulário principal.
- As respostas revisadas ficam no próprio orçamento. Ao reabrir, elas prevalecem sobre os dados atuais do cliente, inclusive campos apagados intencionalmente.
- Dados do cliente, demanda, etapas, observações/pagamento e planejamento podem ser recolhidos. Cada etapa também pode ser aberta ou recolhida separadamente.
- Campos inválidos dentro de blocos fechados são revelados para correção.

## Aplicação — antes de publicar

1. No Supabase, abra **SQL Editor → New query** e execute todo o arquivo `supabase/ATUALIZAR-CONTEXTO-ORCAMENTO.sql`. Pressupõe a revisão anterior `REVISAO-FINAL.sql` já aplicada.
2. O SQL é idêntico à migration `202609230002_budget_context.sql`; execute apenas uma das duas cópias. É transacional e reaplicável. Acrescenta `client_budgets.request_details` e uma função de salvamento com contexto que reutiliza as proteções do salvamento existente. Mantém compatibilidade com clientes antigos.
3. Envie os arquivos alterados ao GitHub e publique na Vercel. Inclua o novo `lib/commercial/pdf-print.ts`.
4. Abra o orçamento de teste, confira os dados, salve, gere uma nova versão e confira PDF e Word. Os arquivos antigos permanecem no histórico.
5. Se o PDF voltar a falhar, copie a referência mostrada na tela e procure por `[HAS_PDF_FAILED]` nos **Runtime Logs** do novo deploy, usando o horário da tentativa.

Nenhuma variável nova é necessária. Não alterar DNS, secrets, integração do Resend, configuração do Chromium ou templates. WhatsApp automático permanece desativado conforme a configuração existente.

## Verificações realizadas

- 70 testes automatizados aprovados.
- PostgreSQL isolado: migration reaplicável, campos revisados/apagados preservados, revisão da proposta atualizada, validação de contexto, permissões, arquivamento e tipos de serviço novos e antigos.
- Navegador com componentes reais e serviços simulados: preenchimento, horários/prazos do projeto, critérios, blocos recolhíveis, edição e payload completo de salvamento; responsividade desktop e celular.
- PDF/Word dos três modelos: geração normal e recuperação da falha simulada; páginas, margens, logo, assinatura e marca-d’água conferidos visualmente.
- TypeScript e build de produção aprovados.
- Lint sem erros; dois avisos preexistentes de imagens em `ProjectList.tsx`.

Testes locais no Windows/Edge. Não foi executado o Chromium Linux da Vercel. Nenhum e-mail foi enviado, nenhuma migration aplicada remotamente e nenhum documento de produção foi substituído.

## Arquivos desta entrega

- `lib/commercial/template-engine.ts`
- `app/admin/commercial-actions.ts`
- `tests/commercial-documents.test.mjs`
- `lib/commercial/render.ts`
- `lib/commercial/intake.ts`
- `lib/commercial/budget-defaults.ts`
- `lib/commercial/budget-input.ts`
- `lib/workspace/budget-operations.ts`
- `components/admin/ClientBudgetManager.tsx`
- `components/admin/BudgetPlanningFields.tsx`
- `app/additions.css`
- `tests/sql.integration.mjs`
- `components/QuoteRequest.tsx`
- `tests/budget-operations.test.mjs`
- `lib/commercial/pdf-print.ts`
- `tests/pdf-print.test.mjs`
- `tests/budget-context.scenarios.mjs`
- `supabase/migrations/202609230002_budget_context.sql`
- `supabase/ATUALIZAR-CONTEXTO-ORCAMENTO.sql`
- `AJUSTES-ORCAMENTO-PDF.md`
