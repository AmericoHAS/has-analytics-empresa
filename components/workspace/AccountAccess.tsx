"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserRound, Settings, ChevronUp, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DropdownMenu } from "radix-ui";
import SignOut from "./SignOut";
export default function AccountAccess({
  clientId,
  name,
  settings = false,
  admin = false,
  onProfile,
}: {
  clientId: string;
  name: string;
  settings?: boolean;
  admin?: boolean;
  onProfile?: () => void;
}) {
  const [whatsapp, setWhatsapp] = useState(false),
    [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("account_preferences")
        .select("avatar_path,whatsapp_opt_in,whatsapp_number")
        .eq("client_id", clientId)
        .maybeSingle();
      if (alive && data) {
        setWhatsapp(data.whatsapp_opt_in);
        setPhone(data.whatsapp_number);
      }
      if (data?.avatar_path) {
        const { data: url } = await supabase.storage
          .from("profile-avatars")
          .createSignedUrl(data.avatar_path, 3600);
        if (alive) setPhoto(url?.signedUrl ?? "");
      }
    }
    void load();
    window.addEventListener("has-profile-updated", load);
    return () => {
      alive = false;
      window.removeEventListener("has-profile-updated", load);
    };
  }, [clientId]);
  const avatar = (
    <span className="account-avatar">
      {photo ? (
        <Image
          unoptimized
          src={photo}
          alt="Sua foto de perfil"
          width={48}
          height={48}
        />
      ) : (
        <UserRound size={26} />
      )}
    </span>
  );
  if (!settings)
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="ws-profile-trigger"
          aria-label={`Perfil e configurações de ${name}`}
        >
          {avatar}
          <span className="ws-profile-info">
            <strong>{name}</strong>
            <small>Minha conta</small>
          </span>
          <ChevronUp className="ws-profile-chevron" size={16} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="ws-profile-popover"
            side="top"
            align="start"
            sideOffset={10}
            collisionPadding={12}
          >
            <div className="ws-profile-head">
              <strong>{name}</strong>
              <small>{admin ? "Administrador" : "Cliente HAS Analytics"}</small>
            </div>
            {onProfile ? (
              <DropdownMenu.Item onSelect={onProfile}>
                <UserRound size={17} />
                Meu perfil e dados
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item asChild>
                <Link href="/area-cliente?secao=perfil">
                  <UserRound size={17} />
                  Meu perfil e dados
                </Link>
              </DropdownMenu.Item>
            )}
            {onProfile ? (
              <DropdownMenu.Item onSelect={onProfile}>
                <Settings size={17} />
                Configurações da conta
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item asChild>
                <Link href="/area-cliente?secao=perfil#configuracoes">
                  <Settings size={17} />
                  Configurações da conta
                </Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              className="ws-logout"
              onSelect={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) {
                  setMessage("Não foi possível sair. Tente novamente.");
                  return;
                }
                location.href = "/login";
              }}
            >
              <LogOut size={17} />
              Sair da conta
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
        {message && <p role="alert">{message}</p>}
      </DropdownMenu.Root>
    );
  return (
    <section id="configuracoes" className="workspace-card account-settings">
      <div className="row">
        {avatar}
        <div>
          <h2>Meu perfil</h2>
          <p>Foto e configurações da sua conta</p>
        </div>
      </div>
      <label>
        Foto de perfil (JPG, PNG ou WebP, até 2 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            let path = "";
            try {
              if (
                file.size > 2097152 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              )
                throw Error("Escolha uma imagem de até 2 MB.");
              const bitmap = await createImageBitmap(file);
              if (bitmap.width > 8000 || bitmap.height > 8000)
                throw Error("Escolha uma foto com até 8.000 pixels por lado.");
              bitmap.close();
              path = `${clientId}/${crypto.randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]}`;
              const { error } = await supabase.storage
                .from("profile-avatars")
                .upload(path, file, { contentType: file.type });
              if (error)
                throw Error(
                  "Não foi possível enviar a foto. Confira a atualização do banco.",
                );
              const { error: save } = await supabase
                .from("account_preferences")
                .upsert(
                  { client_id: clientId, avatar_path: path },
                  { onConflict: "client_id" },
                );
              if (save) throw Error("Não foi possível salvar a foto.");
              path = "";
              window.dispatchEvent(new Event("has-profile-updated"));
              setMessage("Foto atualizada.");
            } catch (e) {
              if (path)
                await supabase.storage.from("profile-avatars").remove([path]);
              setMessage(e instanceof Error ? e.message : "Falha ao salvar.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <details>
        <summary>Preferências de avisos</summary>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await supabase.from("account_preferences").upsert(
              {
                client_id: clientId,
                whatsapp_opt_in: whatsapp,
                whatsapp_number: phone,
              },
              { onConflict: "client_id" },
            );
            setMessage(
              error
                ? "Não foi possível salvar. Use o número no formato +5544999999999."
                : "Preferências salvas. O WhatsApp depende da ativação da integração pela HAS.",
            );
            setBusy(false);
          }}
        >
          <label>
            WhatsApp com código do país
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder="+5544999999999"
              pattern="\+[1-9][0-9]{7,14}"
              required={whatsapp}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={whatsapp}
              onChange={(e) => setWhatsapp(e.target.checked)}
            />
            Quero receber avisos do meu atendimento pelo WhatsApp.
          </label>
          <button className="btn" disabled={busy}>
            Salvar preferências
          </button>
        </form>
      </details>
      <details>
        <summary>Alterar senha</summary>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("password") !== f.get("confirm")) {
              setMessage("As senhas não coincidem.");
              return;
            }
            setBusy(true);
            const { error } = await supabase.auth.updateUser({
              password: String(f.get("password")),
            });
            setMessage(
              error
                ? "Não foi possível alterar a senha. Entre novamente e tente de novo."
                : "Senha atualizada.",
            );
            setBusy(false);
          }}
        >
          <label>
            Nova senha
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            Repita a senha
            <input
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="btn" disabled={busy}>
            Salvar senha
          </button>
        </form>
      </details>
      <p role="status">{message}</p>
      <SignOut />
    </section>
  );
}
