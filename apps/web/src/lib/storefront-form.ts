/** E27: validation of the storefront form (SAWWA Pro). Pure, tested; the database checks again (migration 13). */
export interface StorefrontInput {
  slug: string;
  name: string;
  tagline: string;
  theme: { primary: string; accent: string; onPrimary: string };
  contactPhone: string | null;
  productIds: string[];
  status: "draft" | "active";
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Paths SAWWA could need one day under /b/… or that would confuse customers. */
const RESERVED = new Set(["sawwa", "admin", "pro", "api", "compte", "studio", "catalogue", "boutique", "demo", "test"]);

export function normaliseSlug(raw: string): string {
  return raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
}

/** Readable text colour on a background (WCAG relative luminance). */
export function textOn(hex: string): "#FFFFFF" | "#1C1C1C" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#1C1C1C" : "#FFFFFF";
}

export function parseStorefront(
  raw: { slug: string; name: string; tagline: string; primary: string; accent: string; phone: string; productIds: string[]; status: string },
  offeredProductIds: ReadonlySet<string>,
): { ok: true; value: StorefrontInput } | { ok: false; error: string } {
  const slug = normaliseSlug(raw.slug || raw.name);
  if (slug.length < 3) return { ok: false, error: "Adresse de la boutique : au moins 3 lettres ou chiffres." };
  if (RESERVED.has(slug)) return { ok: false, error: "Cette adresse est réservée, choisissez-en une autre." };
  const name = raw.name.trim();
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Nom de la boutique : entre 2 et 60 caractères." };
  const tagline = raw.tagline.trim();
  if (tagline.length > 140) return { ok: false, error: "Phrase d'accroche : 140 caractères au maximum." };
  if (!HEX.test(raw.primary) || !HEX.test(raw.accent)) return { ok: false, error: "Couleurs : choisissez-les avec le sélecteur." };
  const digits = raw.phone.replace(/[\s.-]/g, "");
  let contactPhone: string | null = null;
  if (digits) {
    const local = digits.replace(/^(\+221|00221|221)/, "");
    if (!/^7[05678][0-9]{7}$|^3[0-9]{8}$/.test(local)) return { ok: false, error: "Téléphone : numéro sénégalais à 9 chiffres (ex. 77 123 45 67)." };
    contactPhone = `+221${local}`;
  }
  const productIds = [...new Set(raw.productIds)];
  if (productIds.some((id) => !UUID.test(id) || !offeredProductIds.has(id))) return { ok: false, error: "Un produit choisi ne fait pas partie de vos offres actives." };
  if (raw.status !== "draft" && raw.status !== "active") return { ok: false, error: "Statut inconnu." };
  if (raw.status === "active" && productIds.length === 0) return { ok: false, error: "Choisissez au moins un produit avant de mettre la boutique en ligne." };
  return {
    ok: true,
    value: { slug, name, tagline, theme: { primary: raw.primary.toUpperCase(), accent: raw.accent.toUpperCase(), onPrimary: textOn(raw.primary) }, contactPhone, productIds, status: raw.status },
  };
}
