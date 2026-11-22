"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isOccasion, slugify } from "@sawwa/catalog";
import { emptyDocument, parseDesign, templateBlockers } from "@sawwa/design";
import { audit } from "@/lib/audit";
import { requirePlatformRole } from "@/lib/auth";
import { str } from "@/lib/form";
import { TRY_AGAIN, logError } from "@/lib/log";

const guard = () => requirePlatformRole(["catalog"], "/admin/modeles");

/** Create a draft template for a product, then open it in the studio. */
export async function createTemplate(fd: FormData) {
  const { supabase, user } = await guard();
  const title = str(fd, "title");
  const occasion = str(fd, "occasion");
  const productId = str(fd, "product_id");
  if (title.length < 2 || title.length > 80) return { error: "Titre : 2 à 80 caractères." };
  if (!isOccasion(occasion)) return { error: "Choisissez une occasion." };
  const { data: product } = await supabase.from("base_products").select("id, slug, variants:base_product_variants(color_key)").eq("id", productId).maybeSingle();
  if (!product) return { error: "Choisissez un produit." };
  const color = (product.variants as { color_key: string }[] | null)?.[0]?.color_key ?? "";
  const base = slugify(title).slice(0, 60) || "modele";
  const slug = `${base}-${randomBytes(3).toString("hex")}`;
  const { data, error } = await supabase.from("templates").insert({
    slug, title, occasion, base_product_id: product.id, description: str(fd, "description").slice(0, 300),
    document: emptyDocument(product.slug, color),
  }).select("id").single();
  if (error) { logError("template_create_failed", error); return { error: TRY_AGAIN }; }
  await audit({ actorUserId: user.id, action: "template.create", entityType: "template", entityId: data.id, after: { slug, title, occasion } });
  redirect(`/studio/${product.slug}?gabarit=${data.id}`);
}

/** Publish, unpublish (back to draft) or archive. Publication re-checks the document (and SQL checks again). */
export async function setTemplateStatus(id: string, status: "draft" | "published" | "archived") {
  const { supabase, user } = await guard();
  if (!["draft", "published", "archived"].includes(status)) return { error: "Statut inconnu." };
  const { data: t } = await supabase.from("templates").select("id, status, document").eq("id", id).maybeSingle();
  if (!t) return { error: "Modèle introuvable." };
  if (status === "published") {
    const parsed = parseDesign(t.document);
    if (!parsed.ok) return { error: "Document du modèle illisible : rouvrez-le dans le studio et enregistrez-le." };
    const blockers = templateBlockers(parsed.value);
    if (blockers.length) return { error: blockers.join(" ") };
  }
  const { error } = await supabase.from("templates").update({ status }).eq("id", id);
  if (error) {
    if (error.code === "23514") return { error: "Publication refusée : le produit doit être en vente et le modèle doit avoir un champ client." };
    logError("template_status_failed", error, { id });
    return { error: TRY_AGAIN };
  }
  await audit({ actorUserId: user.id, action: `template.${status}`, entityType: "template", entityId: id, before: { status: t.status }, after: { status } });
  revalidatePath("/admin/modeles");
  revalidatePath("/modeles");
  return { ok: status === "published" ? "Modèle publié." : status === "draft" ? "Modèle retiré de la galerie." : "Modèle archivé." };
}
