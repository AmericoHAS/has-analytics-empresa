import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function accessEmailConfig() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM || process.env.RESEND_FROM_EMAIL;
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !from || !site)
    throw Error("Configure Resend, remetente e SITE_URL para enviar o acesso.");
  const url = new URL(site);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("SITE_URL deve ser o endereço HTTPS do site.");
  return { key, from, origin: url.origin };
}

// Links de autenticação são enviados diretamente: nunca armazenados em avisos ou logs.
export async function sendClientAccessEmail(clientId: string) {
  const { key, from, origin } = accessEmailConfig();
  const db = createAdminClient();
  const {
    data: { user },
    error,
  } = await db.auth.admin.getUserById(clientId);
  if (error || !user?.email)
    throw Error("Conta sem e-mail disponível para envio.");
  const { data, error: linkError } = await db.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
  });
  if (linkError || !data.properties?.hashed_token)
    throw Error("Não foi possível preparar o link de acesso. Tente reenviar.");
  const link = new URL("/auth/confirm", origin);
  link.searchParams.set("token_hash", data.properties.hashed_token);
  link.searchParams.set("type", "recovery");
  link.searchParams.set("next", "/redefinir-senha");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `has-client-access-${randomUUID()}`,
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "HAS Analytics · Seu acesso foi aprovado",
      text: `Seu cadastro na HAS Analytics foi aprovado.

Defina sua senha pelo link seguro abaixo:
${link}

Depois, entre em ${origin}/login com este e-mail e a senha escolhida. No primeiro acesso, complete seus dados pessoais para liberar o acompanhamento do projeto.

O link é temporário e de uso único. Se expirar, use “Esqueci minha senha” na tela de login.

HAS Analytics`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw Error(
      "A conta está cadastrada, mas o serviço de e-mail não aceitou o envio. Tente reenviar o acesso.",
    );
}
