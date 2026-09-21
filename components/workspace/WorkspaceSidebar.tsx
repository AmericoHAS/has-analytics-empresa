"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  LayoutDashboard,
  Users,
  ClipboardList,
  Files,
  FolderKanban,
  MessageSquare,
  Bell,
  Settings,
  CalendarDays,
  PlusCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import AccountAccess from "./AccountAccess";
const icons = {
  visao: LayoutDashboard,
  clientes: Users,
  solicitacoes: ClipboardList,
  documentos: Files,
  projetos: FolderKanban,
  comentarios: MessageSquare,
  mensagens: Bell,
  configuracoes: Settings,
  agenda: CalendarDays,
  acompanhamento: LayoutDashboard,
  orcamento: PlusCircle,
};
export type SidebarItem = { id: string; label: string; href?: string };
export default function WorkspaceSidebar({
  admin = false,
  items,
  active,
  onNavigate,
  clientId,
  name,
  onProfile,
}: {
  admin?: boolean;
  items: SidebarItem[];
  active: string;
  onNavigate?: (id: string) => void;
  clientId?: string;
  name?: string;
  onProfile?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [account, setAccount] = useState({
      id: clientId ?? "",
      name: name ?? "Minha conta",
    });
  const mobileButton = useRef<HTMLButtonElement>(null),
    aside = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setCollapsed(localStorage.getItem("has-sidebar-collapsed") === "true");
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (clientId) return;
    let alive = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (alive)
        setAccount({ id: user.id, name: data?.full_name ?? "Minha conta" });
    })();
    return () => {
      alive = false;
    };
  }, [clientId]);
  useEffect(() => {
    if (!mobile) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aside.current
      ?.querySelector<HTMLButtonElement>(".ws-mobile-close")
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        setMobile(false);
        mobileButton.current?.focus();
      }
      if (e.key === "Tab") {
        const all = Array.from(
          aside.current?.querySelectorAll<HTMLElement>(
            'button,a[href],[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
    };
  }, [mobile]);
  function close() {
    setMobile(false);
    mobileButton.current?.focus();
  }
  return (
    <>
      <button
        ref={mobileButton}
        className="ws-mobile-open"
        aria-label="Abrir menu"
        aria-expanded={mobile}
        onClick={() => setMobile(true)}
      >
        <Menu size={22} />
      </button>
      {mobile && (
        <button
          className="ws-backdrop"
          aria-label="Fechar menu"
          onClick={close}
        />
      )}
      <aside
        ref={aside}
        className={`ws-sidebar ${collapsed ? "is-collapsed" : ""} ${mobile ? "is-mobile-open" : ""}`}
        aria-label={admin ? "Navegação administrativa" : "Navegação do cliente"}
      >
        <button
          className="ws-collapse"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          onClick={() =>
            setCollapsed((v) => {
              try {
                localStorage.setItem("has-sidebar-collapsed", String(!v));
              } catch {}
              return !v;
            })
          }
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
        <div className="ws-brand">
          <Link href="/" aria-label="HAS Analytics — início">
            <Image
              className="ws-logo"
              src="/logo-has.analytics.png"
              alt=""
              width={68}
              height={68}
            />
            <Image
              className="ws-mark"
              src="/icone-has.analytics.png"
              alt=""
              width={44}
              height={44}
            />
            <span>
              <strong>HAS Analytics</strong>
              <small>{admin ? "Administração" : "Área do cliente"}</small>
            </span>
          </Link>
          <button
            className="ws-mobile-close"
            aria-label="Fechar menu"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <nav>
          {items.map((item) => {
            const Icon = icons[item.id as keyof typeof icons] ?? Files;
            const content = (
              <>
                <Icon size={19} />
                <span>{item.label}</span>
              </>
            );
            const props = {
              className: `ws-nav ${active === item.id ? "active" : ""}`,
              title: item.label,
              "aria-label": item.label,
              "aria-current":
                active === item.id ? ("page" as const) : undefined,
              onClick: () => {
                onNavigate?.(item.id);
                setMobile(false);
              },
            };
            return item.href ? (
              <Link key={item.id} href={item.href} {...props}>
                {content}
              </Link>
            ) : (
              <button key={item.id} {...props}>
                {content}
              </button>
            );
          })}
        </nav>
        <div className="ws-account">
          {account.id && (
            <AccountAccess
              clientId={account.id}
              name={account.name}
              admin={admin}
              onProfile={
                onProfile
                  ? () => {
                      onProfile();
                      setMobile(false);
                    }
                  : undefined
              }
            />
          )}
        </div>
      </aside>
    </>
  );
}
