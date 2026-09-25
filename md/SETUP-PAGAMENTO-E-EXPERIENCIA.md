# Atualização de experiência e pagamento — 20/09/2026

## Ativar
1. No Supabase usado pela Vercel: SQL Editor → New query → cole TODO o conteúdo de `supabase/ATUALIZAR-COMERCIAL.sql` atualizado → Run. Ele inclui a nova migration `202609200001_payment_workflow.sql` e os reparos anteriores. Não apaga os dados existentes. Se a atualização comercial anterior já passou integralmente, também é possível executar apenas `supabase/ATUALIZAR-FLUXO-PAGAMENTO.sql`.
2. Envie as alterações ao GitHub e aguarde o deploy da Vercel. Não envie .env, node_modules ou .next. Nenhuma nova chave de API é necessária.
3. Admin → Modelos comerciais → Pagamento e taxas · Mercado Pago: configure a chave Pix, instruções e taxa total de cada parcelamento. Os cartões começam DESATIVADOS. Ative somente depois de conferir as taxas do seu plano, incluindo antecipação se houver.

## Caminho de uma nova proposta
1. Abra o cliente → Orçamentos e aprovações → Novo orçamento. A solicitação mais recente é copiada automaticamente; selecione outra se necessário. Título, projeto, escopo, prazo e informações complementares podem ser revisados. A solicitação original é preservada.
2. Confira os três itens e seus valores. Se houver parceria em publicação, marque a opção: aplica 30% inicialmente, editável no campo desconto. Defina as condições reais da parceria nas observações. A marcação não atribui autoria automaticamente.
3. Salve o orçamento. Ele ainda é rascunho. Complete o cadastro do cliente e a identificação da HAS no modelo.
4. Prepare nova versão PDF + Word. O servidor gera uma versão correspondente a cada forma de pagamento habilitada, já com total e parcelas calculados. Selecione cada opção para conferir seu PDF. Os arquivos permanecem privados até a liberação.
5. Clique em Disponibilizar ao cliente e confirme a revisão do conjunto. Essa ação efetivamente publica os PDFs e muda o orçamento para enviado. Alterar manualmente um status não substitui essa ação.
6. O cliente abre a proposta, seleciona uma forma e confirma a escolha. O PDF exibido passa a ser o correspondente à opção escolhida. Ele aprova, assina o PDF no gov.br e devolve. A assinatura precisa ser conferida pelo admin no ITI e marcada como válida. O gov.br também pode ser usado no orçamento, não apenas no contrato.
7. Na aba Pagamento, o cliente solicita a cobrança. O admin disponibiliza as instruções Pix ou cria a cobrança no Mercado Pago pelo total escolhido e cola o link HTTPS. Não há cobrança automática/API neste módulo.
8. O cliente paga no provedor e envia comprovante PDF, PNG ou JPG de até 10 MB. O admin confere o recebimento no banco e confirma no portal. Comprovante recebido não significa pagamento confirmado.
9. Para projetos vinculados a orçamento ativo, o banco impede avançar para início da análise/organização do banco sem pagamento confirmado. Projetos já em andamento são preservados. Confira também o checklist e o recebimento dos dados antes de iniciar. Projetos sem orçamento vinculado mantêm o fluxo anterior: vincule o projeto ao orçamento para aplicar o controle.

## Como as taxas funcionam
O campo é a porcentagem total que a operadora descontará. Para preservar o líquido, o total cobrado é `valor dos serviços / (1 - taxa/100)`. Exemplo: R$ 1.000 líquidos com 5% de taxa resultam em R$ 1.052,63 cobrados. Parcelas são arredondadas em centavos, com ajuste na última. A condição real do link do Mercado Pago deve corresponder ao documento. Não some novamente uma taxa já incluída. Não são consultadas taxas automaticamente.

## Histórico e dados existentes
- Propostas existentes não são reescritas. Para receber as opções de pagamento e o novo visual, gere e disponibilize um novo conjunto. Um documento assinado permanece preservado; mudar valores exige nova proposta/aprovação.
- A seleção usa valores previamente gerados pelo admin. O cliente não envia o preço ao banco.
- Os documentos PDF continuam privados. Word permanece exclusivo do admin. Comprovantes têm bucket privado, RLS por cliente e URLs temporárias.
- A confirmação do pagamento é administrativa, sem webhook ou conciliação bancária automática. Não armazene números de cartão.
- O arquivo original do modelo de orçamento anteriormente anexado não estava mais disponível nesta edição. Foram preservados os textos, serviços e critérios já incorporados ao projeto e renovado o layout com a identidade HAS. Uma reprodução exata do modelo original requer reenviar esse arquivo.

## Organização das telas
- Admin e cliente: próximos passos, avisos em destaque, resumo recolhido, navegação por etapas e histórico opcional.
- Informações administrativas abaixo do checklist: menus com sugestões e opção Outro/personalizar.
- Cliente: Meu perfil e cadastro fica no fim da barra lateral, junto de Sair. Os dados existentes permanecem editáveis; nome/contato de solicitação são aproveitados quando o cadastro completo ainda não existe.
- Referências de organização: https://www.hellobonsai.com/proposals e https://www.moxo.com/client-portal. Implementação própria, adaptada ao fluxo HAS.

## Conferência recomendada após o deploy
Com um cliente de teste: cadastrar perfil → criar orçamento a partir da solicitação → marcar parceria e revisar desconto → gerar PDFs → conferir todas as formas → disponibilizar → escolher uma forma pelo cliente → aprovar → devolver assinado → conferir assinatura → solicitar pagamento → inserir instruções/link → anexar comprovante → confirmar recebimento → iniciar análise. Teste também pelo celular.

As verificações locais usam dados simulados e PostgreSQL isolado. Nenhuma cobrança real, exclusão de projeto, envio de e-mail, assinatura ou migração remota foi realizada nesta edição.
