import type { PublicProduct } from "./catalog-public";

/** Public address of the site (canonical URLs, sitemap, Open Graph). Set NEXT_PUBLIC_SITE_URL in production. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  try { return new URL(raw).origin; } catch { return "http://localhost:3000"; }
}

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
