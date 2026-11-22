import Link from "next/link";
import type { PublicCategory, PublicProduct } from "@/lib/catalog-public";
import { ProductCard } from "./product-card";

export function CatalogView({
  title, intro, categories, products, active,
}: { title: React.ReactNode; intro: string; categories: PublicCategory[]; products: PublicProduct[] | null; active?: string }) {
  return (
    <>
      <section className="trame bg-brun text-ivoire">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 pt-14">
          <p className="eyebrow flex items-center gap-3 text-ocre"><span className="losange" aria-hidden="true" /> Catalogue</p>
          <h1 className="display text-5xl md:text-7xl">{title}</h1>
          <p className="max-w-2xl text-ivoire/75">{intro}</p>
          <nav aria-label="Catégories" className="flex flex-wrap gap-2">
            <Chip href="/catalogue" on={!active}>Tout</Chip>
            {categories.map((c) => <Chip key={c.slug} href={`/catalogue/${c.slug}`} on={active === c.slug}>{c.name}</Chip>)}
          </nav>
        </div>
      </section>
      <div className="bande" aria-hidden="true" />
      <section className="mx-auto max-w-7xl px-4 py-14">
        {products === null && (
          <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">Le catalogue est en cours de préparation. Revenez très bientôt.</p>
        )}
        {products?.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">Aucun produit dans cette catégorie pour le moment.</p>
        )}
        {products && products.length > 0 && (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p, i) => <li key={p.id}><ProductCard product={p} index={i} /></li>)}
          </ul>
        )}
      </section>
      <TeamBanner />
    </>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`rounded-full px-4 py-2 text-sm font-bold ${on ? "bg-ivoire text-brun" : "border border-ivoire/30 text-ivoire hover:border-ivoire"}`}>
      {children}
    </Link>
  );
}

function TeamBanner() {
  return (
    <section id="equipes" className="mx-auto max-w-7xl scroll-mt-24 px-4">
      <div className="trame grid gap-6 rounded-[32px] bg-indigo-900 p-10 text-ivoire md:grid-cols-[1.4fr_1fr] md:items-center md:p-14">
        <div className="grid gap-3">
          <p className="eyebrow text-ocre">Équipes · associations · entreprises</p>
          <h2 className="display text-4xl md:text-5xl">Plus vous commandez, <em>moins vous payez.</em></h2>
          <p className="text-ivoire/75">Les prix baissent automatiquement à 10, 25, 50 et 100 pièces, toutes tailles confondues. Chaque fiche produit affiche le prix par quantité.</p>
        </div>
        <ul className="grid gap-3 text-sm">
          {["Un design, toutes les tailles de S à 5XL", "Noms et numéros individuels", "Acompte de 50 % pour les grosses commandes", "Bon à tirer vérifié avant production"].map((t) => (
            <li key={t} className="flex items-center gap-3"><span className="losange" aria-hidden="true" />{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
