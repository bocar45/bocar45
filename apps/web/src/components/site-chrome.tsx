import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivoire/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="SAWWA, accueil">
          <Image src="/brand/symbole.png" alt="" width={52} height={36} priority className="h-9 w-auto" />
          <Image src="/brand/sawwa.png" alt="SAWWA" width={120} height={20} priority className="h-[18px] w-auto" />
        </Link>
        <nav aria-label="Navigation principale" className="ml-auto flex items-center gap-1 text-sm font-semibold sm:gap-5">
          <Link href="/catalogue" className="hidden rounded-full px-3 py-2 hover:bg-sable sm:inline-block">Catalogue</Link>
          <Link href="/modeles" className="hidden rounded-full px-3 py-2 hover:bg-sable sm:inline-block">Modèles</Link>
          <Link href="/catalogue#equipes" className="hidden rounded-full px-3 py-2 hover:bg-sable md:inline-block">Équipes &amp; entreprises</Link>
          <Link href="/pro" className="hidden rounded-full px-3 py-2 hover:bg-sable lg:inline-block">Ateliers</Link>
          <Link href="/connexion" className="btn btn-brun !px-4 !py-2 text-sm">Mon compte</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="trame mt-24 bg-brun text-ivoire">
      <div className="bande" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Image src="/brand/sawwa-ivoire.png" alt="SAWWA" width={200} height={33} className="h-7 w-auto" />
          <p className="display text-3xl">Donner forme <em>aux idées.</em></p>
          <p className="text-sm text-ivoire/60">Give Form to Ideas.</p>
        </div>
        <FooterCol title="Créer" links={[["Catalogue", "/catalogue"], ["Modèles prêts à personnaliser", "/modeles"], ["Vêtements", "/catalogue/vetements"], ["Cadeaux photo", "/catalogue/cadeaux-photo"], ["Objets", "/catalogue/objets"]]} />
        <FooterCol title="Organisations" links={[["Équipes & entreprises", "/catalogue#equipes"], ["Devenir atelier partenaire", "/pro/candidature"], ["Espace atelier", "/pro"]]} />
        <FooterCol title="SAWWA" links={[["Mon compte", "/compte"], ["Connexion", "/connexion"]]} />
      </div>
      <div className="border-t border-ivoire/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-ivoire/50">Fabriqué avec des ateliers partenaires à Dakar · Paiement Wave, Orange Money et carte</p>
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
