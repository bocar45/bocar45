"use server";

import { revalidatePath } from "next/cache";
import type { VendorPriceGrid } from "@sawwa/pricing";
import { parseOfferForm, sameGrid, type OfferZone } from "@/lib/offer-form";
import { requireActiveVendor } from "@/lib/vendor";

export async function saveOffer(productId: string, fd: FormData) {
  const { supabase, vendor, canManage, user } = await requireActiveVendor(`/pro/offres/${productId}`);
  if (!canManage) return { error: "Seuls le propriétaire ou un gérant de l'atelier peuvent modifier les offres." };

  const { data: product } = await supabase
    .from("base_products")
    .select("id, status, variants:base_product_variants(id), zones(id, key, max_width_mm, max_height_mm, allowed_techniques)")
    .eq("id", productId)
    .single();
  if (!product || product.status !== "active") return { error: "Ce produit n'est plus proposé par SAWWA." };

  const { data: existing } = await supabase
    .from("vendor_offers")
    .select("id, grids:vendor_price_grids(version, grid)")
    .eq("vendor_id", vendor.id)
    .eq("base_product_id", productId)
    .maybeSingle();
  const latest = ((existing?.grids ?? []) as { version: number; grid: VendorPriceGrid }[]).sort((a, b) => b.version - a.version)[0];

  const parsed = parseOfferForm(fd, {
    vendorId: vendor.id,
    version: (latest?.version ?? 0) + 1,
    variantIds: ((product.variants ?? []) as { id: string }[]).map((v) => v.id),
    zones: (product.zones ?? []) as OfferZone[],
  });
  if (parsed.errors.length) return { error: parsed.errors.join("\n") };

  const { data: offer, error: offerError } = await supabase
    .from("vendor_offers")
    .upsert(
      { vendor_id: vendor.id, base_product_id: productId, status: parsed.status, min_qty: parsed.minQty, lead_time_days: parsed.leadTimeDays },
      { onConflict: "vendor_id,base_product_id" },
    )
    .select("id")
    .single();
  if (offerError || !offer) return { error: `Enregistrement impossible : ${offerError?.message}` };

  // Not yet atomic across tables: an RPC will wrap this before orders depend on it (see ROADMAP).
  for (const step of [
    () => supabase.from("vendor_offer_variants").delete().eq("offer_id", offer.id),
    () => supabase.from("vendor_offer_variants").insert(parsed.variantIds.map((variant_id) => ({ offer_id: offer.id, variant_id }))),
    () => supabase.from("vendor_zone_capabilities").delete().eq("offer_id", offer.id),
    () => supabase.from("vendor_zone_capabilities").insert(parsed.capabilities.map((c) => ({ ...c, offer_id: offer.id }))),
  ]) {
    const { error } = await step();
    if (error) return { error: `Enregistrement incomplet : ${error.message}` };
  }

  const unchanged = sameGrid(latest?.grid, parsed.grid);
  if (!unchanged) {
    const { error } = await supabase
      .from("vendor_price_grids")
      .insert({ offer_id: offer.id, version: parsed.grid.version, currency: "XOF", grid: parsed.grid, created_by: user.id });
    if (error) return { error: `Grille de prix non enregistrée : ${error.message}` };
  }
  revalidatePath(`/pro/offres/${productId}`);
  revalidatePath("/pro/offres");
  return { ok: unchanged ? "Offre enregistrée (prix inchangés)." : `Offre enregistrée. Grille de prix version ${parsed.grid.version}.` };
}
