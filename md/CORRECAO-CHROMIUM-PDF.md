# Correção do encerramento do Chromium — 24/09/2026

## Diagnóstico e limites

O log recebido informa `Target page, context or browser has been closed`, apenas 18 MB livres para arquivos temporários de memória compartilhada e erros `SharedImageManager::ProduceSkia`. Isso é diferente do erro de empacotamento `browsers.json` e do erro anterior `Printing failed` com navegador ainda aberto. Os avisos apontam para pressão de recursos e o caminho gráfico, mas não provam isoladamente a causa do encerramento.

Comparação feita com o histórico funcional `e4879a1` e o estado recebido `3214dcf`. Dependências, executável e configuração de tracing continuam iguais à configuração enviada pelo usuário. As mudanças recentes relevantes eram preparação antecipada do modo de impressão/fontes, diagnóstico e recuperação de `Printing failed`. Essa recuperação não tratava navegador encerrado.

## Correção

- Restaurada a preparação anterior: sem forçar mídia de impressão antecipadamente nem carregar artificialmente todas as variantes de fonte. Mantida a espera por fontes e imagens usadas no documento.
- Servidor: desativado o caminho WebGL/SwiftShader/GPU; documentos usam texto e imagens estáticas. Preservadas as demais flags necessárias ao Chromium serverless, incluindo `single-process` e sandbox.
- Cache de disco do navegador reduzido de 32 MB para 1 MB.
- Uma geração por vez por processo Node, evitando concorrência de navegadores no mesmo ambiente temporário. Não é uma trava global entre instâncias da Vercel.
- Em caso de navegador encerrado, fecha a instância anterior e renderiza novamente em uma instância nova, no máximo uma vez. Não tenta imprimir novamente em uma página fechada. Falhas persistentes continuam bloqueando a publicação parcial.
- Mantida a alternativa existente para `Printing failed` com navegador aberto.
- Diagnóstico inclui espaço temporário livre, memória, etapa, versão do navegador e referência. Não inclui dados do cliente nem documento. Eventos: `[HAS_PDF_BROWSER_RESTART]` e `[HAS_PDF_FAILED]`; código `chromium_closed` distingue a nova falha.
- Nenhuma limpeza indiscriminada de `/tmp` foi adicionada: arquivos do Chromium, fontes e outros trabalhos não são apagados.

## Preservado

Next config e `playwright-core/**/*`; dependências; DOCX oficiais; logo image1; assinatura image2; marca-d'água image3; faixas azuis; espaço do aceite; autofill; descrições das etapas sem preços unitários; armazenamento privado e demais funcionalidades.

## Validação

76 testes aprovados, incluindo geração real local dos três modelos, recuperação de impressão, fechamento real do navegador antes de imprimir seguido de recuperação em nova instância, serialização de solicitações e limite de tentativas. PDF/Word e imagens originais conferidos; páginas dos três PDFs revisadas visualmente.

TypeScript aprovado. Lint sem erros (dois avisos de imagens preexistentes em ProjectList). Build de produção executado com valores fictícios de Supabase para validação local, sem acesso a dados reais.

Os testes usam Windows/Edge. O binário Linux e os limites de disco/memória da Vercel não foram reproduzidos localmente. Portanto o caso exato de produção precisa ser validado no novo deploy; não se afirma que sua causa esteja comprovada.

## Publicação

1. Enviar os arquivos alterados ao GitHub, incluindo `lib/commercial/pdf-runtime.ts`.
2. Aguardar novo deploy de produção na Vercel e conferir que ele corresponde ao commit enviado.
3. Gerar novamente o orçamento que apresentou erro e conferir PDF e Word.
4. Se houver falha, consultar Runtime Logs no horário da tentativa e buscar a referência apresentada na tela e `[HAS_PDF_FAILED]`.

Esta correção não exige SQL, nova variável, mudança de plano, DNS ou ajuste de secrets. Não foi feito deploy nem ação em produção.

Referência primária: https://github.com/Sparticuz/chromium#graphics — configuração documentada de WebGL, também conferida no código da versão instalada 153. A alteração não troca a biblioteca.
