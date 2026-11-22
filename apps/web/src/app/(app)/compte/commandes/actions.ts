"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { runTransition } from "@/lib/fulfillment";

/** Customer answers a correction request: produce anyway, or cancel (refund handled by SAWWA). */
export async function answerCorrection(fulfillmentId: string, choice: "accept_as_is" | "cancel") {
  const { supabase, user } = await requireUser("/compte/commandes");
  // RLS: the customer can only read fulfillments of their own orders.
  const { data: f } = await supabase.from("fulfillments").select("id, order_id").eq("id", fulfillmentId).maybeSingle();
  if (!f) return { error: "Commande introuvable." };
  const r = choice === "accept_as_is"
    ? await runTransition(fulfillmentId, { type: "accept_as_is" }, { role: "customer", userId: user.id })
    : await runTransition(fulfillmentId, { type: "cancel", reason: "Annulation par le client après demande de correction" }, { role: "customer", userId: user.id });
  if ("error" in r) return { error: r.error };
  revalidatePath(`/compte/commandes/${f.order_id}`);
  return { ok: choice === "accept_as_is" ? "C'est noté : l'atelier lance la production." : "Commande annulée. SAWWA vous contacte pour le remboursement." };
}

/** E20: the customer reports a problem on a shipped or delivered order (database checks ownership and photos). */
export async function openDispute(orderId: string, input: { reason: string; description: string; photos: string[] }) {
  const { supabase, user } = await requireUser(`/compte/commandes/${orderId}`);
  const reasons = ["defect", "wrong_item", "not_received", "late", "other"];
  if (!reasons.includes(input.reason)) return { error: "Choisissez le problème rencontré." };
  const description = String(input.description ?? "").trim().slice(0, 2000);
  if (description.length < 5) return { error: "Décrivez le problème en quelques mots." };
  const photos = (input.photos ?? []).filter((p) => typeof p === "string" && p.startsWith(`${user.id}/`) && !p.includes("..")).slice(0, 6);
  const { error } = await supabase.from("disputes").insert({ order_id: orderId, reason: input.reason, description, photos });
  if (error) {
    if (error.code === "23514") return { error: "Un litige ne peut être ouvert qu'une fois la commande expédiée." };
    return { error: "Votre signalement n'a pas pu être enregistré. Réessayez dans un instant." };
  }
  revalidatePath(`/compte/commandes/${orderId}`);
  return { ok: "C'est noté : l'équipe SAWWA vous répond sous 48 h." };
}
