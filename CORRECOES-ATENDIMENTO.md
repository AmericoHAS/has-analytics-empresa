# Atualização de atendimento e barra lateral — 21/09/2026

## Aplicar nesta instalação

1. No Supabase do site, abra **SQL Editor → New query**. Copie todo o conteúdo de `supabase/CORRIGIR-OPERACOES.sql` e clique em **Run**. Esse arquivo é uma correção incremental para quem já executou o SETUP-ATENDIMENTO; não precisa refazer o setup inteiro.
2. Atualize o repositório do site com os arquivos alterados e publique o novo deploy na Vercel. Não há novas variáveis de ambiente nesta atualização.
3. Depois do deploy, atualize a página do navegador. Teste com o cliente e projeto de teste: salvar orçamento, abrir **PDF e envio**, arquivar um rascunho e excluir um projeto sem reunião ativa.
4. Em **Agenda de consultorias**, clique em uma célula ou em **Disponibilizar**. Informe um período futuro e a duração de cada reunião. Das 9h às 12h com duração de 60 minutos cria três horários. O cliente pode agendar depois que seus resultados estiverem disponíveis.

## Mudanças

- Calendário semanal/diário compartilhado, com horários livres e ocupados, navegação entre datas e confirmação de reserva. Dados e identidade de outros clientes continuam privados.
- Períodos longos são divididos em reuniões; datas inválidas, períodos incompletos, endereço presencial ausente e sobreposições são recusados com mensagens claras, sem salvar parcialmente.
- Salvar, arquivar e excluir retornam mensagens explícitas. A validação do orçamento mostra o campo que precisa de ajuste e abre a seção correspondente. Estimativas aceitam frações de hora e valores automáticos são arredondados para centavos.
- Correção dos vínculos antigos de projeto: documentos, solicitações e orçamentos continuam preservados ao excluir o projeto. Reuniões ativas precisam ser canceladas ou concluídas antes da exclusão. Pagamentos confirmados/em conferência continuam protegidos contra arquivamento.
- Orçamentos mostram suas ações de documentos dentro de **PDF e envio**. Modelos e dados do prestador ficam em **Modelos comerciais**. Versões anteriores permanecem consultáveis dentro do documento selecionado.
- Projetos com fundo azul claro; agenda, revisão e informações administrativas ficam na mesma linha de ações. Removido o bloco de quatro passos, mantendo os avisos relevantes.
- Barra lateral compartilhada entre Admin e Cliente: adaptação visual do código local da HAS Financial, 272/86 px, transição de 240 ms, troca logo/ícone, estado persistido e menu de conta no rodapé. No celular, abre sobre a página com fechamento por botão, fundo ou Escape. Movimento reduzido é respeitado.
- WhatsApp do cliente em botão flutuante. A pasta/ZIP da HAS Financial permanece como referência local e é excluída da compilação/publicação do Analytics.

## Validação e limites

Build e testes executados em cópia local de trabalho com as dependências instaladas. Testes SQL em PostgreSQL isolado verificaram instalação repetida, criação/arquivamento de orçamento, exclusão preservando documentos, reparo de FK legado, permissões, disponibilidade em blocos e atomicidade em conflito de horários. Testes de navegador com dados fictícios verificaram formulários, calendário, barra recolhida, menu de conta e celular.

Nenhum registro real foi excluído, nenhum e-mail foi enviado e nenhuma migration foi executada remotamente durante a edição. A causa exata das falhas no banco publicado não pode ser confirmada sem a resposta desse ambiente; se uma operação continuar falhando após esta correção, a tela agora informa o motivo/código para diagnóstico. Não informe senhas ou chaves secretas.
