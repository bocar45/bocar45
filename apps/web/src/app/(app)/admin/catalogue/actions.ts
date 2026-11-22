"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isHexColor, isTechnique, parseSizes, publishBlockers, slugify, toKey, validateZone } from "@sawwa/catalog";
import { patternZones } from "@sawwa/design";
import { audit } from "@/lib/audit";
import { requirePlatformRole } from "@/lib/auth";
import { int, optStr, str } from "@/lib/form";
import { TRY_AGAIN, logError } from "@/lib/log";

const guard = () => requirePlatformRole(["catalog"], "/admin/catalogue");
const friendly = (msg: string) => {
  if (msg.includes("duplicate key")) return "Cet élément existe déjà.";
  if (msg.includes("foreign key")) return "Impossible : cet élément est utilisé par une offre d'atelier.";
  if (msg.includes("not complete")) return "Le produit n'est pas complet.";
  if (msg.includes("belongs to another product")) return "Cette vue appartient à un autre produit.";
  logError("catalog_write_failed", { message: msg });
  return TRY_AGAIN;
};

export async function createProduct(fd: FormData) {
  const { supabase } = await guard();
  const name = str(fd, "name");
  const categoryId = str(fd, "category_id");
  if (name.length < 3) return { error: "Indiquez un nom d'au moins 3 caractères." };
  if (!categoryId) return { error: "Choisissez une catégorie." };
  const attributes = { material: optStr(fd, "material"), weight_gsm: int(fd, "weight_gsm") };
  if (Number.isNaN(attributes.weight_gsm)) return { error: "Grammage : nombre entier (g/m²)." };
  const { data, error } = await supabase
    .from("base_products")
    .insert({
      category_id: categoryId,
      slug: slugify(str(fd, "slug") || name),
      name: { fr: name },
      description: { fr: str(fd, "description") },
      attributes,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  redirect(`/admin/catalogue/${data.id}`);
}

export async function updateProduct(id: string, fd: FormData) {
  const { supabase } = await guard();
  const name = str(fd, "name");
  if (name.length < 3) return { error: "Indiquez un nom d'au moins 3 caractères." };
  const weight = int(fd, "weight_gsm");
  if (Number.isNaN(weight)) return { error: "Grammage : nombre entier (g/m²)." };
  const { error } = await supabase
    .from("base_products")
    .update({ name: { fr: name }, description: { fr: str(fd, "description") }, attributes: { material: optStr(fd, "material"), weight_gsm: weight } })
    .eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/admin/catalogue/${id}`);
  return { ok: "Enregistré." };
}

export async function setProductStatus(id: string, status: "draft" | "active" | "archived") {
  const { supabase, user } = await guard();
  const { data: p } = await supabase
    .from("base_products")
    .select("status, name, variants:base_product_variants(count), views:product_views(count), zones(id, allowed_techniques)")
    .eq("id", id)
    .single();
  if (!p) return { error: "Produit introuvable." };
  if (status === "active") {
    const zones = (p.zones ?? []) as { allowed_techniques: string[] }[];
    const blockers = publishBlockers({
      name: String((p.name as { fr?: string })?.fr ?? ""),
      variants: (p.variants as unknown as { count: number }[])[0]?.count ?? 0,
      views: (p.views as unknown as { count: number }[])[0]?.count ?? 0,
      zones: zones.length,
      zonesWithoutTechnique: zones.filter((z) => z.allowed_techniques.length === 0).length,
    });
    if (blockers.length) return { error: blockers.join("\n") };
  }
  const { error } = await supabase.from("base_products").update({ status }).eq("id", id);
  if (error) return { error: friendly(error.message) };
  await audit({ actorUserId: user.id, action: `product.${status}`, entityType: "base_product", entityId: id, before: { status: p.status }, after: { status } });
  revalidatePath("/catalogue", "layout");
  revalidatePath("/produits/[slug]", "page");
  revalidatePath(`/admin/catalogue/${id}`);
  return { ok: status === "active" ? "Produit publié." : "Statut mis à jour." };
}

export async function addColor(productId: string, fd: FormData) {
  const { supabase } = await guard();
  const label = str(fd, "color_label");
  const hex = str(fd, "color_hex").toUpperCase();
  const sizes = parseSizes(str(fd, "sizes"));
  if (!label) return { error: "Nommez la couleur (ex. Ivoire)." };
  if (!isHexColor(hex)) return { error: "Code couleur au format #RRGGBB." };
  if (sizes.length === 0) return { error: "Indiquez au moins une taille (ex. S, M, L, XL ou « Unique »)." };
  const rows = sizes.map((size) => ({ base_product_id: productId, color_key: toKey(label), color_hex: hex, size }));
  const { error } = await supabase.from("base_product_variants").upsert(rows, { onConflict: "base_product_id,color_key,size", ignoreDuplicates: true });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/admin/catalogue/${productId}`);
  return { ok: `${label} : ${sizes.join(", ")} ajoutées.` };
}

export async function deleteVariant(productId: string, variantId: string) {
  const { supabase } = await guard();
  const { error } = await supabase.from("base_product_variants").delete().eq("id", variantId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/admin/catalogue/${productId}`);
}

export async function addView(productId: string, fd: FormData) {
  const { supabase } = await guard();
  const label = str(fd, "view_label");
  if (!label) return { error: "Nommez la vue (ex. Devant)." };
  const { error } = await supabase.from("product_views").insert({ base_product_id: productId, key: toKey(label), mockup_assets: { label } });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/admin/catalogue/${productId}`);
  return { ok: "Vue ajoutée." };
}

export async function addZone(productId: string, fd: FormData) {
  const { supabase } = await guard();
  const label = str(fd, "zone_label");
  const zone = {
    key: toKey(label),
    maxWidthMm: int(fd, "max_width_mm") ?? Number.NaN,
    maxHeightMm: int(fd, "max_height_mm") ?? Number.NaN,
    techniques: fd.getAll("techniques").map(String).filter(isTechnique),
  };
  const errors = validateZone(zone);
  if (!label) errors.unshift("Nommez la zone (ex. Poitrine gauche).");
  if (errors.length) return { error: errors.join("\n") };
  const anchorNote = str(fd, "anchor");
  const { error } = await supabase.from("zones").insert({
    base_product_id: productId,
    view_id: str(fd, "view_id"),
    key: zone.key,
    max_width_mm: zone.maxWidthMm,
    max_height_mm: zone.maxHeightMm,
    allowed_techniques: zone.techniques,
    anchor: { label, note: anchorNote || null },
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/admin/catalogue/${productId}`);
  return { ok: "Zone ajoutée." };
}

export async function deleteZone(productId: string, zoneId: string) {
  const { supabase } = await guard();
  const { error } = await supabase.from("zones").delete().eq("id", zoneId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/admin/catalogue/${productId}`);
}

/**
 * E18b: create the cut-and-sew pattern pieces of an all-over product (t-shirt or hoodie, size M) as print zones
 * (sublimation), each with its outline, seam allowance and bleed. Existing pieces are kept.
 */
export async function createPatternPieces(productId: string, fd: FormData) {
  const { supabase, user } = await guard();
  const kind = str(fd, "pattern_kind");
  if (kind !== "tee" && kind !== "hoodie") return { error: "Choisissez le patron (t-shirt ou hoodie)." };
  let { data: view } = await supabase.from("product_views").select("id").eq("base_product_id", productId).eq("key", "patron").maybeSingle();
  if (!view) {
    const { data, error } = await supabase.from("product_views").insert({ base_product_id: productId, key: "patron", mockup_assets: { label: "Patron" } }).select("id").single();
    if (error) return { error: friendly(error.message) };
    view = data;
  }
  const { data: existing } = await supabase.from("zones").select("key").eq("base_product_id", productId);
  const have = new Set((existing ?? []).map((z) => z.key));
  const rows = patternZones(kind).filter((z) => !have.has(z.key)).map((z) => ({
    base_product_id: productId, view_id: view!.id, key: z.key, max_width_mm: z.maxWidthMm, max_height_mm: z.maxHeightMm,
    allowed_techniques: ["sublimation"], anchor: { label: z.label, note: "Pièce de patron, impression intégrale", pattern: z.pattern },
  }));
  if (rows.length === 0) return { ok: "Les pièces existent déjà." };
  const { error } = await supabase.from("zones").insert(rows);
  if (error) return { error: friendly(error.message) };
  await audit({ actorUserId: user.id, action: "catalog.pattern_pieces", entityType: "base_product", entityId: productId, after: { kind, pieces: rows.map((r) => r.key) } });
  revalidatePath(`/admin/catalogue/${productId}`);
  return { ok: `${rows.length} pièces de patron créées (taille M, à vérifier avec l'atelier).` };
}
