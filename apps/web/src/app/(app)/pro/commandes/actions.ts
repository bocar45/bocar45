"use server";

import { revalidatePath } from "next/cache";
import type { FulfillmentEvent, RejectReason } from "@sawwa/workflow";
import { requireUser, vendorMembership } from "@/lib/auth";
import { runTransition } from "@/lib/fulfillment";
import { str } from "@/lib/form";

const REASONS: RejectReason[] = ["low_resolution", "outside_zone", "too_many_colors", "too_fine", "file_format", "capacity", "trademark", "protected_character", "prohibited_content", "other"];
type Kind = "accept" | "reject" | "approve_proof" | "request_changes" | "start_production" | "submit_qc" | "ship";

export async function vendorEvent(fulfillmentId: string, kind: Kind, fd: FormData) {
  const { user, memberships } = await requireUser(`/pro/commandes/${fulfillmentId}`);
  const vendor = vendorMembership(memberships);
  if (!vendor || vendor.organization.status !== "active") return { error: "Atelier non actif." };
  const reason = (REASONS as string[]).includes(str(fd, "reason")) ? (str(fd, "reason") as RejectReason) : "other";
  const comment = str(fd, "comment").slice(0, 1000);
  let event: FulfillmentEvent;
  const extra: Record<string, unknown> = {};
  switch (kind) {
    case "reject": event = { type: "reject", reason, comment }; break;
    case "request_changes": event = { type: "request_changes", reason, comment }; break;
    case "submit_qc": {
      const photos = fd.getAll("photos").map(String).filter((p) => p.startsWith(`${vendor.organization.id}/${fulfillmentId}/`));
      event = { type: "submit_qc", photoAssetIds: photos };
      extra.qc_photos = photos;
      break;
    }
    case "ship": {
      const carrier = str(fd, "carrier").slice(0, 80);
      const tracking = str(fd, "tracking").slice(0, 80);
      event = { type: "ship", carrier, trackingNumber: tracking };
      Object.assign(extra, { carrier, tracking_number: tracking });
      break;
    }
    default: event = { type: kind };
  }
  const r = await runTransition(fulfillmentId, event, { role: "vendor", vendorId: vendor.organization.id, userId: user.id }, extra);
  if ("error" in r) return { error: r.error };
  revalidatePath(`/pro/commandes/${fulfillmentId}`);
  revalidatePath("/pro/commandes");
  return { ok: "Enregistré." };
}
