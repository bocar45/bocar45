import type { PublicProduct } from "./catalog-public";

let warned = false;

/** Public address of the site (canonical URLs, sitemap, Open Graph). Set NEXT_PUBLIC_SITE_URL in production. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn("NEXT_PUBLIC_SITE_URL n'est pas défini : adresses canoniques et plan du site pointent vers localhost (voir SETUP_SUPABASE_VERCEL.md).");
  }
  try { return new URL(raw).origin; } catch { return "http://localhost:3000"; }
}

/** Open Graph fields shared by every page (Next.js replaces, not merges, a page's `openGraph`). */
export const SHARE = { type: "website" as const, siteName: "SAWWA", locale: "fr_SN", images: [{ url: "/brand/symbole.png", alt: "SAWWA" }] };

/** JSON for a <script type="application/ld+json">: `<` escaped so the content can never close the script tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** schema.org Product with the public « from » price in FCFA (integers, never workshop costs). */
export function productJsonLd(p: PublicProduct, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description || `${p.name} personnalisé, fabriqué à Dakar.`,
    category: p.category.name,
    brand: { "@type": "Brand", name: "SAWWA" },
    url,
    ...(p.material ? { material: p.material } : {}),
    ...(p.price
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "XOF",
            lowPrice: p.price.bestVolume?.unitPrice ?? p.price.fromUnitPrice,
            highPrice: p.price.fromUnitPrice,
            offerCount: p.price.byQuantity.filter((q) => q.unitPrice !== null).length,
            availability: "https://schema.org/MadeToOrder",
            url,
          },
        }
      : {}),
  };
}

export function organizationJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SAWWA",
    slogan: "Donner forme aux idées",
    url: base,
    logo: `${base}/brand/symbole.png`,
    areaServed: "SN",
  };
}

/** Metadata of a published template page: its own canonical address (with ?modele=), title and description. */
export function templateMetadata(t: { slug: string; title: string; description: string; product: { slug: string; name: string } }) {
  const url = `/studio/${t.product.slug}?modele=${encodeURIComponent(t.slug)}`;
  const description = t.description || `${t.title} : ajoutez votre photo et votre texte, voyez le résultat en 3D et commandez. ${t.product.name}, fabriqué à Dakar.`;
  return { title: `${t.title} — ${t.product.name}`, description, alternates: { canonical: url }, openGraph: { ...SHARE, title: `${t.title} · SAWWA`, description, url } };
}
