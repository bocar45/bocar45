"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requirePlatformRole } from "@/lib/auth";
import { int, str } from "@/lib/form";
import { TRY_AGAIN, logError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/server";

/** Record a payout to a workshop (finance). Never more than its balance (checked in the same SQL transaction). */
export async function recordPayout(vendorId: string, fd: FormData) {
  const { user } = await requirePlatformRole(["finance"], "/admin/finances");
  const amount = int(fd, "amount");
  const method = str(fd, "method");
  const reference = str(fd, "reference").slice(0, 120);
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { error: "Montant : nombre entier de FCFA." };
  if (!["wave", "orange_money", "virement", "especes"].includes(method)) return { error: "Choisissez le moyen de versement." };
  if (reference.length < 3) return { error: "Indiquez la référence de la transaction (Wave, Orange Money, virement…)." };
  const { error } = await createServiceClient().rpc("record_payout", { p_vendor: vendorId, p_amount: amount, p_method: method, p_reference: reference, p_actor: user.id });
  if (error) {
    if (error.code === "23514") return { error: "Le montant dépasse le solde dû à l'atelier." };
    logError("payout_failed", error, { vendorId });
    return { error: TRY_AGAIN };
  }
  await audit({ actorUserId: user.id, action: "payout.record", entityType: "organization", entityId: vendorId, after: { amount, method, reference } });
  revalidatePath("/admin/finances");
  revalidatePath(`/admin/finances/${vendorId}`);
  return { ok: `Versement de ${amount.toLocaleString("fr-FR")} FCFA enregistré.` };
}

/** Manual adjustment (finance), signed amount, always justified. */
export async function recordAdjustment(vendorId: string, fd: FormData) {
  const { supabase, user } = await requirePlatformRole(["finance"], "/admin/finances");
  const amount = int(fd, "amount");
  const note = str(fd, "note").slice(0, 500);
  if (amount === null || Number.isNaN(amount) || amount === 0) return { error: "Montant : entier non nul (négatif pour une retenue)." };
  if (note.length < 5) return { error: "Justifiez l'ajustement." };
  const { error } = await supabase.from("vendor_ledger").insert({ vendor_id: vendorId, type: "adjustment", amount, note, created_by: user.id });
  if (error) { logError("adjustment_failed", error, { vendorId }); return { error: TRY_AGAIN }; }
  await audit({ actorUserId: user.id, action: "ledger.adjust", entityType: "organization", entityId: vendorId, after: { amount, note } });
  revalidatePath(`/admin/finances/${vendorId}`);
  return { ok: "Ajustement enregistré." };
}
