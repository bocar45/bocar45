"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requirePlatformRole } from "@/lib/auth";
import { runTransition } from "@/lib/fulfillment";
import { str } from "@/lib/form";
import { candidateVendors } from "@/lib/assignment";
import { createServiceClient } from "@/lib/supabase/server";
import { TRY_AGAIN, logError } from "@/lib/log";

const refresh = (orderId: string) => { revalidatePath(`/admin/commandes/${orderId}`); revalidatePath("/admin/commandes"); };

export async function confirmPayment(orderId: string, fd: FormData) {
  const { user } = await requirePlatformRole(["finance"], `/admin/commandes/${orderId}`);
  const reference = str(fd, "reference");
  if (reference.length < 3) return { error: "Indiquez la référence du paiement (n° de transaction Wave/Orange Money ou virement)." };
  const { error } = await createServiceClient().rpc("mark_order_paid", { p_order: orderId, p_actor: user.id, p_reference: reference });
  if (error) {
    if (error.message.includes("not awaiting")) return { error: "Cette commande n'attend plus de paiement." };
    logError("mark_order_paid_failed", error, { orderId });
    return { error: TRY_AGAIN };
  }
  await audit({ actorUserId: user.id, action: "order.payment_confirmed", entityType: "order", entityId: orderId, after: { reference } });
  refresh(orderId);
  return { ok: "Paiement confirmé. La commande peut être affectée à un atelier." };
}

export async function assignVendor(orderId: string, fulfillmentId: string, vendorId: string) {
  const { user } = await requirePlatformRole(["ops"], `/admin/commandes/${orderId}`);
  const { data: order } = await createServiceClient().from("orders").select("payment_status").eq("id", orderId).single();
  if (order?.payment_status !== "paid") return { error: "Le paiement doit être confirmé avant l'affectation." };
  const candidate = (await candidateVendors(orderId)).find((c) => c.vendorId === vendorId);
  if (!candidate || candidate.vendorCost === null) return { error: "Cet atelier ne peut pas fabriquer cette commande." };
  const r = await runTransition(fulfillmentId, { type: "assign", vendorId }, { role: "admin", userId: user.id }, { vendor_cost: candidate.vendorCost }, { vendor: candidate.name });
  if ("error" in r) return { error: r.error };
  await audit({ actorUserId: user.id, action: "fulfillment.assign", entityType: "fulfillment", entityId: fulfillmentId, after: { vendorId, vendorCost: candidate.vendorCost } });
  refresh(orderId);
  return { ok: `Commande affectée à ${candidate.name}. L'atelier a 24 h pour la prendre en charge.` };
}

export async function adminEvent(orderId: string, fulfillmentId: string, kind: "hold" | "resume" | "cancel" | "confirm_delivery", fd: FormData) {
  const { user } = await requirePlatformRole(["ops"], `/admin/commandes/${orderId}`);
  const reason = str(fd, "reason");
  const event = kind === "hold" ? { type: "hold" as const, reason } : kind === "cancel" ? { type: "cancel" as const, reason } : kind === "resume" ? { type: "resume" as const } : { type: "confirm_delivery" as const };
  const r = await runTransition(fulfillmentId, event, { role: "admin", userId: user.id });
  if ("error" in r) return { error: kind === "hold" || kind === "cancel" ? `${r.error} (un motif est obligatoire)` : r.error };
  await audit({ actorUserId: user.id, action: `fulfillment.${kind}`, entityType: "fulfillment", entityId: fulfillmentId, after: { reason: reason || null } });
  refresh(orderId);
  return { ok: "Fait." };
}
