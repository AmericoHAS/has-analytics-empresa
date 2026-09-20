# Modelos nativos HAS Analytics

Arquivos originais copiados sem alterações dos modelos fornecidos pelo proprietário. Nunca colocar exemplos preenchidos de clientes nesta pasta.

- `modelo_orcamento_HAS.docx`: cliente, demanda, departamento, três fases, observações, desconto, valor e pagamento.
- `modelo_contrato_HAS.docx`: mantém as cláusulas originais; preenche identidade do cliente, fases, valor escolhido, Pix/link, prazo, revisões e foro.
- `modelo_recibo_HAS.docx`: emissão após confirmação integral do recebimento; valor, transação, contrato vinculado e valor por extenso.

Mapeamento: `lib/commercial/render.ts`. Preenchimento e conversão: `lib/commercial/template-engine.ts`. Informações adicionais são acrescentadas sem substituir as cláusulas do modelo. Condições contratuais devem ser conferidas pelo admin antes da publicação.

O Word preserva os componentes nativos. O PDF usa renderização local em Chromium sem acesso à rede. Tinos (licença OFL em `fonts/LICENSE.txt`) fornece métricas compatíveis com Times New Roman no servidor Linux. Não é necessário serviço externo de conversão.

Em desenvolvimento Windows o gerador usa Microsoft Edge instalado. `DOCUMENT_BROWSER_PATH` pode indicar outro Chromium local. Na Vercel Linux usa `@sparticuz/chromium`. Não configure caminho Windows na Vercel.
