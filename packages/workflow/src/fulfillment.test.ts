import { describe, expect, it } from "vitest";
import {
  FULFILLMENT_STATUSES,
  RULES,
  TransitionError,
  canTransition,
  initialFulfillment,
  transition,
  type Actor,
  type FulfillmentEvent,
  type FulfillmentState,
} from "./fulfillment.ts";
import { deriveOrderStatus } from "./order.ts";

const admin: Actor = { role: "admin" };
const vendor: Actor = { role: "vendor", vendorId: "ven_a" };
const otherVendor: Actor = { role: "vendor", vendorId: "ven_b" };
const customer: Actor = { role: "customer" };

function run(steps: [FulfillmentEvent, Actor][], start: FulfillmentState = initialFulfillment()) {
  return steps.reduce((s, [e, a]) => transition(s, e, a).state, start);
}

const happyPath: [FulfillmentEvent, Actor][] = [
  [{ type: "assign", vendorId: "ven_a" }, admin],
  [{ type: "accept" }, vendor],
  [{ type: "approve_proof" }, vendor],
  [{ type: "start_production" }, vendor],
  [{ type: "submit_qc", photoAssetIds: ["ast_1"] }, vendor],
  [{ type: "ship", carrier: "Livreur Dakar", trackingNumber: "DK-0042" }, vendor],
  [{ type: "confirm_delivery" }, customer],
];

describe("fulfillment workflow", () => {
  it("runs the happy path to delivered and credits the vendor at the end", () => {
    let s = initialFulfillment();
    const effects = happyPath.map(([e, a]) => {
      const r = transition(s, e, a);
      s = r.state;
      return r.effects;
    });
    expect(s.status).toBe("delivered");
    expect(s.proofRound).toBe(1);
    expect(effects.at(-1)).toContainEqual({ kind: "credit_vendor_ledger" });
  });

  it("supports a correction round requested by the vendor", () => {
    const s = run([
      [{ type: "assign", vendorId: "ven_a" }, admin],
      [{ type: "accept" }, vendor],
      [{ type: "request_changes", reason: "low_resolution", comment: "Logo flou à 28 cm" }, vendor],
      [{ type: "resubmit_design", designVersionId: "dv_2" }, customer],
      [{ type: "approve_proof" }, vendor],
    ]);
    expect(s.status).toBe("proof_approved");
    expect(s.proofRound).toBe(2);
  });

  it("lets the customer cancel during a correction, with a refund", () => {
    const s = run([
      [{ type: "assign", vendorId: "ven_a" }, admin],
      [{ type: "accept" }, vendor],
      [{ type: "request_changes", reason: "outside_zone", comment: "Dépasse la zone" }, vendor],
    ]);
    const r = transition(s, { type: "cancel", reason: "Je préfère annuler" }, customer);
    expect(r.state.status).toBe("cancelled");
    expect(r.effects).toContainEqual({ kind: "refund", scope: "fulfillment" });
  });

  it("does not let a customer cancel once production is under way", () => {
    const s = run(happyPath.slice(0, 4));
    expect(() => transition(s, { type: "cancel", reason: "x" }, customer)).toThrow(TransitionError);
  });

  it("sends a rejected job back to assignment without a vendor", () => {
    const s = run([[{ type: "assign", vendorId: "ven_a" }, admin]]);
    const r = transition(s, { type: "reject", reason: "capacity", comment: "Machine en panne" }, vendor);
    expect(r.state).toMatchObject({ status: "pending_assignment", vendorId: null });
  });

  it("blocks another vendor from touching the job", () => {
    const s = run([[{ type: "assign", vendorId: "ven_a" }, admin]]);
    expect(() => transition(s, { type: "accept" }, otherVendor)).toThrow(/not assigned to you/);
  });

  it("blocks roles that are not allowed", () => {
    expect(() => transition(initialFulfillment(), { type: "assign", vendorId: "ven_a" }, customer)).toThrow(/cannot assign/);
  });

  it("requires proof data: QC photo, tracking, comments", () => {
    const inProd = run(happyPath.slice(0, 4));
    expect(() => transition(inProd, { type: "submit_qc", photoAssetIds: [] }, vendor)).toThrow(/photo/);
    const qc = run(happyPath.slice(4, 5), inProd);
    expect(() => transition(qc, { type: "ship", carrier: "", trackingNumber: "" }, vendor)).toThrow(/tracking/);
    const review = run(happyPath.slice(0, 2));
    expect(() => transition(review, { type: "request_changes", reason: "other", comment: " " }, vendor)).toThrow(/comment/);
  });

  it("holds and resumes to the exact previous status", () => {
    const s = run(happyPath.slice(0, 4));
    const held = transition(s, { type: "hold", reason: "Litige paiement" }, admin).state;
    expect(held.status).toBe("on_hold");
    expect(transition(held, { type: "resume" }, admin).state.status).toBe("in_production");
  });

  it("never leaves a final status", () => {
    const delivered = run(happyPath);
    for (const type of Object.keys(RULES) as (keyof typeof RULES)[]) {
      for (const actor of [admin, vendor, customer, { role: "system" } as Actor]) {
        expect(canTransition(delivered, type, actor)).toBe(false);
      }
    }
  });

  it("only references known statuses", () => {
    for (const rule of Object.values(RULES)) {
      for (const s of rule.from) expect(FULFILLMENT_STATUSES).toContain(s);
    }
  });
});

describe("order status", () => {
  it("is derived from fulfillments", () => {
    expect(deriveOrderStatus(false, ["pending_assignment"])).toBe("awaiting_payment");
    expect(deriveOrderStatus(true, ["in_production", "proof_review"])).toBe("in_fulfillment");
    expect(deriveOrderStatus(true, ["changes_requested", "shipped"])).toBe("action_required");
    expect(deriveOrderStatus(true, ["shipped", "in_production"])).toBe("partially_shipped");
    expect(deriveOrderStatus(true, ["shipped", "delivered"])).toBe("shipped");
    expect(deriveOrderStatus(true, ["delivered", "cancelled"])).toBe("delivered");
    expect(deriveOrderStatus(true, ["cancelled"])).toBe("cancelled");
  });
});
