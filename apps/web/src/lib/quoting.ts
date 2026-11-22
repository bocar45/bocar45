import "server-only";
import type { Technique } from "@sawwa/catalog";
import { PricingError, price, type PlatformRuleSet, type Quote, type VendorPriceGrid } from "@sawwa/pricing";
import { createServiceClient } from "./supabase/server";

export interface DecorationInput { zoneKey: string; technique: string; widthMm: number; heightMm: number; colors: number }
type Zone = { key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: string[] };

/** Keep only decorations that match the reference product (browser input is never trusted). */
export function sanitizeDecorations(input: DecorationInput[], zones: Zone[]) {
  return input.slice(0, 20).filter((d) => {
    const z = zones.find((x) => x.key === d.zoneKey);
    return z && z.allowed_techniques.includes(d.technique) && d.widthMm > 0 && d.heightMm > 0 && d.widthMm <= z.max_width_mm + 1 && d.heightMm <= z.max_height_mm + 1;
  }).map((d) => ({
    zoneKey: d.zoneKey, technique: d.technique as Technique,
    widthMm: Math.ceil(Math.min(d.widthMm, 100000)), heightMm: Math.ceil(Math.min(d.heightMm, 100000)),
    colors: Math.min(20, Math.max(1, Math.floor(d.colors))),
  }));
}

export interface OfferQuote { quote: Quote; vendorId: string; leadTimeDays: number }

/**
 * Price a request against every active offer of a product; return the cheapest for the customer.
 * `lines` are (colorKey, size) pairs resolved to the reference variants.
 */
export async function bestQuote(input: {
  productId: string; categorySlug: string; colorKey: string;
  sizes: Record<string, number> | null; quantity: number;
  decorations: ReturnType<typeof sanitizeDecorations>;
  vendorId?: string;
  shipping?: number;
}): Promise<{ best: OfferQuote | null; minQty: number; reason?: "no_offer" | "not_offered" }> {
  const db = createServiceClient();
  const [{ data: variants }, { data: offers }, { data: rules }] = await Promise.all([
    db.from("base_product_variants").select("id, color_key, size").eq("base_product_id", input.productId).eq("color_key", input.colorKey),
    (() => {
      let q = db.from("vendor_offers").select("vendor_id, min_qty, lead_time_days, vendor:organizations!inner(status), grids:vendor_price_grids(version, grid)")
        .eq("base_product_id", input.productId).eq("status", "active").eq("vendor.status", "active");
      if (input.vendorId) q = q.eq("vendor_id", input.vendorId);
      return q;
    })(),
    db.from("price_rule_sets").select("rules").eq("status", "active").eq("currency", "XOF").maybeSingle(),
  ]);
  const ruleSet = rules?.rules as PlatformRuleSet | undefined;
  if (!ruleSet || !offers?.length) return { best: null, minQty: Infinity, reason: "no_offer" };

  let best: OfferQuote | null = null;
  let minQty = Infinity;
  for (const o of offers) {
    const grid = ((o.grids ?? []) as { version: number; grid: VendorPriceGrid }[]).sort((a, b) => b.version - a.version)[0]?.grid;
    if (!grid) continue;
    minQty = Math.min(minQty, o.min_qty);
    const offered = (variants ?? []).filter((v) => v.id in grid.blanks);
    let lines: { variantId: string; quantity: number }[];
    if (input.sizes) {
      lines = [];
      for (const [size, qty] of Object.entries(input.sizes)) {
        if (qty <= 0) continue;
        const v = offered.find((x) => x.size === size);
        if (!v) { lines = []; break; }
        lines.push({ variantId: v.id, quantity: qty });
      }
    } else {
      lines = offered[0] ? [{ variantId: offered[0].id, quantity: input.quantity }] : [];
    }
    if (lines.length === 0) continue;
    try {
      const quote = price({ category: input.categorySlug, lines, decorations: input.decorations, ...(input.shipping ? { shipping: { amount: input.shipping, currency: "XOF" as const } } : {}) }, ruleSet, grid);
      if (!best || quote.total.amount < best.quote.total.amount) best = { quote, vendorId: o.vendor_id, leadTimeDays: o.lead_time_days };
    } catch (e) {
      if (!(e instanceof PricingError)) throw e;
    }
  }
  return best ? { best, minQty } : { best: null, minQty, reason: "not_offered" };
}
