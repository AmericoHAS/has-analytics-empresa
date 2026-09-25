# Orçamentos e organização por projeto — 24/09/2026

- Admin e Cliente abrem um projeto antes de acessar orçamento, contrato, pagamento e arquivos.
- Projetos concluídos/arquivados preservam seus documentos e ficam nos filtros existentes.
- Registros antigos sem projeto continuam disponíveis separadamente. Não houve alteração automática de vínculos ou exclusão de dados.
- Novos orçamentos e arquivos criados dentro de um projeto mantêm esse vínculo.
- Horas, valor-hora, base, acréscimos e critérios comerciais atualizam os itens e o total; critérios de demanda/escopo com correspondência na tabela comercial também recalculam.
- Textos, área de pesquisa e campos sem coeficiente configurado não recebem taxas inventadas.
- Ao abrir um orçamento salvo, seus valores não são recalculados automaticamente. Alterações financeiras explícitas recalculam mantendo descrições e serviços adicionais.
- Geração DOCX/PDF, templates, notificações e integrações externas não foram alterados.

## Validação

- 81 testes existentes aprovados, mais 1 teste novo de composição dos preços.
- TypeScript e build de produção aprovados.
- Lint sem erros; dois avisos existentes de imagens em components/admin/ProjectList.tsx.
- Navegador com dados fictícios: alteração de horas/base/acréscimos/valor-hora/urgência; navegação entre dois projetos e isolamento de propostas.
- Nenhum envio real, alteração de banco ou publicação em produção realizada.

## Publicação

Sem SQL ou variáveis novas. Enviar as alterações ao GitHub e fazer o deploy habitual. Após publicar, conferir um orçamento real já salvo e a separação por projeto. Registros antigos sem vínculo precisam ser associados deliberadamente ao projeto correto; não foram movidos por inferência.
