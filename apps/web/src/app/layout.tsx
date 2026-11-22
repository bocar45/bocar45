import type { Metadata, Viewport } from "next";
import { SHARE, siteUrl } from "@/lib/seo";
import { getLang } from "@/lib/lang";
import { LangProvider } from "@/components/lang-context";
import { Fraunces, Manrope } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

const DESCRIPTION = "Créez vos vêtements et objets personnalisés : brodés, imprimés et livrés par des ateliers partenaires à Dakar.";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "SAWWA — Donner forme aux idées", template: "%s · SAWWA" },
  description: DESCRIPTION,
  icons: { icon: "/brand/symbole.png" },
  alternates: { canonical: "./" },
  openGraph: { ...SHARE, title: "SAWWA — Donner forme aux idées", description: DESCRIPTION },
  twitter: { card: "summary", title: "SAWWA — Donner forme aux idées", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#2A1A12" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <LangProvider value={lang}>
          <SiteHeader lang={lang} />
          <main>{children}</main>
          <SiteFooter lang={lang} />
        </LangProvider>
      </body>
    </html>
  );
}
