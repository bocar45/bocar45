import Link from "next/link";
import { notFound } from "next/navigation";
import { jsonLd, productJsonLd, siteUrl } from "@/lib/seo";
import { TECHNIQUE_LABEL } from "@sawwa/catalog";
import { artKindFor } from "@/components/product-art";
import { ProductShowcase } from "@/components/product-showcase";
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
    openGraph: { type: "website", title: `${product.name} · SAWWA`, description, url: `/produits/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product } = await findProduct(slug);
  if (!product) notFound();
  const p = product.price;

  return (
    <>
    {/* E24c: structured data for search engines (public price range, never workshop costs) */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(product, `${siteUrl()}/produits/${product.slug}`)) }} />
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-muted">
        <Link href="/catalogue" className="underline">Catalogue</Link> <span aria-hidden="true">/</span>{" "}
        <Link href={`/catalogue/${product.category.slug}`} className="underline">{product.category.name}</Link>
      </nav>
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="self-start lg:sticky lg:top-24">
          <ProductShowcase kind={artKindFor(`${product.slug} ${product.category.slug}`)} colors={product.colors} name={product.name} />
        </div>

        <div className="grid content-start gap-8">
          <div className="grid gap-3">
            <p className="eyebrow flex items-center gap-3 text-terra"><span className="losange" aria-hidden="true" />{product.category.name}</p>
            <h1 className="display on-light text-5xl md:text-6xl">{product.name}</h1>
            {product.description && <p className="text-lg text-muted">{product.description}</p>}
            <p className="text-sm text-muted">{[product.material, product.weightGsm ? `${product.weightGsm} g/m²` : null].filter(Boolean).join(" · ")}</p>
          </div>

          {p ? (
            <div className="grid gap-4 rounded-[24px] bg-brun p-6 text-ivoire">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm text-ivoire/70">dès</span>
                <span className="display text-5xl">{fcfa(p.fromUnitPrice)}</span>
                <span className="text-sm text-ivoire/70">TTC / pièce{p.fromQuantity > 1 ? `, min. ${p.fromQuantity} pc` : ""}, un marquage inclus</span>
              </div>
              <table className="w-full text-sm">
                <caption className="sr-only">Prix par pièce selon la quantité</caption>
                <thead><tr className="text-left text-xs uppercase tracking-wider text-ivoire/60"><th className="py-2">Quantité</th><th className="py-2 text-right">Prix par pièce</th></tr></thead>
                <tbody>
                  {p.byQuantity.filter((r) => r.unitPrice !== null).map((r) => (
                    <tr key={r.quantity} className="border-t border-ivoire/10">
                      <td className="py-2">{r.quantity === 1 ? "1 pièce" : `${r.quantity} pièces et plus`}</td>
                      <td className="py-2 text-right font-bold tabular-nums">{fcfa(r.unitPrice!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="flex items-center gap-2 text-sm text-ivoire/80"><span className="losange" aria-hidden="true" /> Fabriqué en {p.leadTimeDays} jour{p.leadTimeDays > 1 ? "s" : ""} ouvré{p.leadTimeDays > 1 ? "s" : ""} après validation du BAT</p>
            </div>
          ) : (
            <p className="rounded-[24px] border-2 border-dashed border-line p-6 text-muted">Ce produit arrive bientôt : nos ateliers partenaires finalisent leurs offres.</p>
          )}

          <div className="grid gap-3">
            <h2 className="text-lg font-bold">Où personnaliser</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {product.zones.map((z) => (
                <li key={z.key} className="grid gap-1 rounded-xl border border-line bg-surface p-4">
                  <b>{z.label}</b>
                  <span className="text-sm text-muted tabular-nums">jusqu&apos;à {z.maxWidthMm / 10} × {z.maxHeightMm / 10} cm</span>
                  <span className="text-xs text-muted">{z.techniques.map((t) => TECHNIQUE_LABEL[t]).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-[24px] bg-terra p-5 text-ivoire">
            <div className="grid flex-1 gap-1">
              <b className="display text-2xl">Créez le vôtre</b>
              <span className="text-sm text-ivoire/85">Texte, logo, photos : placez-les au millimètre, vérifiez la fabrication et voyez le prix en direct.</span>
            </div>
            <Link href={`/studio/${product.slug}`} className="btn btn-brun">Personnaliser dans le studio →</Link>
          </div>
          <Link href={`/modeles?produit=${product.slug}`} className="text-sm font-semibold underline">Pas d&apos;idée ? Partez d&apos;un modèle prêt à personnaliser →</Link>
        </div>
      </div>
    </div>
    </>
  );
}
