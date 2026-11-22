import { describe, expect, it } from "vitest";
import { computeKpis, pct, type OrderRow } from "./dashboard";

const now = Date.parse("2026-11-22T12:00:00Z");
const order = (o: Partial<OrderRow> & { f?: Partial<OrderRow["fulfillments"][number]>; ev?: [string, string][] }): OrderRow => ({
  total: 11800, tax: 1800, shipping: 0, payment_status: "paid", created_at: "2026-11-10T08:00:00Z",
  fulfillments: [{ status: "delivered", vendor_cost: 6000, sla_due_at: "2026-11-14T08:00:00Z", proof_round: 0, ...o.f }],
  events: (o.ev ?? []).map(([event, at]) => ({ event, at })), ...o,
});

describe("dashboard figures (E20)", () => {
  it("sums revenue, revenue excl. tax and shipping, workshop cost and margin of paid orders", () => {
    const k = computeKpis([order({}), order({ total: 13800, tax: 1800, shipping: 2000 }), order({ payment_status: "awaiting_payment" })], now);
    expect(k).toMatchObject({ orders: 3, paidOrders: 2, revenue: 25600, revenueExclTax: 20000, vendorCost: 12000, grossMargin: 8000, marginRate: 4000 });
    expect(pct(k.marginRate)).toBe("40 %");
  });
  it("measures delays: shipped on time, late active orders, average lead time", () => {
    const k = computeKpis([
      order({ ev: [["ship", "2026-11-13T08:00:00Z"]] }), // 72 h, on time
      order({ ev: [["ship", "2026-11-15T08:00:00Z"]] }), // late
      order({ f: { status: "in_production", sla_due_at: "2026-11-20T00:00:00Z" } }), // active, past SLA
      order({ f: { status: "in_production", sla_due_at: "2026-11-30T00:00:00Z" } }),
    ], now);
    expect(k).toMatchObject({ shipped: 2, onTime: 1, onTimeRate: 5000, lateOpen: 1, avgLeadHours: 96 });
  });
  it("computes the proof refusal rate over all proof decisions", () => {
    const k = computeKpis([
      order({ ev: [["request_changes", "2026-11-11T00:00:00Z"], ["approve_proof", "2026-11-12T00:00:00Z"]] }),
      order({ ev: [["approve_proof", "2026-11-11T00:00:00Z"]] }),
      order({ ev: [["accept_as_is", "2026-11-11T00:00:00Z"]] }),
    ], now);
    expect(k).toMatchObject({ proofs: 4, proofsRefused: 1, proofRefusalRate: 2500 });
    expect(computeKpis([], now).proofRefusalRate).toBeNull();
  });
});
