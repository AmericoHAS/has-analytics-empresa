import { generateCommercialDocument } from "@/lib/commercial/generate";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ success: false, message: "Origem da solicitação inválida." }, { status: 403 });
  }
  try {
    // The existing generator validates the session, admin role and every input.
    const result = await generateCommercialDocument(await request.formData());
    return Response.json(result, { status: result.success ? 200 : 400, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ success: false, message: "Não foi possível processar a geração. Tente novamente." }, { status: 400 });
  }
}
