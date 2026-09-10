import Image from "next/image";
import Link from "next/link";

export function Header(){return <header className="header"><div className="container header-row"><Link className="brand" href="/"><Image src="/icone-has.analytics.png" alt="HAS Analytics" width={54} height={54}/><span>HAS Analytics<small>Estatística · Bioestatística · Ciência de Dados</small></span></Link><nav><Link href="/">Início</Link><Link href="/projetos">Projetos</Link><Link href="/#servicos">Serviços</Link><Link href="/area-cliente">Área do cliente</Link><Link className="btn primary" href="/login">Entrar</Link></nav></div></header>}
