"use client";
import { supabase } from "@/lib/supabase";
export default function SignOut() {
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        location.href = "/login";
      }}
    >
      Sair da conta
    </button>
  );
}
