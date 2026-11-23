import { categoryName, fcfaIn, l, productDescription, productName, techniqueLabel } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SHARE, jsonLd, productJsonLd, siteUrl } from "@/lib/seo";
import { TECHNIQUE_LABEL } from "@sawwa/catalog";
import { artKindFor } from "@/components/product-art";
import { ProductShowcase } from "@/components/product-showcase";
import { productPhotoFor } from "@/lib/product-photos";
import { fcfa, loadPublicCatalog } from "@/lib/catalog-public";

export const revalidate = 600;
// Pages are generated on first visit, then cached and refreshed every 10 minutes or when admins change data.
export function generateStaticParams() {
  return [];
}

async function findProduct(slug: string) {
  const data = await loadPublicCatalog();
  return { data, product: data?.products.find((p) => p.slug === slug) ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product } = await findProduct(slug);
  if (!product) return { title: "Produit" };
  const description = product.price ? `${product.name} personnalisé dès ${fcfa(product.price.fromUnitPrice)}. Fabriqué à Dakar.` : product.description;
  return {
    title: product.name, description,
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: { ...SHARE, title: `${product.name} · SAWWA`, description, url: `/produits/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product } = await findProduct(slug);
  if (!product) notFound();
  const p = product.price;
  const lang = await getLang();
  const name = productName(product, lang), description = productDescription(product, lang), category = categoryName(product.category, lang);

  return (
    <>
    {/* E24c: structured data for search engines (public price range, never workshop costs) */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(product, `${siteUrl()}/produits/${product.slug}`)) }} />
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav aria-label={l(lang, "Fil d'Ariane", "Breadcrumb")} className="mb-6 text-sm text-muted">
        <Link href="/catalogue" className="underline">{l(lang, "Catalogue", "Catalogue")}</Link> <span aria-hidden="true">/</span>{" "}
        <Link href={`/catalogue/${product.category.slug}`} className="underline">{category}</Link>
      </nav>
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="self-start lg:sticky lg:top-24">
          <ProductShowcase kind={artKindFor(`${product.slug} ${product.category.slug}`)} colors={product.colors} name={name} photo={productPhotoFor(`${product.slug} ${product.category.slug}`)} />
        </div>

        <div className="grid content-start gap-8">
          <div className="grid gap-3">
            <p className="eyebrow flex items-center gap-3 text-terra"><span className="losange" aria-hidden="true" />{category}</p>
            <h1 className="display on-light text-5xl md:text-6xl">{name}</h1>
            {description && <p className="text-lg text-muted">{description}</p>}
            <p className="text-sm text-muted">{[product.material, product.weightGsm ? `${product.weightGsm} g/m²` : null].filter(Boolean).join(" · ")}</p>
          </div>

          {p ? (
            <div className="grid gap-4 rounded-[24px] bg-brun p-6 text-ivoire">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm text-ivoire/70">{l(lang, "dès", "from")}</span>
                <span className="display text-5xl">{fcfaIn(lang, p.fromUnitPrice)}</span>
                <span className="text-sm text-ivoire/70">{lang === "en" ? `incl. VAT / piece${p.fromQuantity > 1 ? `, min. ${p.fromQuantity} pcs` : ""}, one print included` : `TTC / pièce${p.fromQuantity > 1 ? `, min. ${p.fromQuantity} pc` : ""}, un marquage inclus`}</span>
              </div>
              <table className="w-full text-sm">
                <caption className="sr-only">{l(lang, "Prix par pièce selon la quantité", "Price per piece by quantity")}</caption>
                <thead><tr className="text-left text-xs uppercase tracking-wider text-ivoire/60"><th className="py-2">{l(lang, "Quantité", "Quantity")}</th><th className="py-2 text-right">{l(lang, "Prix par pièce", "Price per piece")}</th></tr></thead>
                <tbody>
                  {p.byQuantity.filter((r) => r.unitPrice !== null).map((r) => (
                    <tr key={r.quantity} className="border-t border-ivoire/10">
                      <td className="py-2">{r.quantity === 1 ? l(lang, "1 pièce", "1 piece") : lang === "en" ? `${r.quantity} pieces or more` : `${r.quantity} pièces et plus`}</td>
                      <td className="py-2 text-right font-bold tabular-nums">{fcfaIn(lang, r.unitPrice!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="flex items-center gap-2 text-sm text-ivoire/80"><span className="losange" aria-hidden="true" /> {lang === "en" ? `Made in ${p.leadTimeDays} working day${p.leadTimeDays > 1 ? "s" : ""} after proof approval` : `Fabriqué en ${p.leadTimeDays} jour${p.leadTimeDays > 1 ? "s" : ""} ouvré${p.leadTimeDays > 1 ? "s" : ""} après validation du BAT`}</p>
            </div>
          ) : (
            <p className="rounded-[24px] border-2 border-dashed border-line p-6 text-muted">{l(lang, "Ce produit arrive bientôt : nos ateliers partenaires finalisent leurs offres.", "This product is coming soon: our partner workshops are finalising their offers.")}</p>
          )}

          <div className="grid gap-3">
            <h2 className="text-lg font-bold">{l(lang, "Où personnaliser", "Where to personalise")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {product.zones.map((z) => (
                <li key={z.key} className="grid gap-1 rounded-xl border border-line bg-surface p-4">
                  <b>{z.label}</b>
                  <span className="text-sm text-muted tabular-nums">{l(lang, "jusqu'à", "up to")} {z.maxWidthMm / 10} × {z.maxHeightMm / 10} cm</span>
                  <span className="text-xs text-muted">{z.techniques.map((t) => techniqueLabel(t, TECHNIQUE_LABEL[t], lang)).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-[24px] bg-terra p-5 text-ivoire">
            <div className="grid flex-1 gap-1">
              <b className="display text-2xl">{l(lang, "Créez le vôtre", "Make your own")}</b>
              <span className="text-sm text-ivoire/85">{l(lang, "Texte, logo, photos : placez-les au millimètre, vérifiez la fabrication et voyez le prix en direct.", "Text, logo, photos: place them to the millimetre, check production and see the price live.")}</span>
            </div>
            <Link href={`/studio/${product.slug}`} className="btn btn-brun">{l(lang, "Personnaliser dans le studio →", "Personalise in the studio →")}</Link>
          </div>
          <Link href={`/modeles?produit=${product.slug}`} className="text-sm font-semibold underline">{l(lang, "Pas d'idée ? Partez d'un modèle prêt à personnaliser →", "No idea? Start from a ready-to-personalise template →")}</Link>
        </div>
      </div>
    </div>
    </>
  );
}
