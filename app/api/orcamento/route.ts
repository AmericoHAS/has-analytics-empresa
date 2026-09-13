import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { budgetRequestSchema, budgetRequestRecord } from "@/lib/budget-request";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ message: "Formato inválido." }, { status: 415 });
  // Bound the body before parsing; do not log personal project information.
  const reader = request.body?.getReader();
  if (!reader)
    return NextResponse.json(
      { message: "Preencha o formulário." },
      { status: 400 },
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 24000) {
      await reader.cancel();
      return NextResponse.json(
        { message: "O texto excedeu o limite do formulário." },
        { status: 413 },
      );
    }
    chunks.push(value);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return NextResponse.json(
      { message: "Revise os campos do formulário." },
      { status: 400 },
    );
  }
  const parsed = budgetRequestSchema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json(
      {
        message:
          "Revise os campos: nome, e-mail, contato, título e descrição (mínimo de 30 caracteres). Confirme também a autorização de contato.",
      },
      { status: 400 },
    );
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("budget_requests")
      .insert(budgetRequestRecord(parsed.data));
    // A retry with the same generated ID must not create a second request.
    if (error && error.code !== "23505") throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      {
        message:
          "Não foi possível salvar agora. Seus dados continuam no formulário. Tente novamente ou fale pelo WhatsApp.",
      },
      { status: 503 },
    );
  }
}
