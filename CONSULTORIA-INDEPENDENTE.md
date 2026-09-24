# Revisões e conclusão independentes da consultoria

Aplicar no Supabase SQL Editor o arquivo `supabase/CONSULTORIA-INDEPENDENTE.sql`, após as atualizações anteriores, especialmente REVISAO-FINAL.sql. A cópia em migrations/202609240002_independent_consultations.sql é idêntica; executar apenas uma. Publicar também a alteração de ProjectLifecycle.tsx pelo GitHub/Vercel.

- Abrir revisão deixa de exigir reunião realizada. Mantém a análise inicial concluída, projeto não arquivado e uma revisão técnica aberta por vez.
- Concluir a análise da revisão também registra sua conclusão técnica; não é mais necessário aguardar reunião para abrir a próxima.
- Encerrar projeto deixa de exigir consultoria concluída ou ausência de reserva pendente. Mantém resultados finais, conclusão das revisões e recibo para pagamentos confirmados.
- O botão de encerramento aparece após concluir a análise, sem aguardar a consultoria.
- Consultoria liberada continua agendável após conclusão do projeto, enquanto ele não estiver arquivado. Reservas já existentes e avisos são preservados.
- Arquivamento continua protegendo reservas pendentes, pois esconder o projeto com reunião ativa prejudicaria o atendimento.
- Não altera arquivos, não conclui projetos automaticamente e não marca reuniões como realizadas. Revisões já concluídas tecnicamente passam a ter completed_at preenchido quando faltante, sem avisos retroativos.

Sem novas variáveis. SQL não executado em produção. Testes PostgreSQL isolados aprovados: fluxo sem reunião, revisões consecutivas, encerramento com reserva pendente, agendamento após encerramento, permissões e idempotência. TypeScript e lint também verificados.
