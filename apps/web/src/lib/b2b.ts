import "server-only";
import { PricingError, price, type PlatformRuleSet, type PriceRequest, type Quote, type VendorPriceGrid } from "@sawwa/pricing";
import type { DecorationInput } from "./b2b-rules";
import { createServiceClient } from "./supabase/server";
export { fitsQuote, isQuoteValid } from "./b2b-rules";

/** Status labels for quote requests (customer and staff). */
export const REQUEST_STATUS: Record<string, string> = {
  new: "Demande reçue", quoted: "Devis envoyé", ordered: "Commandé", declined: "Déclinée", cancelled: "Annulée",
};
export const QUOTE_VALIDITY_DAYS = 30;

export interface B2bQuoteRow {
  id: string; request_id: string; version: number; base_product_id: string; color_key: string; sizes: Record<string, number> | null;
  quantity: number; decorations: DecorationInput[]; unit_price: number; goods_total: number; setup_fee: number; tax: number;
  deposit_due: number | null; lead_time_days: number; snapshot: { ruleSetVersion: number; vendorId: string; vendorGridVersion: number; request: PriceRequest };
  customer_note: string; valid_until: string; status: string; order_id: string | null;
}


export interface FrozenPricing {
  /** The quote replayed exactly as quoted (+ delivery): its goods amount is the quoted one. */
  frozen: Quote;
  /** The same frozen versions applied to the sizes the customer actually chose (null when identical or not priceable). */
  actual: Quote | null;
  /** Sizes chosen by the customer that the quoted workshop does not make in this colour. */
  missingSizes: string[];
}

/**
 * Price an accepted quote again with exactly the versions it was made with (rule set and workshop grid are immutable
 * once used), adding the delivery chosen at order time. Every figure still comes from packages/pricing (rule 4).
 * When the quote left the sizes free, the customer's real sizes are checked against the quoted workshop and priced
 * too, so the difference with the firm quoted price is recorded rather than hidden.
 */
export async function repriceFrozen(
  productId: string, snapshot: B2bQuoteRow["snapshot"], shipping: number, real?: { colorKey: string; sizes: Record<string, number> },
): Promise<FrozenPricing | null> {
  const db = createServiceClient();
  const [{ data: rules }, { data: offer }, { data: variants }] = await Promise.all([
    db.from("price_rule_sets").select("rules").eq("version", snapshot.ruleSetVersion).eq("currency", "XOF").maybeSingle(),
    db.from("vendor_offers").select("id, grids:vendor_price_grids(version, grid)").eq("vendor_id", snapshot.vendorId).eq("base_product_id", productId).maybeSingle(),
    real ? db.from("base_product_variants").select("id, size").eq("base_product_id", productId).eq("color_key", real.colorKey) : Promise.resolve({ data: [] as { id: string; size: string }[] }),
  ]);
  const grid = ((offer?.grids ?? []) as { version: number; grid: VendorPriceGrid }[]).find((g) => g.version === snapshot.vendorGridVersion)?.grid;
  if (!rules || !grid) return null;
  const ship = shipping ? { shipping: { amount: shipping, currency: "XOF" as const } } : {};
  const { shipping: _s, ...request } = snapshot.request;
  try {
    const frozen = price({ ...request, ...ship }, rules.rules as PlatformRuleSet, grid);
    let actual: Quote | null = null;
    const missingSizes: string[] = [];
    if (real) {
      const lines = Object.entries(real.sizes).filter(([, n]) => n > 0).map(([size, quantity]) => {
        const v = (variants ?? []).find((x) => x.size === size && x.id in grid.blanks);
        if (!v) missingSizes.push(size);
        return { variantId: v?.id ?? "", quantity };
      });
      if (missingSizes.length === 0) {
        try { actual = price({ ...request, lines, ...ship }, rules.rules as PlatformRuleSet, grid); } catch (e) { if (!(e instanceof PricingError)) throw e; }
      }
    }
    return { frozen, actual, missingSizes };
  } catch (e) {
    if (e instanceof PricingError) return null;
    throw e;
  }
}

