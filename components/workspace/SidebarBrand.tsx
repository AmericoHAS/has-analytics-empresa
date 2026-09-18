import Image from "next/image";
import Link from "next/link";
export default function SidebarBrand({admin=false}:{admin?:boolean}){return <Link href="/" className="sidebar-brand" aria-label="HAS Analytics — página inicial"><Image src="/icone-has.analytics.png" alt="" width={54} height={54}/><span>HAS Analytics<small>{admin?"Administração":"Área do cliente"}</small></span></Link>}
