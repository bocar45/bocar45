import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type PlatformRole = "super_admin" | "ops" | "catalog" | "vendor_manager" | "support" | "finance";
export type OrgKind = "customer_org" | "vendor" | "platform";
export type OrgStatus = "pending" | "active" | "suspended" | "rejected";

export interface Membership {
  role: string;
  organization: { id: string; kind: OrgKind; status: OrgStatus; name: string };
}

/** The signed-in user and their memberships, read through RLS. */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organization:organizations(id, kind, status, name)")
    .eq("user_id", user.id);
  if (error) throw new Error(`Lecture des rôles impossible : ${error.message}`);
  const memberships = (data ?? []) as unknown as Membership[];
  return { user, memberships, supabase };
}

export async function requireUser(next: string) {
  const session = await getSession();
  if (!session) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  return session;
}

export function platformRoles(memberships: Membership[]): PlatformRole[] {
  return memberships.filter((m) => m.organization?.kind === "platform").map((m) => m.role as PlatformRole);
}

export function hasPlatformRole(memberships: Membership[], roles: PlatformRole[]): boolean {
  const mine = platformRoles(memberships);
  return mine.includes("super_admin") || mine.some((r) => roles.includes(r));
}

/** Server-side guard: the UI hides links, this is what actually protects the page. */
export async function requirePlatformRole(roles: PlatformRole[], next: string) {
  const session = await requireUser(next);
  if (!hasPlatformRole(session.memberships, roles)) redirect("/acces-refuse");
  return session;
}

export function vendorMembership(memberships: Membership[]): Membership | undefined {
  return memberships.find((m) => m.organization?.kind === "vendor");
}
