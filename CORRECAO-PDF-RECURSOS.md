# Correção de impressão sob pressão de recursos — 24/09/2026

Registros 402e7c0a e 446c294a: Chromium 153 encerrou durante print_pdf, inclusive após reiniciar, com apenas 22–30 MB livres no volume temporário. Isso aponta pressão de recursos, mas os registros anteriores não incluíam o sinal de encerramento para provar sua causa exata.

## Alterações

- Em Linux, medir o espaço temporário depois da extração do Chromium. Se houver menos de 64 MB em /tmp e pelo menos 48 MB em /dev/shm, com mais espaço que /tmp, permitir ao Chromium usar a memória compartilhada nativa. Quando indisponível, manter o comportamento padrão do Playwright.
- Sob pouco espaço, gerar sem o renderizador auxiliar de cabeçalho/rodapé. As mesmas faixas azuis são adicionadas pelo mecanismo PDF já existente, preservando conteúdo, logo, assinatura e marca-d'água.
- Uma reinicialização por encerramento do navegador também utiliza a impressão leve, em vez de repetir exatamente a tentativa anterior.
- Diagnóstico registra espaço antes da impressão, modalidade utilizada e categoria fixa do sinal de falha; não registra texto de documentos, caminhos privados ou credenciais.
- Não remove arquivos de /tmp nem altera modelos, geração Word, orçamento, banco ou integrações.

## Validação

21 testes aprovados, incluindo impressão real dos três modelos com Chromium local e recuperação de falha de impressão. TypeScript, lint dos arquivos alterados e build verificados. O ambiente local é Windows; a falha específica do Linux/Vercel não pôde ser reproduzida integralmente aqui. A recuperação em produção precisa ser confirmada após deploy.

## Publicação

Enviar estes arquivos pelo fluxo habitual de GitHub/Vercel. Nenhuma migration ou variável nova. Gerar novamente o orçamento. Se persistir, os registros HAS_PDF_LOW_RESOURCE_PRINT e HAS_PDF_FAILED agora incluem os recursos utilizados e o sinal sanitizado para identificar a próxima causa sem expor dados do cliente.
