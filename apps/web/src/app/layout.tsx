import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SAWWA", template: "%s · SAWWA" },
  description: "Donner forme aux idées. Créez vos vêtements et objets personnalisés, fabriqués par des ateliers partenaires.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
            <Link href="/" className="text-lg font-extrabold tracking-[0.18em]">
              SAWWA
            </Link>
            <nav className="ml-auto flex items-center gap-5 text-sm text-muted">
              <Link href="/pro">Espace atelier</Link>
              <Link href="/connexion" className="rounded-md bg-action px-3 py-2 font-bold text-on-action">
                Se connecter
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
