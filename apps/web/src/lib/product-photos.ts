/**
 * Real product photos (demo catalogue). Self-hosted in /public/products so the CSP stays strict.
 * Source: Unsplash, under the Unsplash License (free commercial use, no attribution required; credits kept in
 * public/products/CREDITS.md). They show blank products, not SAWWA prints: the studio renders the customer's design.
 * To be replaced by the workshops' own photos once the pilot starts.
 */
export interface ProductPhoto { src: string; alt: string; altEn: string }

const PHOTOS: { test: RegExp; photo: ProductPhoto }[] = [
  { test: /hood/, photo: { src: "/products/hoodie.jpg", alt: "Sweat à capuche gris porté, vu de dos", altEn: "Grey hoodie worn, back view" } },
  { test: /sweat|pull/, photo: { src: "/products/sweat.jpg", alt: "Pull col rond blanc posé à plat", altEn: "White crew-neck sweatshirt laid flat" } },
  { test: /polo/, photo: { src: "/products/polo.jpg", alt: "Polos piqués pliés en plusieurs couleurs", altEn: "Folded piqué polos in several colours" } },
  { test: /casquette|cap/, photo: { src: "/products/casquette.jpg", alt: "Casquette blanche vierge", altEn: "Blank white cap" } },
  { test: /mug|tasse/, photo: { src: "/products/mug.jpg", alt: "Mug blanc en céramique", altEn: "White ceramic mug" } },
  { test: /tote|sac/, photo: { src: "/products/tote.jpg", alt: "Tote bag en toile vierge", altEn: "Blank canvas tote bag" } },
  { test: /t-?shirt|tee/, photo: { src: "/products/tshirt.jpg", alt: "T-shirt blanc uni porté", altEn: "Plain white T-shirt worn" } },
];

/** Photo for a product slug, or null (the illustration is used instead). */
export function productPhotoFor(slug: string): ProductPhoto | null {
  const s = slug.toLowerCase();
  return PHOTOS.find((p) => p.test.test(s))?.photo ?? null;
}
