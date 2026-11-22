import "server-only";
import { bestQuote } from "./quoting";
import { createServiceClient } from "./supabase/server";

export interface Candidate { vendorId: string; name: string; leadTimeDays: number; vendorCost: number | null; margin: number | null }

/** Workshops able to make an order, with their cost for it (from their current grid) and SAWWA's resulting margin. */
export async function candidateVendors(orderId: string): Promise<Candidate[]> {
  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("subtotal, tax, shipping, total, items:order_items(base_product_id, color_key, sizes, quantity, decorations, product:base_products(category:categories(slug)))").eq("id", orderId).single();
  const item = (order?.items as unknown as { base_product_id: string; color_key: string; sizes: Record<string, number>; quantity: number; decorations: never[]; product: { category: { slug: string } | null } }[] | undefined)?.[0];
  if (!order || !item) return [];
  const { data: offers } = await db.from("vendor_offers").select("vendor_id, lead_time_days, vendor:organizations!inner(name, status)").eq("base_product_id", item.base_product_id).eq("status", "active").eq("vendor.status", "active");
  // Net goods revenue (excl. VAT and shipping) locked at order time.
  const goodsNet = order.total > 0 ? Math.round((order.subtotal - 0) * (order.total - order.tax) / order.total) : 0;
  const out: Candidate[] = [];
  for (const o of offers ?? []) {
    const { best } = await bestQuote({
      productId: item.base_product_id, categorySlug: item.product.category?.slug ?? "default", colorKey: item.color_key,
      sizes: item.sizes, quantity: item.quantity, decorations: item.decorations, vendorId: o.vendor_id,
    });
    const cost = best ? best.quote.vendorCost.amount : null;
    out.push({ vendorId: o.vendor_id, name: (o.vendor as unknown as { name: string }).name, leadTimeDays: o.lead_time_days, vendorCost: cost, margin: cost === null ? null : goodsNet - cost });
  }
  return out.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));
}
