import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * E24a: workshop amounts per order, read through the `fulfillment_costs` view (SAWWA team, workshop owner and
 * managers only; the column itself is not readable through the API). Batched to keep URLs short.
 */
export async function vendorCostsByOrder(client: SupabaseClient, orderIds: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  for (let i = 0; i < orderIds.length; i += 150) {
    const { data, error } = await client.from("fulfillment_costs").select("order_id, vendor_cost").in("order_id", orderIds.slice(i, i + 150));
    if (error) throw error;
    for (const r of data ?? []) out.set(r.order_id as string, (r.vendor_cost as number | null) ?? null);
  }
  return out;
}
