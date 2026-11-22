/**
 * E20 — operating figures for the team (pure: tested without a database). Amounts are XOF integers (rule 3);
 * this is reporting over figures already computed by packages/pricing and frozen on orders, never a new price.
 */
import { money, splitGross } from "@sawwa/domain";

export interface OrderRow {
  total: number; tax: number; shipping: number; payment_status: string; created_at: string;
  /** VAT rate of the rule set the order was priced with (basis points). */
  vatBps: number;
  fulfillments: { status: string; vendor_cost: number | null; sla_due_at: string | null; proof_round: number }[];
  events: { event: string; at: string }[];
}

export interface Kpis {
  orders: number; paidOrders: number;
  revenue: number; // TTC, paid orders
  revenueExclTax: number; // goods (total − delivery TTC) split with the order's VAT rate, as packages/pricing does
  unassignedPaid: number; // paid orders with no workshop cost yet (margin not final)
  vendorCost: number; // HT, assigned
  grossMargin: number; // revenueExclTax − vendorCost
  marginRate: number | null; // basis points of revenueExclTax
  shipped: number; onTime: number; onTimeRate: number | null; // bps
  lateOpen: number; // active, past SLA
  proofs: number; proofsRefused: number; proofRefusalRate: number | null; // bps
  avgLeadHours: number | null; // order placed → shipped
}

const ACTIVE = new Set(["assigned", "proof_review", "changes_requested", "proof_approved", "in_production", "quality_check"]);
const bps = (num: number, den: number) => (den > 0 ? Math.round((num * 10000) / den) : null);

export function computeKpis(rows: OrderRow[], now = Date.now()): Kpis {
  let revenue = 0, revenueExclTax = 0, vendorCost = 0, paidOrders = 0, unassignedPaid = 0, shipped = 0, onTime = 0, lateOpen = 0, proofs = 0, refused = 0;
  const leads: number[] = [];
  for (const o of rows) {
    const f = o.fulfillments[0];
    if (o.payment_status === "paid") {
      paidOrders++;
      revenue += o.total;
      // same split as packages/pricing (goodsNet): the order's VAT covers goods and delivery, so split the goods alone
      revenueExclTax += splitGross(money(o.total - o.shipping, "XOF"), o.vatBps).net.amount;
      if (f?.vendor_cost == null) unassignedPaid++;
      vendorCost += f?.vendor_cost ?? 0;
    }
    if (!f) continue;
    const shippedAt = o.events.find((e) => e.event === "ship")?.at;
    if (shippedAt) {
      shipped++;
      if (!f.sla_due_at || Date.parse(shippedAt) <= Date.parse(f.sla_due_at)) onTime++;
      leads.push((Date.parse(shippedAt) - Date.parse(o.created_at)) / 3600000);
    } else if (ACTIVE.has(f.status) && f.sla_due_at && Date.parse(f.sla_due_at) < now) lateOpen++;
    const asked = o.events.filter((e) => e.event === "request_changes").length;
    const approved = o.events.filter((e) => e.event === "approve_proof" || e.event === "accept_as_is").length;
    proofs += asked + approved;
    refused += asked;
  }
  const grossMargin = revenueExclTax - vendorCost;
  return {
    orders: rows.length, paidOrders, unassignedPaid, revenue, revenueExclTax, vendorCost, grossMargin, marginRate: bps(grossMargin, revenueExclTax),
    shipped, onTime, onTimeRate: bps(onTime, shipped), lateOpen,
    proofs, proofsRefused: refused, proofRefusalRate: bps(refused, proofs),
    avgLeadHours: leads.length ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null,
  };
}

/** "12,5 %" from basis points. */
export const pct = (v: number | null) => (v === null ? "—" : `${(v / 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
