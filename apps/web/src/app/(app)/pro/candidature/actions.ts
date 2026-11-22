"use server";

import { redirect } from "next/navigation";
import { requireUser, vendorMembership } from "@/lib/auth";
import { TOO_MANY, rateLimit } from "@/lib/rate-limit";
import { TRY_AGAIN, logError } from "@/lib/log";

export type ApplyState = { error: string | null };

export async function applyAsVendor(_: ApplyState, form: FormData): Promise<ApplyState> {
  const { supabase, memberships, user } = await requireUser("/pro/candidature");
  if (!(await rateLimit("vendorApplyPerUser", user.id))) return { error: TOO_MANY };
  if (vendorMembership(memberships)) redirect("/pro");
  const name = String(form.get("name") ?? "").trim();
  const ninea = String(form.get("ninea") ?? "").trim() || null;
  if (name.length < 2) return { error: "Indiquez le nom de l'atelier." };
  if (ninea && !/^[0-9A-Z]{7,15}$/i.test(ninea.replace(/\s/g, ""))) return { error: "NINEA invalide." };
  const { error } = await supabase.rpc("apply_as_vendor", { p_name: name, p_ninea: ninea });
  if (error) { logError("apply_as_vendor_failed", error, { userId: user.id }); return { error: TRY_AGAIN }; }
  redirect("/pro");
}
