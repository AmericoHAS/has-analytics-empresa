import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = createAdminClient();
    const { error: enqueueError } = await db.rpc(
      "enqueue_deadline_notifications",
    );
    if (enqueueError) throw Error("Falha ao gerar avisos de prazo.");
    if (process.env.NOTIFICATIONS_ENABLED !== "true")
      return NextResponse.json({ email: "disabled", inApp: "updated" });
    const apiKey = process.env.RESEND_API_KEY,
      from = process.env.NOTIFICATION_FROM,
      site = process.env.SITE_URL;
    if (!apiKey || !from || !site || !site.startsWith("https://"))
      return NextResponse.json(
        { error: "Configure Resend, remetente e SITE_URL HTTPS." },
        { status: 503 },
      );
    let sent = 0,
      failed = 0;
    const started = Date.now();
    // Claim one at a time so a slow provider cannot strand a whole batch.
    for (
      let processed = 0;
      processed < 20 && Date.now() - started < 40000;
      processed++
    ) {
      const { data: rows, error } = await db.rpc("claim_notification_emails", {
        batch_size: 1,
      });
      if (error) throw Error("Falha ao reservar avisos.");
      const row = rows?.[0];
      if (!row) break;
      try {
        const {
          data: { user },
          error: userError,
        } = await db.auth.admin.getUserById(row.recipient_id);
        if (userError || !user?.email)
          throw Error("Destinatário sem e-mail cadastrado.");
        const { data: profile } = await db
          .from("profiles")
          .select("role")
          .eq("id", row.recipient_id)
          .single();
        const to =
          profile?.role === "admin"
            ? process.env.ADMIN_NOTIFICATION_EMAIL || user.email
            : user.email;
        const url = new URL(
          profile?.role === "admin" ? "/admin" : "/area-cliente",
          site,
        ).toString();
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `has-notice-${row.id}`,
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject: `HAS Analytics · ${row.title}`,
            text: `${row.body}\n\nAcesse sua conta: ${url}\n\nHAS Analytics`,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok)
          throw Error(`Provedor retornou HTTP ${response.status}.`);
        const { error: ack } = await db
          .from("notifications")
          .update({
            email_status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
            locked_at: null,
          })
          .eq("id", row.id);
        if (ack) throw Error("Envio aceito; confirmação local pendente.");
        sent++;
      } catch (e) {
        failed++;
        const terminal = row.attempts >= 5;
        const { error: failure } = await db
          .from("notifications")
          .update({
            email_status: terminal ? "failed" : "pending",
            last_error: e instanceof Error ? e.message : "Falha no envio.",
            locked_at: null,
            next_attempt_at: new Date(
              Date.now() + Math.min(60, 2 ** row.attempts) * 60000,
            ).toISOString(),
          })
          .eq("id", row.id);
        if (failure) throw Error("Falha ao registrar tentativa de envio.");
      }
      await new Promise((resolve) => setTimeout(resolve, 550));
    }
    return NextResponse.json({ sent, failed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no processamento." },
      { status: 500 },
    );
  }
}
