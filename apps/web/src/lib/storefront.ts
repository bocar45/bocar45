import "server-only";
import { loadPublicCatalog, type PublicProduct } from "./catalog-public";
import { isSupabaseConfigured } from "./env";
import { logError } from "./log";
import { createServiceClient } from "./supabase/server";

/** E25 / D30: a white-label storefront of one workshop (SAWWA Business). Public data only. */
export interface Storefront {
  slug: string;
  name: string;
  tagline: string;
  theme: { primary: string; accent: string; onPrimary: string };
  contactPhone: string | null;
  isDemo: boolean;
  products: PublicProduct[];
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function loadStorefront(slug: string): Promise<Storefront | null> {
  if (!SLUG.test(slug) || slug.length > 40) return null;
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data: s, error } = await createServiceClient()
    .from("storefronts")
    .select("slug, name, tagline, theme, contact_phone, product_ids, is_demo, vendor_id, vendor:organizations!inner(status)")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("vendor.status", "active")
    .maybeSingle();
  if (error) { logError("storefront_read_failed", error, { slug }); throw new Error("Boutique indisponible."); }
  if (!s) return null;
  const catalog = await loadPublicCatalog({ vendorId: s.vendor_id });
  const ids = new Set(s.product_ids ?? []);
  const t = (s.theme ?? {}) as Partial<Storefront["theme"]>;
  return {
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    // Colours are checked by the database; checked again here because they end up in a style attribute.
    theme: {
      primary: HEX.test(t.primary ?? "") ? t.primary! : "#1F2A44",
      accent: HEX.test(t.accent ?? "") ? t.accent! : "#C9923E",
      onPrimary: HEX.test(t.onPrimary ?? "") ? t.onPrimary! : "#FFFFFF",
    },
    contactPhone: s.contact_phone,
    isDemo: s.is_demo,
    products: (catalog?.products ?? []).filter((p) => ids.has(p.id) && p.price),
  };
}

/** E27: the shop a studio was opened from, if it is active and sells this product (else null → normal SAWWA studio). */
export async function storefrontForStudio(boutique: string, productSlug: string): Promise<{ vendorId: string; slug: string; name: string; theme: Storefront["theme"] } | null> {
  if (!SLUG.test(boutique) || boutique.length > 40) return null;
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const db = createServiceClient();
  const [{ data: s }, { data: p }] = await Promise.all([
    db.from("storefronts").select("slug, name, theme, product_ids, vendor_id, vendor:organizations!inner(status)")
      .eq("slug", boutique).eq("status", "active").eq("vendor.status", "active").maybeSingle(),
    db.from("base_products").select("id").eq("slug", productSlug).eq("status", "active").maybeSingle(),
  ]);
  if (!s || !p || !(s.product_ids ?? []).includes(p.id)) return null;
  const t = (s.theme ?? {}) as Partial<Storefront["theme"]>;
  return {
    vendorId: s.vendor_id, slug: s.slug, name: s.name,
    theme: { primary: HEX.test(t.primary ?? "") ? t.primary! : "#1F2A44", accent: HEX.test(t.accent ?? "") ? t.accent! : "#C9923E", onPrimary: HEX.test(t.onPrimary ?? "") ? t.onPrimary! : "#FFFFFF" },
  };
}
