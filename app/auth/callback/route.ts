import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url)
    );
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Erro no callback do Supabase:", error);

    return NextResponse.redirect(
      new URL("/login?error=invalid_code", request.url)
    );
  }

  return NextResponse.redirect(
    new URL(
      next.startsWith("/") ? next : "/",
      request.url
    )
  );
}