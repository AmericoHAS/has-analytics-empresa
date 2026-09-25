"use client";
export async function generateCommercialDocument(form: FormData): Promise<{success: boolean; message: string}> {
  const response = await fetch("/api/admin/commercial-documents", { method: "POST", body: form, credentials: "same-origin" });
  const result = await response.json().catch(() => null);
  if (!result || typeof result.success !== "boolean" || typeof result.message !== "string") {
    throw Error("Falha de comunicação ao gerar o documento. Atualize e tente novamente.");
  }
  return result;
}
