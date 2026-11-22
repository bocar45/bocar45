"use server";

import { revalidatePath } from "next/cache";
import { parseOfferForm, type OfferZone } from "@/lib/offer-form";
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

  // The version number is assigned by the database (only if the grid changed).
  const parsed = parseOfferForm(fd, {
    vendorId: vendor.id,
    version: 0,
    variantIds: ((product.variants ?? []) as { id: string }[]).map((v) => v.id),
    zones: (product.zones ?? []) as OfferZone[],
  });
  if (parsed.errors.length) return { error: parsed.errors.join("\n") };

  // One transaction: offer, variants, capabilities and (if changed) a new grid version — all or nothing.
  const { data, error } = await supabase.rpc("save_vendor_offer", {
    p_vendor: vendor.id, p_product: productId, p_status: parsed.status, p_min_qty: parsed.minQty, p_lead_time: parsed.leadTimeDays,
    p_variant_ids: parsed.variantIds, p_capabilities: parsed.capabilities, p_grid: parsed.grid, p_user: user.id,
  });
  if (error || !data?.[0]) {
    const msg = error?.message ?? "";
    if (msg.includes("larger than zone") || msg.includes("not allowed on zone")) return { error: "Une zone dépasse les dimensions ou la technique prévues par SAWWA." };
    if (error?.code === "42501") return { error: "Votre atelier n'est pas autorisé à modifier cette offre." };
    console.error("save_vendor_offer failed", error);
    return { error: "Enregistrement impossible pour le moment. Rien n'a été modifié ; réessayez." };
  }
  const r = data[0] as { grid_version: number; grid_changed: boolean };
  revalidatePath(`/pro/offres/${productId}`);
  revalidatePath("/pro/offres");
  revalidatePath("/catalogue", "layout");
  revalidatePath("/produits/[slug]", "page");
  return { ok: r.grid_changed ? `Offre enregistrée. Grille de prix version ${r.grid_version}.` : "Offre enregistrée (prix inchangés)." };
}
