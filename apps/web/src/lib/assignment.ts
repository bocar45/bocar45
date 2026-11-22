import "server-only";
import { money, splitGross } from "@sawwa/domain";
import { capacityCheck, type CapacityResult, type Closure } from "./capacity";
import { bestQuote } from "./quoting";
import { createServiceClient } from "./supabase/server";

export interface Candidate {
  vendorId: string; name: string; leadTimeDays: number; vendorCost: number | null; margin: number | null;
  /** E21: workload, closures and the date the workshop could finish. */
  capacity: CapacityResult; capacityPerDay: number | null; piecesInProgress: number;
}

const ACTIVE = ["assigned", "proof_review", "changes_requested", "proof_approved", "in_production", "quality_check"];
/** Today in Dakar (UTC+0, no daylight saving). */
const today = () => new Date().toISOString().slice(0, 10);

/** Workshops able to make an order, with their cost for it (from their current grid) and SAWWA's resulting margin. */
export async function candidateVendors(orderId: string): Promise<Candidate[]> {
  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("subtotal, tax, shipping, total, quote_snapshot, items:order_items(base_product_id, color_key, sizes, quantity, decorations, product:base_products(category:categories(slug)))").eq("id", orderId).single();
  const item = (order?.items as unknown as { base_product_id: string; color_key: string; sizes: Record<string, number>; quantity: number; decorations: never[]; product: { category: { slug: string } | null } }[] | undefined)?.[0];
  if (!order || !item) return [];
  const { data: offers } = await db.from("vendor_offers").select("vendor_id, lead_time_days, vendor:organizations!inner(name, status)").eq("base_product_id", item.base_product_id).eq("status", "active").eq("vendor.status", "active");
  // Net goods revenue (excl. VAT and delivery), split like packages/pricing does with the order's rule set VAT rate.
  const ruleVersion = (order.quote_snapshot as { ruleSetVersion?: number } | null)?.ruleSetVersion;
  const { data: rules } = await db.from("price_rule_sets").select("rules").eq("version", ruleVersion ?? -1).maybeSingle();
  const vatBps = (rules?.rules as { vatBps?: number } | undefined)?.vatBps ?? 1800;
  const goodsNet = splitGross(money(order.total - order.shipping, "XOF"), vatBps).net.amount;
  const vendorIds = (offers ?? []).map((o) => o.vendor_id);
  const [{ data: profiles }, { data: closures }, { data: active }] = await Promise.all([
    db.from("vendor_profiles").select("organization_id, capacity_per_day").in("organization_id", vendorIds),
    db.from("vendor_closures").select("vendor_id, starts_on, ends_on, reason").in("vendor_id", vendorIds).gte("ends_on", today()),
    db.from("fulfillments").select("vendor_id, order:orders(items:order_items(quantity))").in("vendor_id", vendorIds).in("status", ACTIVE),
  ]);
  const load = new Map<string, number>();
  for (const f of (active ?? []) as unknown as { vendor_id: string; order: { items: { quantity: number }[] } | null }[]) {
    load.set(f.vendor_id, (load.get(f.vendor_id) ?? 0) + (f.order?.items ?? []).reduce((a, i) => a + i.quantity, 0));
  }
  const out: Candidate[] = [];
  for (const o of offers ?? []) {
    const { best } = await bestQuote({
      productId: item.base_product_id, categorySlug: item.product.category?.slug ?? "default", colorKey: item.color_key,
      sizes: item.sizes, quantity: item.quantity, decorations: item.decorations, vendorId: o.vendor_id,
    });
    const cost = best ? best.quote.vendorCost.amount : null;
    const capacityPerDay = (profiles ?? []).find((p) => p.organization_id === o.vendor_id)?.capacity_per_day ?? null;
    const piecesInProgress = load.get(o.vendor_id) ?? 0;
    const capacity = capacityCheck({
      capacityPerDay, piecesInProgress, quantity: item.quantity, leadTimeDays: o.lead_time_days, today: today(),
      closures: ((closures ?? []) as (Closure & { vendor_id: string })[]).filter((c) => c.vendor_id === o.vendor_id),
    });
    out.push({ vendorId: o.vendor_id, name: (o.vendor as unknown as { name: string }).name, leadTimeDays: o.lead_time_days, vendorCost: cost, margin: cost === null ? null : goodsNet - cost, capacity, capacityPerDay, piecesInProgress });
  }
  // available workshops first (open, able to finish in time), then the best margin
  const rank = (c: Candidate) => (c.vendorCost === null ? 3 : c.capacity.closedToday ? 2 : c.capacity.late ? 1 : 0);
  return out.sort((a, b) => rank(a) - rank(b) || (b.margin ?? -Infinity) - (a.margin ?? -Infinity));
}
