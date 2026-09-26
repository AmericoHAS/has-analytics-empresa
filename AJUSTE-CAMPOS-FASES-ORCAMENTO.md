# Campos e fases do orçamento — 26/09/2026

## Causas e correções
- Demanda: generate.ts concatenava classificações de intake e priorizava client_budgets.description, o mesmo campo do texto administrativo. Agora usa apenas budget_requests.description da solicitação vinculada (ou a mais recente do mesmo projeto/cliente). O marcador de consentimento anexado pelo sistema legado é removido só na apresentação; nada é apagado do banco.
- Serviços propostos: o campo existente client_budgets.description já persistia, mas aparecia como Descrição da demanda e era preenchido automaticamente com a solicitação. Foi renomeado para Serviços e análises propostas; novos orçamentos começam com esse campo vazio, e reabertura preserva o texto salvo. A demanda original aparece separadamente, somente para leitura. Registros antigos conservam o conteúdo já salvo: revisar esse campo quando contiver a antiga cópia da demanda.
- Fases adicionais: SQL aceita até 100 itens, preserva a ordem e calcula todos. Não foi reproduzida perda no banco. O formulário fechava o item novo ao digitar a primeira letra, porque a abertura dependia de description estar vazia; agora abertura e texto têm estados independentes. O DOCX previa apenas três fases e remetia extras às observações; agora o preenchimento repete a estrutura existente para cada fase adicional, incluindo as linhas da tabela do contrato.

## Arquivos alterados
components/admin/ClientBudgetManager.tsx
lib/commercial/generate.ts
lib/commercial/intake.ts
lib/commercial/render.ts
lib/commercial/template-engine.ts (somente preenchimento XML das fases, antes de Docxtemplater)
tests/commercial-documents.test.mjs
tests/budget-context.scenarios.mjs

## Validação
- PostgreSQL isolado com migrations reais: quatro itens salvos/reabertos, subtotal 750, desconto 10%, total 675, texto administrativo preservado e quatro itens mantidos após aprovação. Cenários de permissões/fluxo existentes passaram.
- 12 testes de documentos passaram, incluindo três modelos, arquivos longos, imagens originais preservadas, recuperação e novo caso com cinco fases e textos distintos.
- PDF/DOCX de orçamento e contrato gerados localmente. Extração de texto dos PDFs confirmou demanda e serviços separados, fases 4/5 e ausência do marcador de consentimento. Tabela do DOCX do contrato contém as fases adicionais em linhas próprias.
- Testes de ações/defaults passaram. Lint dos arquivos alterados e build de produção passaram, incluindo TypeScript e auditoria de bundle.
- Sem migration. Sem alteração em bibliotecas, next.config.ts, Vercel, runtime Chromium/Playwright, portfolio ou dados reais.
- Conferência por comparação do trecho hasTemplatePdf até o fim do arquivo: runtime PDF integralmente idêntico ao original. Arquivos de modelos oficiais não foram editados.
- Testes de PDF executados em Windows. Esta entrega não publica nem confirma funcionamento Linux em produção.

Publicar os arquivos alterados juntos. Para documentos já gerados, reabrir o orçamento, revisar Serviços e análises propostas, salvar e gerar nova versão; versões antigas não foram reescritas.
