"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requirePlatformRole } from "@/lib/auth";
import { int, str } from "@/lib/form";
import { TRY_AGAIN, logError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Decide a dispute (ops, support). The refund amount is recorded for the finance team (paid back by hand until the
 * payment provider is connected, E13). If the workshop is liable, a penalty goes to its ledger in the same transaction.
 */
export async function resolveDispute(id: string, fd: FormData) {
  const { user } = await requirePlatformRole(["ops", "support"], "/admin/litiges");
  const status = str(fd, "status") === "rejected" ? "rejected" : "resolved";
  const resolution = status === "rejected" ? "none" : str(fd, "resolution");
  if (!["reprint", "partial_refund", "full_refund", "none"].includes(resolution)) return { error: "Choisissez une décision." };
  const refund = int(fd, "refund") ?? 0;
  const penalty = int(fd, "penalty") ?? 0;
  if (Number.isNaN(refund) || Number.isNaN(penalty) || refund < 0 || penalty < 0) return { error: "Montants : nombres entiers en FCFA." };
  if (resolution === "partial_refund" && refund <= 0) return { error: "Indiquez le montant du remboursement partiel." };
  const vendorLiable = status === "resolved" && fd.get("vendor_liable") === "on";
  if (status === "rejected" && (refund > 0 || penalty > 0 || fd.get("vendor_liable") === "on")) return { error: "Un litige non retenu n'entraîne ni remboursement ni pénalité." };
  if (resolution !== "partial_refund" && refund > 0) return { error: "Un montant de remboursement ne va qu'avec « Remboursement partiel » (le total est automatique pour « Remboursement total »)." };
  if (!vendorLiable && penalty > 0) return { error: "Une pénalité suppose de cocher « Faute de l'atelier »." };
  if (vendorLiable && penalty <= 0) return { error: "Indiquez la pénalité de l'atelier (ou décochez « faute de l'atelier »)." };
  const note = str(fd, "note").slice(0, 2000);
  if (note.length < 5) return { error: "Expliquez la décision au client (5 caractères au moins)." };
  const { error } = await createServiceClient().rpc("resolve_dispute", {
    p_dispute: id, p_status: status, p_resolution: resolution, p_refund: resolution === "partial_refund" ? refund : null,
    p_vendor_liable: vendorLiable, p_penalty: vendorLiable ? penalty : null, p_note: note, p_actor: user.id,
  });
  if (error) {
    if (error.code === "23514") {
      if (error.message.includes("exceeds")) return { error: "Le remboursement dépasse le montant de la commande." };
      if (error.message.includes("inconsistent")) return { error: "Décision incohérente : vérifiez le remboursement et la pénalité." };
      return { error: "Ce litige est déjà tranché, ou la commande n'a pas d'atelier." };
    }
    logError("dispute_resolve_failed", error, { id });
    return { error: TRY_AGAIN };
  }
  await audit({ actorUserId: user.id, action: `dispute.${status}`, entityType: "dispute", entityId: id, after: { resolution, refund, vendorLiable, penalty, note } });
  revalidatePath("/admin/litiges");
  return { ok: "Décision enregistrée." };
}
