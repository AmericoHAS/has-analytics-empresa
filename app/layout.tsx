import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "HAS Analytics",
  description:
    "Estatística, bioestatística, ciência de dados e soluções digitais.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="site-shell">{children}</div>
      </body>
    </html>
  );
}
