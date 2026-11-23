import "server-only";
import { logError } from "./log";
import type { Technique } from "@sawwa/catalog";
import { catalogPrice, type CatalogPrice, type PlatformRuleSet, type VendorPriceGrid } from "@sawwa/pricing";
import { isSupabaseConfigured } from "./env";
import { createServiceClient } from "./supabase/server";

export interface PublicCategory { slug: string; name: string; nameEn?: string | undefined }
export interface PublicVariant { colorKey: string; colorHex: string; size: string }
export interface PublicZone { key: string; label: string; maxWidthMm: number; maxHeightMm: number; techniques: Technique[] }
export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  material: string | null;
  weightGsm: number | null;
  category: PublicCategory;
  colors: { key: string; hex: string; sizes: string[] }[];
  zones: PublicZone[];
  /** E24d: English texts when the catalogue team has written them (French otherwise). */
  en?: { name?: string | undefined; description?: string | undefined };
  /** Public TTC prices only — never workshop costs or margins. null = no workshop offers it yet. */
  price: CatalogPrice | null;
}

const en = (v: unknown) => (v && typeof v === "object" && "en" in v && typeof (v as { en: unknown }).en === "string" && (v as { en: string }).en.trim() ? (v as { en: string }).en : undefined);
const fr = (v: unknown) => (v && typeof v === "object" && "fr" in v ? String((v as { fr: unknown }).fr ?? "") : "");

/**
 * Reads the public catalogue with the service role (customers cannot read workshop grids),
 * prices it with the pricing engine, and returns only public data.
 * Returns null while Supabase is not configured.
 */
export async function loadPublicCatalog(opts: { vendorId?: string } = {}): Promise<{ categories: PublicCategory[]; products: PublicProduct[] } | null> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const db = createServiceClient();
  const [cats, prods, offers, rules] = await Promise.all([
    db.from("categories").select("slug, name, sort").eq("status", "active").order("sort"),
    db
      .from("base_products")
      .select("id, slug, name, description, attributes, category:categories(slug, name), variants:base_product_variants(color_key, color_hex, size), zones(key, anchor, max_width_mm, max_height_mm, allowed_techniques)")
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    (() => {
      const q = db
        .from("vendor_offers")
        .select("base_product_id, min_qty, lead_time_days, vendor:organizations!inner(status), grids:vendor_price_grids(version, grid)")
        .eq("status", "active")
        .eq("vendor.status", "active");
      // E25: a white-label storefront prices only with its own workshop's grids.
      return opts.vendorId ? q.eq("vendor_id", opts.vendorId) : q;
    })(),
    db.from("price_rule_sets").select("rules").eq("status", "active").eq("currency", "XOF").maybeSingle(),
  ]);
  for (const r of [cats, prods, offers, rules]) if (r.error) { logError("public_catalog_read_failed", r.error); throw new Error("Catalogue indisponible."); }

  const ruleSet = (rules.data?.rules ?? null) as PlatformRuleSet | null;
  const offersByProduct = new Map<string, { grid: VendorPriceGrid; minQty: number; leadTimeDays: number }[]>();
  for (const o of offers.data ?? []) {
    const latest = ((o.grids ?? []) as { version: number; grid: VendorPriceGrid }[]).sort((a, b) => b.version - a.version)[0];
    if (!latest) continue;
    const list = offersByProduct.get(o.base_product_id) ?? [];
    list.push({ grid: latest.grid, minQty: o.min_qty, leadTimeDays: o.lead_time_days });
    offersByProduct.set(o.base_product_id, list);
  }

  const products: PublicProduct[] = (prods.data ?? []).map((p) => {
    const category = p.category as unknown as { slug: string; name: unknown };
    const attrs = (p.attributes ?? {}) as { material?: string | null; weight_gsm?: number | null };
    const colors = new Map<string, { key: string; hex: string; sizes: string[] }>();
    for (const v of (p.variants ?? []) as { color_key: string; color_hex: string; size: string }[]) {
      const c = colors.get(v.color_key) ?? { key: v.color_key, hex: v.color_hex, sizes: [] };
      c.sizes.push(v.size);
      colors.set(v.color_key, c);
    }
    const offersForProduct = offersByProduct.get(p.id) ?? [];
    return {
      id: p.id,
      slug: p.slug,
      name: fr(p.name),
      description: fr(p.description),
      en: { name: en(p.name), description: en(p.description) },
      material: attrs.material ?? null,
      weightGsm: attrs.weight_gsm ?? null,
      category: { slug: category?.slug ?? "", name: fr(category?.name), nameEn: en(category?.name) },
      colors: [...colors.values()],
      zones: ((p.zones ?? []) as { key: string; anchor: { label?: string } | null; max_width_mm: number; max_height_mm: number; allowed_techniques: Technique[] }[]).map((z) => ({
        key: z.key, label: z.anchor?.label ?? z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm, techniques: z.allowed_techniques,
      })),
      price: ruleSet && offersForProduct.length ? catalogPrice(offersForProduct, ruleSet, category?.slug ?? "default") : null,
    };
  });
  return { categories: (cats.data ?? []).map((c) => ({ slug: c.slug, name: fr(c.name), nameEn: en(c.name) })), products };
}

export const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
