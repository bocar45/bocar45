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
