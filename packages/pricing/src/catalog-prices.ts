import { DEFAULT_BREAKPOINTS } from "./grid.ts";
import { PricingError, price } from "./price.ts";
import type { PlatformRuleSet, TechniqueKey, VendorPriceGrid } from "./types.ts";

export interface OfferForPricing {
  readonly grid: VendorPriceGrid;
  readonly minQty: number;
  readonly leadTimeDays: number;
}

export interface CatalogPrice {
  /** TTC unit price at the smallest quantity anyone offers (1 piece when possible), one decoration. */
  readonly fromUnitPrice: number;
  readonly fromQuantity: number;
  /** Lowest TTC unit price per quantity breakpoint, with one decoration. null = not offered. */
  readonly byQuantity: readonly { readonly quantity: number; readonly unitPrice: number | null }[];
  /** Cheapest unit price at any listed quantity (volume pricing), e.g. "dès 3 700 FCFA à partir de 25". */
  readonly bestVolume: { readonly unitPrice: number; readonly quantity: number } | null;
  readonly techniques: readonly TechniqueKey[];
  readonly leadTimeDays: number;
  readonly offerCount: number;
}

/**
 * Public "from" prices for a product, computed with the pricing engine over every active offer.
 * Only public TTC amounts leave this function: no workshop cost, no margin.
 */
export function catalogPrice(offers: readonly OfferForPricing[], rules: PlatformRuleSet, category: string): CatalogPrice | null {
  let from: { unit: number; qty: number } | null = null;
  const best = new Map<number, number>();
  const techniques = new Set<TechniqueKey>();
  let lead = Number.POSITIVE_INFINITY;

  for (const offer of offers) {
    const variantId = Object.keys(offer.grid.blanks)[0];
    if (!variantId) continue;
    let usable = false;
    for (const d of offer.grid.decorations) {
      const quote = (quantity: number) => {
        try {
          return price(
            { category, lines: [{ variantId, quantity }], decorations: [{ zoneKey: d.zoneKey, technique: d.technique, widthMm: d.maxWidthMm, heightMm: d.maxHeightMm }] },
            rules,
            offer.grid,
          ).lines[0]!.unitPrice.amount;
        } catch (e) {
          if (e instanceof PricingError) return null;
          throw e;
        }
      };
      const qty = Math.max(1, offer.minQty, d.minQty ?? 1);
      const unit = quote(qty);
      if (unit === null) continue;
      usable = true;
      techniques.add(d.technique);
      if (!from || qty < from.qty || (qty === from.qty && unit < from.unit)) from = { unit, qty };
      for (const q of DEFAULT_BREAKPOINTS) {
        if (q < qty) continue;
        const u = quote(q);
        if (u !== null && u < (best.get(q) ?? Number.POSITIVE_INFINITY)) best.set(q, u);
      }
    }
    if (usable) lead = Math.min(lead, offer.leadTimeDays);
  }
  if (!from) return null;
  let bestVolume: { unitPrice: number; quantity: number } | null = null;
  for (const [quantity, unitPrice] of best) {
    if (quantity > from.qty && unitPrice < from.unit && (!bestVolume || unitPrice < bestVolume.unitPrice)) bestVolume = { unitPrice, quantity };
  }
  return {
    bestVolume,
    fromUnitPrice: from.unit,
    fromQuantity: from.qty,
    byQuantity: DEFAULT_BREAKPOINTS.map((q) => ({ quantity: q, unitPrice: best.get(q) ?? null })),
    techniques: [...techniques],
    leadTimeDays: lead,
    offerCount: offers.length,
  };
}
