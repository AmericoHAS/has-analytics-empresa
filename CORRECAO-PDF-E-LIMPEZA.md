# Correção de PDF e limpeza — 25/09/2026

## PDF
O log 7b3f8907 registrou fechamento com 501 MB livres. A falta de espaço não explica esse evento. O estágio render_docx antes também incluía a criação de contexto e página.

O renderer agora usa launchPersistentContext com perfil temporário exclusivo e contexto padrão. Evita o contexto incógnito adicional incompatível com Chromium em --single-process (Sparticuz issue 298). O perfil continua isolado por geração e é encerrado/removido pelo Playwright. As etapas create_page, load_scripts e render_docx agora são discriminadas nos logs.

Preservados os três modelos DOCX, imagens, assinatura, marca-d'água, CSS, campos, geração Word, mecanismo PDF e isolamento da Function. Não houve alteração no banco nem em credenciais.

## Limpeza realizada
- Removidos dois ZIPs comprovadamente idênticos aos DOCX oficiais e icon.png da raiz, idêntico a app/icon.png.
- Materiais de referência HAS Financial, seus ZIPs, originais de capas, histórico R e documentos reais de trabalho saíram da pasta do site e foram preservados em H:\Meu Drive\6. Empresarial\HAS-Analytics-referencias-arquivadas-20260925. Manifesto nessa pasta.
- .env.local foi retirado do índice Git, mantendo o arquivo local e seus valores. Também excluído dos uploads Vercel. Use as variáveis já configuradas no painel Vercel; não versionar credenciais.
- Mantidos public, migrations, testes, documentação de setup, fontes, dependências e modelos utilizados. Arquivos públicos podem ser referenciados por conteúdo do banco; ausência de import estático não autoriza sua exclusão.

## Verificação
90 testes passaram, incluindo PDF/DOCX dos três modelos, recuperação de falha e gerações consecutivas com limpeza dos perfis. Build de produção e TypeScript passaram. Lint sem erros, com dois avisos preexistentes de img em ProjectList. Corrigido nome reservado no teste do endpoint; seus dois testes passaram novamente.

Trace local da Function PDF: 242635457 bytes (231,40 MiB). Auditoria confirmou dependências pesadas restritas ao endpoint de documentos. Esse tamanho não é a métrica de Function Storage faturada pela Vercel. Limpar arquivos de referência não remove deployments antigos nem altera seu consumo retroativamente.

## Publicação e limite da validação
As alterações estão locais e devem ser enviadas ao GitHub incluindo as remoções, não apenas copiando arquivos novos. Não foi feito deploy, envio de e-mails, alteração de DNS ou operação em dados de produção.

Depois do deploy, fechar a aba antiga e abrir novamente o site antes de testar. Failed to find Server Action indica incompatibilidade de versões de cliente/servidor; não comprova problema no PDF. O Next 16 já utiliza NEXT_DEPLOYMENT_ID fornecido pela Vercel, portanto não foi introduzida outra identificação ou segredo.

Os testes executaram em Windows/Edge 153. A validação do Chromium Linux 153 na Vercel permanece necessária: gerar orçamento, contrato e recibo em sequência, incluindo o cliente que falhou. Não se afirma que o crash em produção foi reproduzido localmente.

Fontes técnicas: https://github.com/Sparticuz/chromium/issues/298 e https://nextjs.org/docs/messages/failed-to-find-server-action

## Atualização: falha a03221db na inicialização
A alteração anterior de contexto não resolveu a falha de produção. O novo log mostra SIGTRAP durante launch com 501 MB livres, antes de qualquer renderização do documento.
Restaurados os argumentos gráficos/processuais fornecidos pelo pacote Sparticuz, incluindo --in-process-gpu. A configuração anterior removia esse argumento e acrescentava --disable-gpu; essa personalização foi retirada. WebGL continua desativado pela opção oficial setGraphicsMode=false; permanece o limite de cache de 1 MB.
Adicionado HAS_PDF_LAUNCH_FAILED para preservar stderr nativo da inicialização (antes de enviar conteúdo de clientes ao browser), limitado a 10 mil caracteres. O log anterior reduzia a causa fatal apenas a trap, impedindo diagnóstico preciso.
18 testes de runtime/documentos passaram localmente. A causa exata do SIGTRAP não está provada sem a mensagem fatal nativa; não confundir validação Windows com execução Linux na Vercel. Modelos e arquitetura não foram substituídos.

## Atualização: ed2dfa6b — Vulkan/ANGLE
O stderr de produção agora identifica EGL_NOT_INITIALIZED e falha de inicialização Vulkan/SwANGLE, seguida de SIGTRAP. Não é evidência de documento grande demais.
Foi corrigida a separação introduzida no empacotamento: Chromium ficava em .has-pdf-runtime, mas SwiftShader era extraído em /tmp. O build agora extrai libEGL.so, libGLESv2.so, libvk_swiftshader.so, libvulkan.so.1 e vk_swiftshader_icd.json ao lado do executável. A rota inclui esses arquivos e deixa de empacotar/extrair a cópia comprimida SwiftShader. Fontes e bibliotecas AL2023 continuam com o tratamento anterior.
O teste de empacotamento confirma os cinco arquivos, o destino relativo do manifesto Vulkan, atualização do executável e rejeição de executável inválido. Teste passou; lint dos arquivos alterados, TypeScript e build passaram, incluindo auditoria de tamanho e isolamento da Function. A execução Linux na Vercel ainda não foi validada neste ambiente Windows.
Publicar os cinco arquivos de código/configuração/teste alterados junto ao relatório. O Build Command permanece npm run build. Sem migration ou nova variável. Não enviar manualmente .has-pdf-runtime: o build gera essa pasta.
