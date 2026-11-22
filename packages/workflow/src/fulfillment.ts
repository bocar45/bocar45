/**
 * Fulfillment (ordre de fabrication) state machine — one per vendor per order.
 * Pure: given a state and an event, returns the next state and the side effects to run.
 * Every status change in the app goes through `transition()`.
 */

export const FULFILLMENT_STATUSES = [
  "pending_assignment",
  "assigned",
  "proof_review",
  "changes_requested",
  "proof_approved",
  "in_production",
  "quality_check",
  "shipped",
  "delivered",
  "rejected_by_vendor",
  "on_hold",
  "cancelled",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export type ActorRole = "customer" | "vendor" | "admin" | "system";

export type RejectReason = "low_resolution" | "outside_zone" | "too_many_colors" | "too_fine" | "file_format" | "capacity" | "other";

export type FulfillmentEvent =
  | { type: "assign"; vendorId: string }
  | { type: "accept" }
  | { type: "approve_proof" }
  | { type: "request_changes"; reason: RejectReason; comment: string }
  | { type: "resubmit_design"; designVersionId: string }
  | { type: "accept_as_is" }
  | { type: "reject"; reason: RejectReason; comment: string }
  | { type: "start_production" }
  | { type: "submit_qc"; photoAssetIds: readonly string[] }
  | { type: "ship"; carrier: string; trackingNumber: string }
  | { type: "confirm_delivery" }
  | { type: "hold"; reason: string }
  | { type: "resume" }
  | { type: "cancel"; reason: string };

export type EventType = FulfillmentEvent["type"];

export interface FulfillmentState {
  readonly status: FulfillmentStatus;
  readonly vendorId: string | null;
  readonly proofRound: number;
  /** Status to return to after `resume`. */
  readonly heldFrom: FulfillmentStatus | null;
}

export type Effect =
  | { kind: "notify"; to: "customer" | "vendor" | "admin"; template: string }
  | { kind: "refund"; scope: "fulfillment" }
  | { kind: "start_sla"; hours: number }
  | { kind: "credit_vendor_ledger" };

export interface Actor {
  readonly role: ActorRole;
  /** For vendors: which vendor they act for. Checked against the fulfillment. */
  readonly vendorId?: string;
}

interface Rule {
  readonly from: readonly FulfillmentStatus[];
  readonly to: FulfillmentStatus | "previous";
  readonly roles: readonly ActorRole[];
  readonly effects: readonly Effect[];
}

const FINAL: readonly FulfillmentStatus[] = ["delivered", "cancelled"];
const ACTIVE = FULFILLMENT_STATUSES.filter((s) => !FINAL.includes(s) && s !== "on_hold");
const CANCELLABLE = ACTIVE.filter((s) => s !== "shipped");

export const RULES: Readonly<Record<EventType, Rule>> = {
  assign: {
    from: ["pending_assignment"],
    to: "assigned",
    roles: ["admin", "system"],
    effects: [{ kind: "notify", to: "vendor", template: "fulfillment.assigned" }, { kind: "start_sla", hours: 24 }],
  },
  accept: { from: ["assigned"], to: "proof_review", roles: ["vendor"], effects: [] },
  approve_proof: {
    from: ["proof_review"],
    to: "proof_approved",
    roles: ["vendor"],
    effects: [{ kind: "notify", to: "customer", template: "proof.approved" }],
  },
  request_changes: {
    from: ["proof_review"],
    to: "changes_requested",
    roles: ["vendor", "admin"],
    effects: [{ kind: "notify", to: "customer", template: "proof.changes_requested" }, { kind: "start_sla", hours: 72 }],
  },
  resubmit_design: {
    from: ["changes_requested"],
    to: "proof_review",
    roles: ["customer", "admin"],
    effects: [{ kind: "notify", to: "vendor", template: "proof.resubmitted" }, { kind: "start_sla", hours: 24 }],
  },
  accept_as_is: {
    // Customer accepts the vendor's remark (e.g. slightly soft image) and asks to produce anyway.
    from: ["changes_requested"],
    to: "proof_approved",
    roles: ["customer"],
    effects: [{ kind: "notify", to: "vendor", template: "proof.accepted_as_is" }],
  },
  reject: {
    from: ["assigned", "proof_review"],
    to: "rejected_by_vendor",
    roles: ["vendor"],
    effects: [{ kind: "notify", to: "admin", template: "fulfillment.rejected" }],
  },
  start_production: { from: ["proof_approved"], to: "in_production", roles: ["vendor"], effects: [] },
  submit_qc: {
    from: ["in_production"],
    to: "quality_check",
    roles: ["vendor"],
    effects: [{ kind: "notify", to: "admin", template: "fulfillment.qc_submitted" }],
  },
  ship: {
    from: ["quality_check"],
    to: "shipped",
    roles: ["vendor", "admin"],
    effects: [{ kind: "notify", to: "customer", template: "fulfillment.shipped" }],
  },
  confirm_delivery: {
    from: ["shipped"],
    to: "delivered",
    roles: ["customer", "admin", "system"],
    effects: [{ kind: "notify", to: "customer", template: "fulfillment.delivered" }, { kind: "credit_vendor_ledger" }],
  },
  hold: { from: ACTIVE, to: "on_hold", roles: ["admin"], effects: [{ kind: "notify", to: "vendor", template: "fulfillment.on_hold" }] },
  resume: { from: ["on_hold"], to: "previous", roles: ["admin"], effects: [{ kind: "notify", to: "vendor", template: "fulfillment.resumed" }] },
  cancel: {
    from: [...CANCELLABLE, "on_hold"],
    to: "cancelled",
    roles: ["admin", "customer"],
    effects: [
      { kind: "refund", scope: "fulfillment" },
      { kind: "notify", to: "customer", template: "fulfillment.cancelled" },
      { kind: "notify", to: "vendor", template: "fulfillment.cancelled" },
    ],
  },
};

export class TransitionError extends Error {
  override readonly name = "TransitionError";
  constructor(
    readonly code: "FORBIDDEN_ROLE" | "WRONG_VENDOR" | "INVALID_FROM_STATUS" | "MISSING_DATA",
    message: string,
  ) {
    super(message);
  }
}

export const initialFulfillment = (): FulfillmentState => ({
  status: "pending_assignment",
  vendorId: null,
  proofRound: 0,
  heldFrom: null,
});

function validatePayload(event: FulfillmentEvent): void {
  const missing = (what: string) => new TransitionError("MISSING_DATA", `${event.type}: ${what} is required`);
  switch (event.type) {
    case "request_changes":
    case "reject":
      if (!event.comment.trim()) throw missing("a comment");
      break;
    case "submit_qc":
      if (event.photoAssetIds.length === 0) throw missing("a quality-control photo");
      break;
    case "ship":
      if (!event.carrier.trim() || !event.trackingNumber.trim()) throw missing("carrier and tracking number");
      break;
    case "assign":
      if (!event.vendorId) throw missing("a vendor");
      break;
    case "hold":
    case "cancel":
      if (!event.reason.trim()) throw missing("a reason");
      break;
  }
}

export interface TransitionResult {
  readonly state: FulfillmentState;
  readonly effects: readonly Effect[];
  readonly from: FulfillmentStatus;
  readonly to: FulfillmentStatus;
}

export function canTransition(state: FulfillmentState, type: EventType, actor: Actor): boolean {
  const rule = RULES[type];
  return rule.from.includes(state.status) && rule.roles.includes(actor.role);
}

export function transition(state: FulfillmentState, event: FulfillmentEvent, actor: Actor): TransitionResult {
  const rule = RULES[event.type];
  if (!rule.roles.includes(actor.role)) {
    throw new TransitionError("FORBIDDEN_ROLE", `${actor.role} cannot ${event.type}`);
  }
  if (actor.role === "vendor" && (actor.vendorId === undefined || actor.vendorId !== state.vendorId)) {
    throw new TransitionError("WRONG_VENDOR", "this fulfillment is not assigned to you");
  }
  if (!rule.from.includes(state.status)) {
    throw new TransitionError("INVALID_FROM_STATUS", `cannot ${event.type} from ${state.status}`);
  }
  // A customer may only cancel while the design is waiting for their changes.
  if (event.type === "cancel" && actor.role === "customer" && state.status !== "changes_requested") {
    throw new TransitionError("INVALID_FROM_STATUS", "customers can only cancel while changes are requested");
  }
  validatePayload(event);

  let to: FulfillmentStatus;
  if (rule.to === "previous") {
    if (!state.heldFrom) throw new TransitionError("INVALID_FROM_STATUS", "nothing to resume");
    to = state.heldFrom;
  } else {
    to = rule.to;
  }

  const next: FulfillmentState = {
    status: to,
    vendorId: event.type === "assign" ? event.vendorId : state.status === "rejected_by_vendor" ? null : state.vendorId,
    proofRound: event.type === "accept" || event.type === "resubmit_design" ? state.proofRound + 1 : state.proofRound,
    heldFrom: event.type === "hold" ? state.status : event.type === "resume" ? null : state.heldFrom,
  };

  // A vendor rejection sends the job back to assignment automatically.
  if (to === "rejected_by_vendor") {
    return {
      from: state.status,
      to: "pending_assignment",
      state: { ...next, status: "pending_assignment", vendorId: null },
      effects: rule.effects,
    };
  }

  return { from: state.status, to, state: next, effects: rule.effects };
}
