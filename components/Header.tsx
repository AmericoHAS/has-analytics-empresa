"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [section, setSection] = useState("inicio");
  useEffect(() => {
    if (pathname !== "/") return;
    let frame = 0;
    const update = () => {
      let active = "inicio";
      for (const id of ["servicos", "projetos", "sobre", "orcamento"]) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 150) active = id;
      }
      setSection(active);
      frame = 0;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [pathname]);
  const active = pathname === "/" ? section : pathname.startsWith("/projetos") ? "projetos" : pathname.startsWith("/orcamento") ? "orcamento" : pathname.startsWith("/area-cliente") ? "cliente" : "";
  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (pathname !== "/" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setOpen(false);
    target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  const current = (id: string) => active === id ? (pathname === "/" ? "location" as const : "page" as const) : undefined;
  return (
    <header className="header public-header">
      <div className="container header-row">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <Image src="/icone-has.analytics.png" alt="" width={54} height={54} />
          <span>
            HAS Analytics<small>Pesquisa. Dados. Soluções.</small>
          </span>
        </Link>
        <button
          className="mobile-nav-toggle"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="public-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          id="public-nav"
          className={open ? "is-open" : ""}
          aria-label="Navegação principal"
          onClick={() => setOpen(false)}
        >
          <Link className="section-nav-link" aria-current={current("inicio")} onClick={event => jump(event, "inicio")} href="/#inicio">Início</Link>
          <Link className="section-nav-link" aria-current={current("servicos")} onClick={event => jump(event, "servicos")} href="/#servicos">Soluções</Link>
          <Link className="section-nav-link" aria-current={current("projetos")} onClick={event => jump(event, "projetos")} href={pathname === "/" ? "/#projetos" : "/projetos"}>Projetos</Link>
          <Link className="section-nav-link" aria-current={current("sobre")} onClick={event => jump(event, "sobre")} href="/#sobre">Sobre</Link>
          <Link className="section-nav-link" aria-current={current("cliente")} href="/area-cliente">Área do cliente</Link>
          <Link className="btn primary" aria-current={current("orcamento")} href="/orcamento">
            Solicitar orçamento <ArrowUpRight size={17} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
