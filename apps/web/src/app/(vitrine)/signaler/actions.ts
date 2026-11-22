"use server";

import { getSession, hasPlatformRole, vendorMembership } from "@/lib/auth";
import { TOO_MANY, rateLimit } from "@/lib/rate-limit";
import { isReportReason } from "@/lib/report-reasons";
import { TRY_AGAIN, logError } from "@/lib/log";

/**
 * Report a content to the SAWWA team (E18d). The database checks that the person can see it: a published template,
 * or an order of which they are the customer or the assigned workshop.
 */
export async function reportContent(targetType: "order" | "template", targetId: string, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Connectez-vous pour signaler un contenu." };
  if (!(await rateLimit("reportPerUser", session.user.id))) return { error: TOO_MANY };
  const reason = String(fd.get("reason") ?? "");
  if (!isReportReason(reason)) return { error: "Choisissez un motif." };
  const details = String(fd.get("details") ?? "").trim().slice(0, 1000);
  const vendor = vendorMembership(session.memberships);
  const role = targetType === "order" && vendor ? "vendor" : hasPlatformRole(session.memberships, ["ops", "support"]) ? "staff" : "customer";
  const { error } = await session.supabase.from("content_reports").insert({ target_type: targetType, target_id: targetId, reporter_role: role, reason, details });
  if (error) {
    if (error.code === "42501" || error.code === "23514") return { error: "Ce contenu ne peut pas être signalé depuis votre compte." };
    logError("report_failed", error, { targetType });
    return { error: TRY_AGAIN };
  }
  return { ok: "Merci : l'équipe SAWWA examine votre signalement sous 48 h." };
}
