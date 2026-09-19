# Ajustes de projetos e acesso — 18/09/2026

Atualização incremental: mantém as seções, textos e identidade visual existentes.

## Antes de publicar

No Supabase, abra **SQL Editor → New query**, cole o conteúdo de `supabase/migrations/202609180001_project_metadata.sql` e execute. Essa migration apenas acrescenta três campos à tabela de projetos e mantém os registros e as políticas de segurança existentes. Não execute novamente `schema.sql`.

Depois, envie as alterações ao GitHub e aguarde o deploy na Vercel. Não há novas variáveis de ambiente nem dependências.

## Como preencher os projetos

Em **Admin → Portfólio**, ao cadastrar ou editar:

- **Categoria:** separe os termos por vírgula, por exemplo `Bioestatística, Zootecnia, Modelos mistos`. Cada termo vira um bloco arredondado.
- **Resumo:** aparece no cartão e na página do projeto.
- **Detalhes:** texto completo exibido ao clicar em **Ver mais**. Quebras de linha são preservadas; o campo é texto simples.
- **Situação da publicação:** por exemplo `Manuscrito em submissão`.
- **Disponibilidade / observação do acesso:** por exemplo `Disponível após publicação`.
- **Pesquisadores e colaboradores:** um nome por linha, opcionalmente com a instituição. Inclua somente informações autorizadas para divulgação.
- **Tecnologias:** mantém o campo existente. A página completa exibe todos os termos.

Os campos novos são opcionais. Projetos antigos continuam visíveis. A página `/projetos/[slug]` só apresenta projetos publicados. Os novos dados precisam ser preenchidos no Admin; não foram inventados nomes ou situações de publicação.

## Outros ajustes

- Boxplot ilustrativo na terceira frente de atuação, preservando as demais visualizações.
- Rodapé com HAS Financial (`https://financial.hasanalytics.com.br`) e foto circular com link ao perfil pessoal.
- Login reutiliza a animação orbital do início, com frase menor, recuperação de senha e controle para pausar a animação.
- Favicon em `app/icon.png`, localização reconhecida automaticamente pelo Next.js. O arquivo original da raiz foi preservado. Se o navegador mostrar o ícone antigo após o deploy, recarregue a página ou abra uma nova aba.
- Ícone HAS nas barras laterais do Admin e Cliente. O ícone leva ao início; no Cliente, o link textual anterior foi substituído e foi acrescentado contato por WhatsApp.
- **Admin → Comentários:** filtros Todos, Pendentes e Publicados. Comentários aprovados permanecem gerenciáveis; **Retirar do site** os oculta sem apagar, e **Excluir** mantém a confirmação antes da remoção definitiva.

## Validação

- Build de produção com webpack e TypeScript aprovados. A cópia de validação usa dependências por junction, incompatível com Turbopack; a configuração de build do repositório permanece a mesma.
- 28 testes automatizados aprovados e testes PostgreSQL isolados de migrations, projetos publicados, RLS e moderação de comentários.
- Lint sem erros; três avisos preexistentes de imagens.
- Login conferido sem rolagem nas telas 1280×720, 390×844 e 375×667. Em telas excepcionalmente pequenas, com zoom ou teclado aberto, o conteúdo continua acessível por rolagem.
- Navegação Ver mais e texto de detalhes conferidos com um projeto existente; boxplot e favicon verificados na prévia.
- Nenhum projeto ou comentário de produção foi alterado ou excluído, e a migration não foi aplicada remotamente.

## Ajustes complementares — gráficos, login e exclusão

Execute `supabase/migrations/202609180002_project_presentation_and_delete.sql` no Supabase → SQL Editor após as migrations anteriores. Não execute novamente `schema.sql`.

- Portfólio → Novo/Editar: campo **Tipo de projeto / produção** (artigo, livro, aplicativo ou texto personalizado). Preencha **Link de acesso ao projeto** com a URL completa, começando por https://. O botão público aparece quando um link válido estiver salvo.
- A página de detalhes usa a mesma capa cadastrada no projeto. Não é necessário enviar a imagem novamente.
- Clientes → selecione o cliente → Projetos → Editar → **Excluir projeto** → **Confirmar exclusão**. A exclusão remove projeto, checklist e notas internas. Documentos, arquivos, orçamentos e solicitações ficam preservados no cliente, sem vínculo com o projeto removido. A exclusão só é habilitada após o SQL acima e exige permissão de administrador.
- Segundo gráfico com dispersão e curva média ilustrativa; boxplots com outliers. Login com logo ampliado e dimensionamento responsivo sem cortar conteúdo.

Validação: 29 testes aprovados, integração PostgreSQL com RLS e preservação dos arquivos aprovada, build/TypeScript aprovados e lint sem erros (3 avisos de imagens já existentes). Login conferido sem rolagem em 1280×720, 375×667, 320×568 e 667×375. Nenhum projeto real foi excluído. Nenhuma migration foi aplicada no servidor e nenhum deploy foi realizado nesta edição.


## Correção de cadastro — 19/09
Se aparecer erro de coluna availability/schema cache, abra Supabase → SQL Editor → New query, cole todo o arquivo `supabase/migrations/202609190001_repair_project_metadata.sql` e clique Run. Esse SQL reúne os quatro campos do portfólio e solicita a atualização do cache da API, sem apagar dados. Aguarde alguns segundos e tente salvar novamente. Não recrie as tabelas nem execute schema.sql.

Situação da publicação e Disponibilidade agora usam menus suspensos, com opção Não informar. Valores antigos personalizados são preservados como opções ao editar. A mesma capa aparece quadrada no card e como cabeçalho retangular de 140–240px nos detalhes, com recorte central automático; não precisa enviar duas imagens.
