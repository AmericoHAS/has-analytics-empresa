"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
export function Header() {
  const [open, setOpen] = useState(false);
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
          <Link href="/">Início</Link>
          <Link href="/#servicos">Soluções</Link>
          <Link href="/projetos">Projetos</Link>
          <Link href="/area-cliente">Área do cliente</Link>
          <Link className="btn primary" href="/orcamento">
            Solicitar orçamento <ArrowUpRight size={17} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
