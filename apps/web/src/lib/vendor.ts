import "server-only";
import { redirect } from "next/navigation";
import { requireUser, vendorMembership } from "./auth";

/** Signed-in member of an ACTIVE workshop, allowed to manage offers (owner or manager). */
export async function requireActiveVendor(next: string) {
  const session = await requireUser(next);
  const m = vendorMembership(session.memberships);
  if (!m) redirect("/pro");
  if (m.organization.status !== "active") redirect("/pro");
  return { ...session, vendor: m.organization, role: m.role as "owner" | "manager" | "operator", canManage: m.role === "owner" || m.role === "manager" };
}
