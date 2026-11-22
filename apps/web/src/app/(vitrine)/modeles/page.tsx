import { l, occasionLabel } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
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
  const lang = await getLang();
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
          <p className="eyebrow flex items-center gap-3 text-ocre"><span className="losange" aria-hidden="true" /> {l(lang, "Modèles", "Templates")}</p>
          <h1 className="display text-5xl md:text-7xl">{lang === "en" ? <>A template, <em>your photo,</em> it&apos;s ready.</> : <>Un modèle, <em>votre photo,</em> c&apos;est prêt.</>}</h1>
          <p className="max-w-2xl text-ivoire/75">{l(lang, "Choisissez un modèle, ajoutez votre photo et votre texte, voyez le résultat en 3D, puis commandez. Vous pouvez aussi tout modifier dans le studio.", "Pick a template, add your photo and text, see the result in 3D, then order. You can also change everything in the studio.")}</p>
          <nav aria-label={l(lang, "Occasions", "Occasions")} className="flex flex-wrap gap-2">
            <Chip href={query()} on={!active}>{l(lang, "Toutes les occasions", "All occasions")}</Chip>
            {Object.entries(OCCASIONS).map(([k, label]) => <Chip key={k} href={query(k)} on={active === k}>{occasionLabel(k, label, lang)}</Chip>)}
          </nav>
          {produit && <p className="text-sm text-ivoire/75">{l(lang, "Filtré sur un produit", "Filtered on one product")} · <Link href={active ? `/modeles?occasion=${active}` : "/modeles"} className="underline">{l(lang, "voir tous les produits", "see all products")}</Link></p>}
        </div>
      </section>
      <div className="bande" aria-hidden="true" />
      <section className="mx-auto max-w-7xl px-4 py-14">
        {templates === null && <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">{l(lang, "Les modèles sont indisponibles pour le moment. Réessayez dans un instant.", "Templates are unavailable right now. Please try again in a moment.")}</p>}
        {templates?.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">
            {lang === "en" ? `No template ${active ? `for “${occasionLabel(active, OCCASIONS[active], lang)}”` : "here"} yet. ` : `Pas encore de modèle ${active ? `pour « ${OCCASIONS[active]} »` : "ici"}. `}<Link href="/catalogue" className="underline">{l(lang, "Créez le vôtre à partir d'un produit", "Create your own from a product")}</Link>.
          </p>
        )}
        {templates && templates.length > 0 && (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/studio/${t.product.slug}?modele=${t.slug}`} className="group grid gap-3">
                  <div className="overflow-hidden rounded-[24px] border border-line transition group-hover:-translate-y-1 group-hover:shadow-lg">
                    <TemplateThumb doc={t.document} zones={t.product.zones} urls={t.urls} garmentHex={t.product.colorHex} label={`${l(lang, "Aperçu", "Preview")} : ${t.title}`} />
                  </div>
                  <div className="grid gap-1">
                    <span className="eyebrow text-terra">{occasionLabel(t.occasion, t.occasionLabel, lang)} · {t.product.name}</span>
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
