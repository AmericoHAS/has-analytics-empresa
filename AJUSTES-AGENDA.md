# Agenda — janela de disponibilidade

- Criação e edição de horários livres em janela sobre o calendário.
- Término calculado automaticamente pela duração; opção de 1 a 12 horários consecutivos.
- Data/hora em Brasília, inclusive quando o término passa para o dia seguinte.
- Endereço obrigatório apenas para presencial. Online não envia endereço antigo.
- Erros de conflito aparecem na janela, sem apagar o preenchimento.
- Horários passados não podem ser selecionados na grade; o botão principal sugere um início futuro.
- Ao salvar em outra data, o calendário mostra a data escolhida.
- Remoção de disponibilidade preservada; reservas continuam protegidas pelo banco.

Nenhum SQL ou variável de ambiente nova. Publicar os arquivos no GitHub/Vercel.

Verificações: testes de cálculo de datas, TypeScript e lint; navegador local com componentes reais e banco simulado para criação, edição, remoção, conflito, virada de ano e exibição desktop/celular. Nenhuma reserva ou notificação real foi criada.
