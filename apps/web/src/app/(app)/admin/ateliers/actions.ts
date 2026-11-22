"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { logError } from "@/lib/log";

const DECISIONS = { approve: "active", reject: "rejected", suspend: "suspended" } as const;
export type VendorDecision = keyof typeof DECISIONS;

export async function decideVendor(orgId: string, decision: VendorDecision) {
  const { supabase, user } = await requirePlatformRole(["vendor_manager"], "/admin/ateliers");
  const status = DECISIONS[decision];
  if (!status) throw new Error("Décision inconnue.");

  const { data: before, error: readError } = await supabase.from("organizations").select("id, status").eq("id", orgId).eq("kind", "vendor").single();
  if (readError || !before) throw new Error("Atelier introuvable.");

  const { error } = await supabase.from("organizations").update({ status }).eq("id", orgId);
  if (error) { logError("vendor_decision_failed", error, { orgId }); throw new Error("Mise à jour impossible."); }

  await audit({ actorUserId: user.id, action: `vendor.${decision}`, entityType: "organization", entityId: orgId, before: { status: before.status }, after: { status } });
  revalidatePath("/admin/ateliers");
  revalidatePath("/catalogue", "layout");
  revalidatePath("/produits/[slug]", "page");
}
