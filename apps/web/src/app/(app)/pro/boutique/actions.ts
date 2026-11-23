"use server";

import { revalidatePath } from "next/cache";
import { str } from "@/lib/form";
import { TRY_AGAIN, logError } from "@/lib/log";
import { parseStorefront } from "@/lib/storefront-form";
import { requireActiveVendor } from "@/lib/vendor";

/** E27: create or update the workshop's storefront. Role checked here; RLS and triggers check again (migration 13). */
export async function saveStorefront(fd: FormData) {
  const { supabase, vendor, canManage } = await requireActiveVendor("/pro/boutique");
  if (!canManage) return { error: "Réservé au propriétaire et aux gérants." };

  const [{ data: offers, error: offersError }, { data: existing }] = await Promise.all([
    supabase.from("vendor_offers").select("base_product_id").eq("vendor_id", vendor.id).eq("status", "active"),
    supabase.from("storefronts").select("id, slug").eq("vendor_id", vendor.id).order("created_at").limit(1).maybeSingle(),
  ]);
  if (offersError) { logError("storefront_offers_read_failed", offersError, { vendorId: vendor.id }); return { error: TRY_AGAIN }; }

  const parsed = parseStorefront(
    { slug: str(fd, "slug"), name: str(fd, "name"), tagline: str(fd, "tagline"), primary: str(fd, "primary"), accent: str(fd, "accent"),
      phone: str(fd, "phone"), productIds: fd.getAll("products").map(String), status: str(fd, "status") },
    new Set((offers ?? []).map((o) => o.base_product_id as string)),
  );
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;
  const row = { slug: v.slug, name: v.name, tagline: v.tagline, theme: v.theme, contact_phone: v.contactPhone, product_ids: v.productIds, status: v.status };

  const { error } = existing
    ? await supabase.from("storefronts").update(row).eq("id", existing.id).eq("vendor_id", vendor.id)
    : await supabase.from("storefronts").insert({ ...row, vendor_id: vendor.id });
  if (error) {
    if (error.code === "23505") return { error: "Cette adresse est déjà prise par une autre boutique." };
    logError("storefront_save_failed", error, { vendorId: vendor.id });
    return { error: TRY_AGAIN };
  }
  revalidatePath("/pro/boutique");
  revalidatePath(`/b/${v.slug}`);
  if (existing && existing.slug !== v.slug) revalidatePath(`/b/${existing.slug}`);
  return { ok: v.status === "active" ? `Boutique en ligne : /b/${v.slug}` : "Brouillon enregistré (la boutique n'est pas visible du public)." };
}
