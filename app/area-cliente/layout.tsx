import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClientAreaLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  return children;
}