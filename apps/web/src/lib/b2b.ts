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


/**
 * Price an accepted quote again with exactly the versions it was made with (rule set and workshop grid are immutable
 * once used), adding the delivery chosen at order time. The goods amount is therefore the quoted one, and every
 * figure still comes from packages/pricing (rule 4).
 */
export async function repriceFrozen(productId: string, snapshot: B2bQuoteRow["snapshot"], shipping: number): Promise<Quote | null> {
  const db = createServiceClient();
  const [{ data: rules }, { data: offer }] = await Promise.all([
    db.from("price_rule_sets").select("rules").eq("version", snapshot.ruleSetVersion).eq("currency", "XOF").maybeSingle(),
    db.from("vendor_offers").select("id, grids:vendor_price_grids(version, grid)").eq("vendor_id", snapshot.vendorId).eq("base_product_id", productId).maybeSingle(),
  ]);
  const grid = ((offer?.grids ?? []) as { version: number; grid: VendorPriceGrid }[]).find((g) => g.version === snapshot.vendorGridVersion)?.grid;
  if (!rules || !grid) return null;
  try {
    const { shipping: _s, ...request } = snapshot.request;
    return price({ ...request, ...(shipping ? { shipping: { amount: shipping, currency: "XOF" as const } } : {}) }, rules.rules as PlatformRuleSet, grid);
  } catch (e) {
    if (e instanceof PricingError) return null;
    throw e;
  }
}

