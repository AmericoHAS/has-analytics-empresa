"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ClientProfile from "./ClientProfile";
import { supabase } from "@/lib/supabase";
export default function FirstAccess({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <main className="first-access-page">
      <div className="first-access-content">
        <span className="eyebrow">Bem-vindo à HAS Analytics</span>
        <h1>Vamos completar seu cadastro</h1>
        <p>
          Esta etapa aparece apenas no primeiro acesso. Salve seus dados para
          liberar projetos, documentos e acompanhamento.
        </p>
        <ClientProfile
          clientId={clientId}
          expanded
          onboarding
          onSaved={() => {
            router.replace("/area-cliente");
            router.refresh();
          }}
        />
        <button
          className="btn"
          onClick={async () => {
            const { error } = await supabase.auth.signOut();
            if (error) setMessage("Não foi possível sair. Tente novamente.");
            else {
              router.replace("/login");
              router.refresh();
            }
          }}
        >
          Sair da conta
        </button>
        {message && <p role="alert">{message}</p>}
      </div>
    </main>
  );
}
