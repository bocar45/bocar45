import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/seo";
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
  openGraph: { type: "website", siteName: "SAWWA", locale: "fr_SN", title: "SAWWA — Donner forme aux idées", description: DESCRIPTION, images: [{ url: "/brand/symbole.png", alt: "SAWWA" }] },
  twitter: { card: "summary", title: "SAWWA — Donner forme aux idées", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#2A1A12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
