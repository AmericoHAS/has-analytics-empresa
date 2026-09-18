import Image from "next/image";
import { publicContact } from "@/lib/public-site";
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-row">
        <div className="brand">
          <Image src="/icone-has.analytics.png" alt="" width={50} height={50} />
          <span>
            HAS Analytics<small>Decisões apoiadas por evidências</small>
          </span>
        </div>
        <div className="footer-network">
          <a
            href="https://financial.hasanalytics.com.br"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/icone-has.financial.png"
              alt=""
              width={44}
              height={44}
            />
            <span>
              HAS Financial<small>Aplicativo financeiro ↗</small>
            </span>
          </a>
          <a
            href={publicContact.profile}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="footer-avatar"
              src={publicContact.photo}
              alt=""
              width={44}
              height={44}
            />
            <span>
              Haward Antunny<small>Perfil pessoal ↗</small>
            </span>
          </a>
        </div>
        <span>© 2026 HAS Analytics · Maringá, Paraná</span>
      </div>
    </footer>
  );
}
