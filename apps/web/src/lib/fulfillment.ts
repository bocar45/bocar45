import "server-only";
import { TransitionError, transition, type Actor, type FulfillmentEvent, type FulfillmentState, type FulfillmentStatus } from "@sawwa/workflow";
import { createServiceClient } from "./supabase/server";

/**
 * Apply a workflow event to a fulfillment. The state machine (packages/workflow) decides; the database applies it
 * atomically with an optimistic check on the starting status and records the event.
 */
export async function runTransition(
  fulfillmentId: string, event: FulfillmentEvent, actor: Actor & { userId: string },
  extra: Record<string, unknown> = {}, payload: Record<string, unknown> = {},
) {
  const db = createServiceClient();
  const { data: f, error } = await db.from("fulfillments").select("id, status, vendor_id, proof_round, held_from").eq("id", fulfillmentId).single();
  if (error || !f) throw new Error("Ordre de fabrication introuvable.");
  const state: FulfillmentState = {
    status: f.status as FulfillmentStatus, vendorId: f.vendor_id, proofRound: f.proof_round, heldFrom: (f.held_from as FulfillmentStatus | null) ?? null,
  };
  let result;
  try {
    result = transition(state, event, actor);
  } catch (e) {
    if (e instanceof TransitionError) return { error: TRANSITION_MESSAGES[e.code] ?? e.message };
    throw e;
  }
  const sla = result.effects.find((x) => x.kind === "start_sla");
  const { error: rpcError } = await db.rpc("apply_fulfillment_transition", {
    p_id: fulfillmentId, p_from: state.status, p_state: result.state, p_event: event.type,
    p_actor: actor.userId, p_role: actor.role,
    p_payload: { ...payload, ...("reason" in event ? { reason: event.reason } : {}), ...("comment" in event ? { comment: event.comment } : {}) },
    p_extra: { ...extra, ...(sla && sla.kind === "start_sla" ? { sla_hours: sla.hours } : {}) },
  });
  if (rpcError) return { error: rpcError.message.includes("conflict") ? "Cette commande vient d'être modifiée par quelqu'un d'autre. Rechargez la page." : rpcError.message };
  // Effects: notifications go through the notification module (WhatsApp/SMS/e-mail) once a provider is configured;
  // refunds are handled by finance for the pilot (the event history shows what is due).
  return { ok: true as const, effects: result.effects };
}

const TRANSITION_MESSAGES: Record<string, string> = {
  FORBIDDEN_ROLE: "Vous n'avez pas le droit de faire cette action.",
  WRONG_VENDOR: "Cette commande n'est pas affectée à votre atelier.",
  INVALID_FROM_STATUS: "Cette action n'est plus possible à cette étape.",
  MISSING_DATA: "Informations manquantes pour cette étape.",
};

export const STATUS_LABEL: Record<string, string> = {
  pending_assignment: "En attente d'un atelier",
  assigned: "Affectée à l'atelier",
  proof_review: "BAT en cours de vérification",
  changes_requested: "Correction demandée",
  proof_approved: "BAT validé",
  in_production: "En production",
  quality_check: "Contrôle qualité",
  shipped: "Expédiée",
  delivered: "Livrée",
  rejected_by_vendor: "Refusée par l'atelier",
  on_hold: "En pause",
  cancelled: "Annulée",
};

export const EVENT_LABEL: Record<string, string> = {
  order_placed: "Commande passée",
  payment_confirmed: "Paiement confirmé",
  assign: "Affectée à un atelier",
  accept: "L'atelier a pris la commande",
  approve_proof: "BAT validé par l'atelier",
  request_changes: "Correction demandée",
  resubmit_design: "Création corrigée renvoyée",
  accept_as_is: "Production acceptée telle quelle",
  reject: "Refusée par l'atelier",
  start_production: "Production lancée",
  submit_qc: "Photo de contrôle envoyée",
  ship: "Expédiée",
  confirm_delivery: "Livrée",
  hold: "Mise en pause",
  resume: "Reprise",
  cancel: "Annulée",
};
