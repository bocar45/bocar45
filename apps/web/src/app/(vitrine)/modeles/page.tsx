import Link from "next/link";
import { OCCASIONS, isOccasion } from "@sawwa/catalog";
import { TemplateThumb } from "@/components/template-thumb";
import { listTemplates, type TemplateCard } from "@/lib/templates";

export const metadata = {
  title: "Modèles prêts à personnaliser",
  description: "Mugs photo, t-shirts d'anniversaire, Tabaski, mariages : choisissez un modèle, ajoutez votre photo et votre texte, commandez.",
};

export default async function TemplatesGallery({ searchParams }: { searchParams: Promise<{ occasion?: string; produit?: string }> }) {
  const { occasion, produit } = await searchParams;
  const active = occasion && isOccasion(occasion) ? occasion : undefined;
  let templates: TemplateCard[] | null = null;
  try { templates = await listTemplates({ ...(active ? { occasion: active } : {}), ...(produit ? { product: produit } : {}) }); } catch { templates = null; }
  const query = (o?: string) => {
    const q = new URLSearchParams();
    if (o) q.set("occasion", o);
    if (produit) q.set("produit", produit);
    const s = q.toString();
    return s ? `/modeles?${s}` : "/modeles";
  };
  return (
    <>
      <section className="trame bg-brun text-ivoire">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 pt-14">
          <p className="eyebrow flex items-center gap-3 text-ocre"><span className="losange" aria-hidden="true" /> Modèles</p>
          <h1 className="display text-5xl md:text-7xl">Un modèle, <em>votre photo,</em> c&apos;est prêt.</h1>
          <p className="max-w-2xl text-ivoire/75">Choisissez un modèle, ajoutez votre photo et votre texte, voyez le résultat en 3D, puis commandez. Vous pouvez aussi tout modifier dans le studio.</p>
          <nav aria-label="Occasions" className="flex flex-wrap gap-2">
            <Chip href={query()} on={!active}>Toutes les occasions</Chip>
            {Object.entries(OCCASIONS).map(([k, label]) => <Chip key={k} href={query(k)} on={active === k}>{label}</Chip>)}
          </nav>
          {produit && <p className="text-sm text-ivoire/75">Filtré sur un produit · <Link href={active ? `/modeles?occasion=${active}` : "/modeles"} className="underline">voir tous les produits</Link></p>}
        </div>
      </section>
      <div className="bande" aria-hidden="true" />
      <section className="mx-auto max-w-7xl px-4 py-14">
        {templates === null && <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">Les modèles sont indisponibles pour le moment. Réessayez dans un instant.</p>}
        {templates?.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">
            Pas encore de modèle {active ? `pour « ${OCCASIONS[active]} »` : "ici"}. <Link href="/catalogue" className="underline">Créez le vôtre à partir d&apos;un produit</Link>.
          </p>
        )}
        {templates && templates.length > 0 && (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/studio/${t.product.slug}?modele=${t.slug}`} className="group grid gap-3">
                  <div className="overflow-hidden rounded-[24px] border border-line transition group-hover:-translate-y-1 group-hover:shadow-lg">
                    <TemplateThumb doc={t.document} zones={t.product.zones} urls={t.urls} garmentHex={t.product.colorHex} label={`Aperçu : ${t.title}`} />
                  </div>
                  <div className="grid gap-1">
                    <span className="eyebrow text-terra">{t.occasionLabel} · {t.product.name}</span>
                    <b className="display on-light text-xl group-hover:underline">{t.title}</b>
                    {t.description && <span className="line-clamp-2 text-sm text-muted">{t.description}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
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
