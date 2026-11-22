"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const DECISIONS = { approve: "active", reject: "rejected", suspend: "suspended" } as const;
export type VendorDecision = keyof typeof DECISIONS;

export async function decideVendor(orgId: string, decision: VendorDecision) {
  const { supabase, user } = await requirePlatformRole(["vendor_manager"], "/admin/ateliers");
  const status = DECISIONS[decision];
  if (!status) throw new Error("Décision inconnue.");

  const { data: before, error: readError } = await supabase.from("organizations").select("id, status").eq("id", orgId).eq("kind", "vendor").single();
  if (readError || !before) throw new Error("Atelier introuvable.");

  const { error } = await supabase.from("organizations").update({ status }).eq("id", orgId);
  if (error) throw new Error(`Mise à jour impossible : ${error.message}`);

  const { error: auditError } = await createServiceClient().from("audit_log").insert({
    actor_user_id: user.id,
    action: `vendor.${decision}`,
    entity_type: "organization",
    entity_id: orgId,
    before: { status: before.status },
    after: { status },
  });
  if (auditError) throw new Error(`Journal d'audit indisponible : ${auditError.message}`);
  revalidatePath("/admin/ateliers");
}
