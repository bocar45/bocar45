import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { l, type Lang } from "@/lib/i18n";
import { LangSwitch } from "./lang-switch";

export function SiteHeader({ lang }: { lang: Lang }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivoire/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label={l(lang, "SAWWA, accueil", "SAWWA, home")}>
          <Image src="/brand/symbole.png" alt="" width={52} height={36} priority className="h-9 w-auto" />
          <Image src="/brand/sawwa.png" alt="SAWWA" width={120} height={20} priority className="h-[18px] w-auto" />
        </Link>
        <nav aria-label={l(lang, "Navigation principale", "Main navigation")} className="ml-auto flex items-center gap-1 text-sm font-semibold sm:gap-5">
          <Link href="/catalogue" className="hidden rounded-full px-3 py-2 hover:bg-sable sm:inline-block">{l(lang, "Catalogue", "Catalogue")}</Link>
          <Link href="/modeles" className="hidden rounded-full px-3 py-2 hover:bg-sable sm:inline-block">{l(lang, "Modèles", "Templates")}</Link>
          <Link href="/catalogue#equipes" className="hidden rounded-full px-3 py-2 hover:bg-sable md:inline-block">{l(lang, "Équipes & entreprises", "Teams & companies")}</Link>
          <Link href="/pro" className="hidden rounded-full px-3 py-2 hover:bg-sable lg:inline-block">{l(lang, "Ateliers", "Workshops")}</Link>
          <Suspense fallback={null}><LangSwitch /></Suspense>
          <Link href="/connexion" className="btn btn-brun !px-4 !py-2 text-sm">{l(lang, "Mon compte", "My account")}</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="trame mt-24 bg-brun text-ivoire">
      <div className="bande" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Image src="/brand/sawwa-ivoire.png" alt="SAWWA" width={200} height={33} className="h-7 w-auto" />
          <p className="display text-3xl">{lang === "en" ? <>Give form <em>to ideas.</em></> : <>Donner forme <em>aux idées.</em></>}</p>
          <p className="text-sm text-ivoire/60">{l(lang, "Give Form to Ideas.", "Donner forme aux idées.")}</p>
        </div>
        <FooterCol title={l(lang, "Créer", "Create")} links={[[l(lang, "Catalogue", "Catalogue"), "/catalogue"], [l(lang, "Modèles prêts à personnaliser", "Ready-to-personalise templates"), "/modeles"], [l(lang, "Vêtements", "Clothing"), "/catalogue/vetements"], [l(lang, "Cadeaux photo", "Photo gifts"), "/catalogue/cadeaux-photo"], [l(lang, "Objets", "Objects"), "/catalogue/objets"]]} />
        <FooterCol title={l(lang, "Organisations", "Organisations")} links={[[l(lang, "Équipes & entreprises", "Teams & companies"), "/catalogue#equipes"], [l(lang, "Devenir atelier partenaire", "Become a partner workshop"), "/pro/candidature"], [l(lang, "Espace atelier", "Workshop area"), "/pro"]]} />
        <FooterCol title="SAWWA" links={[[l(lang, "Mon compte", "My account"), "/compte"], [l(lang, "Connexion", "Sign in"), "/connexion"], [l(lang, "Demander un devis", "Request a quote"), "/devis"], [l(lang, "Conditions de vente", "Terms of sale"), "/cgv"], [l(lang, "Confidentialité", "Privacy"), "/confidentialite"], [l(lang, "Mentions légales", "Legal notice"), "/mentions-legales"]]} />
      </div>
      <div className="border-t border-ivoire/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-ivoire/50">{l(lang, "Fabriqué avec des ateliers partenaires à Dakar · Paiement Wave, Orange Money et carte", "Made with partner workshops in Dakar · Pay with Wave, Orange Money and card")}</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="grid content-start gap-3">
      <span className="eyebrow text-ocre">{title}</span>
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="text-ivoire/80 hover:text-ivoire">{label}</Link>
      ))}
    </div>
  );
}
