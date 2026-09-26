# Revisões anexadas e proporção da logo — 26/09/2026

## Revisões Word/PDF
Causa identificada: a revisão externa recebe novo offer_group, mas a seleção do grupo reutilizava choices[budget_id] de outro grupo. A condição de exibição então eliminava a revisão nova. Agora só aceita seleção pertencente ao grupo atual, com fallback para a versão existente nesse grupo.
A interface mostra nomes dos arquivos, revisão do orçamento, valor do snapshot e identifica a revisão mais recente. Os botões existentes de PDF/Word usam os arquivos específicos daquela versão. Substituição cria novo rascunho, preservando as versões anteriores; publicação permanece explícita.
O servidor verifica a revisão financeira e arquivamento antes de registrar o anexo. Mudança de valor/escopo exige gerar a versão atual antes de anexar os arquivos revisados, sem atribuir artificialmente valores novos a um snapshot antigo. O trigger existente continua protegendo contra alteração concorrente.
A limpeza de arquivos após erro consulta referências PDF/Word antes de remover. Se a consulta falhar, não apaga: evita destruir arquivo que foi associado apesar da perda da resposta de rede. Não foi feita varredura ou exclusão de arquivos antigos em produção.
O modelo existente exige par PDF + DOCX por versão comercial; foi preservado. Os testes substituem ambos e verificam cada caminho/nome. Não foi adicionado upload isolado de um único formato, que permitiria publicar documentos divergentes. Documentos antigos sem nomes salvos recebem identificação genérica por formato/versão.

## Logo
Nos três modelos a logo é image1.png, quadrada (276 x 276), com largura/altura iguais no XML. docx-preview cria largura e altura fixas. A regra existente max-width:100% pode reduzir a largura no contêiner sem reduzir a altura. Correção restrita à imagem cujo src coincide com o conteúdo da logo: height:auto e object-fit:contain. Assinatura image2 e marca-d'água image3 não recebem esse estilo. Modelos DOCX e seus arquivos internos não foram modificados.

## Arquivos desta rodada
- components/workspace/CommercialDocuments.tsx
- app/admin/commercial-actions.ts
- lib/commercial/document-selection.ts
- lib/commercial/template-engine.ts (somente captura/ajuste da imagem da logo)
- tests/document-revisions.test.mjs
- tests/commercial-documents.test.mjs

## Testes e limites
15 testes passaram: revisões sucessivas com PDF/DOCX válidos e snapshots preservados, associação ao orçamento, rejeição de revisão financeira desatualizada, seleção por grupo, três modelos, preservação das imagens nativas, fases extras da rodada anterior, recuperação e seis gerações consecutivas.
A simulação de upload/registro usa arquivos PDF/DOCX reais e respostas de banco/Storage simuladas. Não houve upload real no Supabase; esse percurso ainda deve ser confirmado com conta administrativa no ambiente publicado.
Proporção testada sob contêiner de 60px; logo continua 1:1 e estilo de altura da assinatura não é alterado. PDFs reais gerados e rasterizados: conferência visual de logo, assinatura e marca-d'água em orçamento/contrato/recibo.
Build e TypeScript locais passaram. Não houve alteração de dependências, next.config.ts, output tracing, inicialização Chromium/Playwright, SQL, RLS, autenticação, notificações ou portfólio. Sem migration e sem variável de ambiente nova. Preservadas as alterações ainda não commitadas da rodada anterior.
