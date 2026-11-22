import "server-only";
import type { Technique } from "@sawwa/catalog";
import { PricingError, price, type PlatformRuleSet, type VendorPriceGrid } from "@sawwa/pricing";
import { isSupabaseConfigured } from "./env";
import { createServiceClient } from "./supabase/server";

export interface StudioZone { key: string; label: string; viewLabel: string; maxWidthMm: number; maxHeightMm: number; techniques: Technique[] }
export interface StudioProduct {
  slug: string;
  name: string;
  categorySlug: string;
  colors: { key: string; hex: string; sizes: string[] }[];
  zones: StudioZone[];
}

const fr = (v: unknown) => (v && typeof v === "object" && "fr" in v ? String((v as { fr: unknown }).fr ?? "") : "");

export async function loadStudioProduct(slug: string): Promise<StudioProduct | null> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data: p, error } = await createServiceClient()
    .from("base_products")
    .select("slug, name, category:categories(slug), variants:base_product_variants(color_key, color_hex, size), views:product_views(id, key, mockup_assets, sort), zones(key, view_id, anchor, max_width_mm, max_height_mm, allowed_techniques)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`Produit indisponible : ${error.message}`);
  if (!p) return null;
  const views = (p.views ?? []) as { id: string; key: string; mockup_assets: { label?: string } | null; sort: number }[];
  const colors = new Map<string, { key: string; hex: string; sizes: string[] }>();
  for (const v of (p.variants ?? []) as { color_key: string; color_hex: string; size: string }[]) {
    const c = colors.get(v.color_key) ?? { key: v.color_key, hex: v.color_hex, sizes: [] };
    c.sizes.push(v.size);
    colors.set(v.color_key, c);
  }
  const zones = ((p.zones ?? []) as { key: string; view_id: string; anchor: { label?: string } | null; max_width_mm: number; max_height_mm: number; allowed_techniques: Technique[] }[])
    .map((z) => {
      const view = views.find((v) => v.id === z.view_id);
      return { key: z.key, label: z.anchor?.label ?? z.key, viewLabel: view?.mockup_assets?.label ?? view?.key ?? "", sort: view?.sort ?? 0, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm, techniques: z.allowed_techniques };
    })
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _s, ...z }) => z);
  return { slug: p.slug, name: fr(p.name), categorySlug: (p.category as unknown as { slug: string } | null)?.slug ?? "default", colors: [...colors.values()], zones };
}

export interface StudioDecoration { zoneKey: string; technique: string; widthMm: number; heightMm: number; colors: number }
export type StudioQuote =
  | { ok: true; unitPrice: number; total: number; quantity: number; leadTimeDays: number; depositDue: number | null; setupFee: number }
  | { ok: false; reason: "not_configured" | "no_offer" | "not_offered" | "min_qty"; message: string };

/**
 * Best public price for a design across active workshop offers. Only public TTC figures leave the server.
 * Input comes from the browser: everything is re-validated against the reference product.
 */
export async function quoteStudio(input: { slug: string; colorKey: string; quantity: number; decorations: StudioDecoration[] }): Promise<StudioQuote> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: "not_configured", message: "Prix indisponible pour le moment." };
  const quantity = Math.floor(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 5000) return { ok: false, reason: "min_qty", message: "Quantité entre 1 et 5 000." };
  const db = createServiceClient();
  const { data: product } = await db
    .from("base_products")
    .select("id, category:categories(slug), variants:base_product_variants(id, color_key), zones(key, max_width_mm, max_height_mm, allowed_techniques)")
    .eq("slug", input.slug).eq("status", "active").maybeSingle();
  if (!product) return { ok: false, reason: "no_offer", message: "Produit introuvable." };
  const zones = (product.zones ?? []) as { key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: string[] }[];
  const decorations = input.decorations.slice(0, 10).filter((d) => {
    const z = zones.find((x) => x.key === d.zoneKey);
    return z && z.allowed_techniques.includes(d.technique) && d.widthMm > 0 && d.heightMm > 0 && d.widthMm <= z.max_width_mm && d.heightMm <= z.max_height_mm;
  }).map((d) => ({ zoneKey: d.zoneKey, technique: d.technique as Technique, widthMm: Math.ceil(d.widthMm), heightMm: Math.ceil(d.heightMm), colors: Math.min(20, Math.max(1, Math.floor(d.colors))) }));
  if (decorations.length === 0) return { ok: false, reason: "not_offered", message: "Ajoutez un élément dans une zone pour voir le prix." };
  const variantIds = ((product.variants ?? []) as { id: string; color_key: string }[]).filter((v) => v.color_key === input.colorKey).map((v) => v.id);

  const [{ data: offers }, { data: rules }] = await Promise.all([
    db.from("vendor_offers").select("min_qty, lead_time_days, vendor:organizations!inner(status), grids:vendor_price_grids(version, grid)")
      .eq("base_product_id", product.id).eq("status", "active").eq("vendor.status", "active"),
    db.from("price_rule_sets").select("rules").eq("status", "active").eq("currency", "XOF").maybeSingle(),
  ]);
  const ruleSet = rules?.rules as PlatformRuleSet | undefined;
  if (!ruleSet || !offers?.length) return { ok: false, reason: "no_offer", message: "Aucun atelier ne propose encore ce produit." };

  let best: Extract<StudioQuote, { ok: true }> | null = null;
  let minQty = Infinity;
  for (const o of offers) {
    const grid = ((o.grids ?? []) as { version: number; grid: VendorPriceGrid }[]).sort((a, b) => b.version - a.version)[0]?.grid;
    const variantId = grid && variantIds.find((id) => id in grid.blanks);
    if (!grid || !variantId) continue;
    minQty = Math.min(minQty, o.min_qty);
    try {
      const q = price({ category: (product.category as unknown as { slug: string } | null)?.slug ?? "default", lines: [{ variantId, quantity }], decorations }, ruleSet, grid);
      if (!best || q.total.amount < best.total) {
        best = { ok: true, unitPrice: q.lines[0]!.unitPrice.amount, total: q.total.amount, quantity, leadTimeDays: o.lead_time_days, depositDue: q.depositDue?.amount ?? null, setupFee: q.setupFee.amount };
      }
    } catch (e) {
      if (!(e instanceof PricingError)) throw e;
    }
  }
  if (best) return best;
  if (quantity < minQty) return { ok: false, reason: "min_qty", message: `Minimum ${minQty} pièces pour ce produit.` };
  return { ok: false, reason: "not_offered", message: "Cette combinaison (taille du marquage, technique ou couleur) n'est proposée par aucun atelier pour l'instant." };
}
