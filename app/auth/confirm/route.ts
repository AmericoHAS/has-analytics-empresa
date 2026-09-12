import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/";

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(
      new URL("/login?error=invalid_recovery_link", request.url)
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    console.error("Erro ao validar recuperação:", error);

    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired_recovery_link", request.url)
    );
  }

  return NextResponse.redirect(
    new URL(
      next.startsWith("/") ? next : "/redefinir-senha",
      request.url
    )
  );
}