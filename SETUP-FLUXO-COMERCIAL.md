# Ativação do fluxo comercial — 19/09/2026

## 1. Supabase: resolver a exclusão e habilitar os novos módulos

No projeto Supabase usado pelo site, abra **SQL Editor → New query**. Copie TODO o conteúdo de **supabase/ATUALIZAR-COMERCIAL.sql**, cole e clique **Run**. Aguarde alguns segundos e recarregue o site.

Esse arquivo reúne as atualizações do portfólio, a exclusão de projetos e o novo fluxo comercial. Pode ser executado novamente e não apaga projetos ou arquivos. Requer as migrations de workspace e solicitação de orçamento de setembro/2026 já instaladas. Não execute `schema.sql` novamente e não cole apenas o nome do arquivo no SQL Editor.

A mensagem sobre `202609180002` aparece porque a função de exclusão ainda não existe no banco remoto. Só atualizar o GitHub/Vercel não executa SQL. Após este passo: Admin → Clientes → selecione o cliente → Projetos e prazos → Editar → Excluir projeto → confirme. Documentos e orçamentos permanecem no cliente; o projeto, checklist e notas internas são removidos. Nenhum projeto real foi excluído durante o desenvolvimento.

## 2. GitHub e Vercel

Envie as alterações, incluindo `package.json` e `package-lock.json`. A Vercel instalará `pdf-lib` e `docx`. Não envie node_modules, .next ou arquivos .env. Não há nova credencial exigida. O projeto continua usando as variáveis Supabase existentes. Os PDFs/Word são gerados no servidor e armazenados em bucket privado.

## 3. Cadastro do cliente

No primeiro acesso à área do cliente, aparece o formulário de identificação: nome/razão social, CPF/CNPJ, e-mail, WhatsApp, endereço, cidade, UF e CEP. Instituição e representante são opcionais. É possível preencher depois e retornar à aba Cadastro. O cadastro completo é necessário para gerar documentos; o cliente continua podendo acompanhar o projeto. Os dados são declarados pelo usuário; o site não consulta cadastros oficiais nem verifica a identidade civil automaticamente.

Admin vê/edita o mesmo cadastro dentro do cliente. Dados pessoais ficam em tabela própria com RLS, sem publicação no portfólio.

## 4. Orçamento e contrato

1. Em solicitações, confira os campos complementares. Para pedidos sem conta vinculada, cadastre o cliente e use **Vincular ao cliente já cadastrado com este e-mail**; o vínculo exige correspondência de e-mail.
2. Em Clientes → Orçamentos e aprovações, cadastre/edite o orçamento. Selecione a solicitação de origem e confira itens, desconto, pagamento e prazo final. O planejamento interno fica separado do conteúdo público.
3. Na mesma aba, abra **Modelo de orçamento e dados do prestador**. Preencha a identificação legal da HAS/prestador e ajuste o texto padrão. Os dados do prestador também devem ser preenchidos no modelo de contrato.
4. Clique **Preparar nova versão PDF + Word**, selecione o orçamento e ajuste as condições específicas. A geração cria um rascunho privado, visível apenas ao admin.
5. Baixe e revise o PDF. Use **Disponibilizar ao cliente** e confirme a revisão. O cliente acessa somente o PDF; o Word é restrito ao administrador, inclusive no Storage.
6. O cliente pode aprovar ou solicitar revisão naquela versão. Alterações no orçamento invalidam a aprovação pendente da versão anterior. Documentos já gerados permanecem no histórico.
7. Contratos só são gerados a partir de orçamento aprovado. A aba **Contratos e assinaturas** contém o editor, PDFs e aprovações de conteúdo.
8. Para alterar um documento, use **Editar como nova versão**. O texto pode mudar por cliente, sem modificar o modelo global nem sobrescrever arquivos já enviados. O Word baixado também pode ser editado fora do site. Exporte o PDF correspondente e use **Enviar revisão feita no Word (DOCX + PDF)**; isso cria um novo rascunho com os dois arquivos, sem sobrescrever o histórico. Confira os arquivos antes de disponibilizar. Alterações de valores/escopo devem ser salvas primeiro no orçamento. Uma revisão externa não é convertida automaticamente de volta ao editor de texto.

O contrato inicial é uma base operacional editável, não uma reprodução de um contrato jurídico fornecido pelo usuário (nenhum modelo de contrato estava disponível nesta edição). Revise e complete as condições que efetivamente acordar, inclusive revisão, cancelamento e identificação do prestador, antes de publicar. O modelo de orçamento reaproveita os serviços/observações/configuração comercial já existentes; não importa dados pessoais históricos da planilha.

## 5. Assinatura gov.br

Na aba Contratos, o cliente baixa o PDF, abre **https://assinador.iti.br/** (conta gov.br prata/ouro), assina, baixa o PDF assinado e o devolve no campo próprio. O arquivo vai para a fila de conferência. A aprovação do conteúdo no portal é distinta da assinatura eletrônica.

O admin baixa o arquivo devolvido, confere em **https://validar.iti.gov.br/** e registra o resultado. O site NÃO coleta senha gov.br, não assina em nome do usuário e não declara validação criptográfica automática. Se o orçamento foi alterado, gere um contrato atualizado antes de solicitar assinatura.

Referência oficial: https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica

## Correspondência com a planilha

| Coluna da planilha | Onde está no site |
|---|---|
| ID | Identificador da solicitação e número do orçamento |
| Data da solicitação | Data automática da solicitação |
| Nome, E-mail, WhatsApp | Solicitação; identificação completa também na aba Cadastro |
| Tipo de serviço | Solicitação |
| Área da pesquisa | Campo complementar da solicitação |
| Prazo desejado | Solicitação; distinto do prazo final acordado |
| Situação do banco de dados | Campo complementar da solicitação |
| Urgência | Campo complementar da solicitação |
| Finalidade do trabalho | Campo complementar da solicitação |
| Modelo de entrega | Campo complementar da solicitação |
| Descrição da demanda | Solicitação e escopo editável do orçamento |
| Avaliação interna do banco | Planejamento do orçamento, só admin |
| Complexidade da análise | Planejamento do orçamento e estimativa pelos critérios importados |
| Observações internas | Planejamento, só admin; nunca incluídas no PDF/Word |
| Observações para o cliente | Observações do orçamento e condições do documento |
| Título do projeto | Projeto vinculado; título da proposta/documento editável |
| Departamento | Solicitação e planejamento interno |
| Fase 1, Fase 2, Fase 3 | Três itens iniciais, editáveis; mais itens podem ser incluídos |
| Horas estimadas | Estimativa e memória interna do orçamento |
| Valor base | Configuração comercial/estimativa e memória interna |
| Acréscimos | Coeficientes da estimativa e memória interna |
| Desconto | Percentual aplicado uma vez ao subtotal |
| Valor final | Calculado no banco a partir dos itens e desconto |
| Forma de pagamento | Campo próprio do orçamento, incluído nos documentos |
| Prazo final de entrega | Campo próprio do orçamento, incluído nos documentos |
| Status | Orçamento e situação de cada versão do documento |
| Link do PDF | Arquivo privado associado à versão; URL temporária ao baixar |
| Data de envio do orçamento | Registrada ao disponibilizar o PDF ou marcar Enviado |

Os campos complementares iniciais são opcionais. O cálculo existente foi preservado: base + horas × valor-hora + base × soma dos coeficientes, seguido do desconto. A ação Aplicar estimativa distribui o resultado entre os itens. A memória interna registra base/horas/acréscimos; editar só essa memória não recalcula os itens. O total oficial sempre vem dos itens salvos. Não há sincronização automática com Google Sheets/Apps Script.

## Segurança e verificação

- RLS separa cadastro, planejamento interno, modelos, documentos publicados e rascunhos.
- Bucket `commercial-documents` privado; URLs de download expiram em 60 segundos.
- Word é restrito ao admin tanto na ação do servidor quanto nas políticas de Storage.
- PDF devolvido: até 20 MB, leitura como PDF verificada no servidor; assinatura depende de conferência administrativa.
- Cada geração tem identificador próprio, arquivos distintos e snapshot dos dados públicos usados. Valores não mudam silenciosamente em documentos emitidos.
- Publicação e respostas geram avisos internos. Envio por e-mail depende do Resend/cron já configurado.
- Testes de banco são isolados em PostgreSQL/PGlite, sem modificar o Supabase real. O desenvolvimento não executou migrations remotas, assinaturas reais ou deploy.
- PDFs aceitam o conjunto latino usual, incluindo acentos em português. Emojis/caracteres sem suporte geram mensagem para revisão do texto, sem substituição silenciosa.
