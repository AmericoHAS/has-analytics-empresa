import FirstAccess from "@/components/workspace/FirstAccess";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClientAreaLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

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
    redirect("/orcamento/acesso");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  const { data: onboarding, error: onboardingError } = await supabase
    .from("client_onboarding")
    .select("completed_at")
    .eq("client_id", userId)
    .maybeSingle();
  if (onboardingError)
    return (
      <main className="first-access-page">
        <p>
          Não foi possível conferir seu cadastro. Tente atualizar a página. Se
          persistir, avise a HAS para conferir a atualização do primeiro acesso.
        </p>
      </main>
    );
  if (!onboarding?.completed_at) return <FirstAccess clientId={userId} />;
  return children;
}
