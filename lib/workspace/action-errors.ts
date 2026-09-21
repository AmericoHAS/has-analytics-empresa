export function actionError(
  error: { code?: string; message?: string },
  operation: string,
) {
  const code = error.code ?? "";
  if (code === "P0001")
    return error.message || `Não foi possível ${operation}.`;
  if (["PGRST202", "PGRST204", "42883", "42703", "42P01"].includes(code))
    return `O banco está com uma versão diferente do site. Execute supabase/CORRIGIR-OPERACOES.sql desta atualização e tente ${operation} novamente. (${code})`;
  if (code === "23503")
    return `Não foi possível ${operation}: há registros vinculados. A correção em supabase/CORRIGIR-OPERACOES.sql preserva os documentos e ajusta esses vínculos. Se persistir, informe o código 23503.`;
  if (code === "23514")
    return `Não foi possível ${operation}: uma regra do banco recusou os dados. Confira os campos e aplique supabase/CORRIGIR-OPERACOES.sql. (${code})`;
  if (code === "42501")
    return "Sua sessão não tem permissão administrativa para esta operação. Entre novamente com a conta do administrador.";
  if (code === "23505")
    return "Este registro já existe. Atualize a lista antes de tentar novamente.";
  if (code === "23502")
    return `Não foi possível ${operation}: o banco exige um campo que esta versão não enviou. Informe o código 23502 para conferirmos o cadastro.`;
  return `Não foi possível ${operation}. ${code ? `Código: ${code}.` : "Confira sua conexão e entre novamente se necessário."}`;
}
