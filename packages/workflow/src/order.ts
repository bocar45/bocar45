import type { FulfillmentStatus } from "./fulfillment.ts";

export type OrderStatus =
  | "awaiting_payment"
  | "in_fulfillment"
  | "action_required" // the customer must answer a proof
  | "partially_shipped"
  | "shipped"
  | "delivered"
  | "cancelled";

/** The customer-facing order status is derived from its fulfillments, never stored independently. */
export function deriveOrderStatus(paid: boolean, fulfillments: readonly FulfillmentStatus[]): OrderStatus {
  if (!paid) return "awaiting_payment";
  const live = fulfillments.filter((s) => s !== "cancelled");
  if (live.length === 0) return "cancelled";
  if (live.some((s) => s === "changes_requested")) return "action_required";
  if (live.every((s) => s === "delivered")) return "delivered";
  if (live.every((s) => s === "shipped" || s === "delivered")) return "shipped";
  if (live.some((s) => s === "shipped" || s === "delivered")) return "partially_shipped";
  return "in_fulfillment";
}
