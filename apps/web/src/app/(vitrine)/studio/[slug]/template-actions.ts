"use server";

import { revalidatePath } from "next/cache";
import { parseDesign, templateBlockers } from "@sawwa/design";
import { audit } from "@/lib/audit";
import { getSession, hasPlatformRole } from "@/lib/auth";
import { TRY_AGAIN, logError } from "@/lib/log";
import { storageRef } from "@/lib/storage-refs";

/**
 * Save the document of a template edited in the studio (catalogue team only). Its images must already be in the
 * public template bucket. A published template stays published only if it is still complete.
 */
export async function saveTemplate(input: { id: string; slug: string; document: unknown }) {
  const session = await getSession();
  if (!session || !hasPlatformRole(session.memberships, ["catalog"])) return { error: "Réservé à l'équipe catalogue." };
  const { supabase, user } = session;
  const parsed = parseDesign(input.document);
  if (!parsed.ok) return { error: "Modèle illisible. Rechargez le studio." };
  const doc = parsed.value;
  const images = doc.surfaces.flatMap((s) => s.layers).flatMap((l) => (l.type === "image" ? [l.src] : []));
  if (images.some((src) => storageRef(src)?.bucket !== "template-assets")) return { error: "Les images du modèle n'ont pas pu être envoyées. Réessayez." };
  const { data: t } = await supabase.from("templates").select("id, status, product:base_products(slug)").eq("id", String(input.id)).maybeSingle();
  if (!t) return { error: "Modèle introuvable." };
  if ((t.product as unknown as { slug: string } | null)?.slug !== input.slug || doc.product !== input.slug) return { error: "Modèle et produit ne correspondent pas." };
  if (t.status === "published") {
    const blockers = templateBlockers(doc);
    if (blockers.length) return { error: `Modèle publié : ${blockers.join(" ")} Retirez-le d'abord de la galerie pour l'enregistrer incomplet.` };
  }
  const { error } = await supabase.from("templates").update({ document: doc }).eq("id", t.id);
  if (error) { logError("template_save_failed", error, { id: t.id }); return { error: TRY_AGAIN }; }
  await audit({ actorUserId: user.id, action: "template.save", entityType: "template", entityId: t.id });
  revalidatePath("/modeles");
  revalidatePath("/admin/modeles");
  return { ok: true as const };
}
