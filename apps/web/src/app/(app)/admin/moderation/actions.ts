"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requirePlatformRole } from "@/lib/auth";
import { runTransition } from "@/lib/fulfillment";
import { TRY_AGAIN, logError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Close a report. Upheld on a template: the template is archived (out of the gallery). Upheld on an order: its
 * production is put on hold with the reason, then the team contacts the customer (correction or refund).
 */
export async function resolveReport(id: string, decision: "upheld" | "dismissed", fd: FormData) {
  const { supabase, user } = await requirePlatformRole(["ops", "support"], "/admin/moderation");
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000);
  if (note.length < 3) return { error: "Indiquez la décision en quelques mots (visible dans l'historique)." };
  const { data: r } = await supabase.from("content_reports").select("id, status, target_type, target_id, reason").eq("id", id).maybeSingle();
  if (!r) return { error: "Signalement introuvable." };
  if (r.status !== "open") return { error: "Ce signalement est déjà traité." };
  let message = decision === "upheld" ? "Signalement retenu." : "Signalement classé sans suite.";
  if (decision === "upheld" && r.target_type === "template") {
    // templates are written by the catalogue team: moderation (ops, support, role checked above) archives through the server
    const { error } = await createServiceClient().from("templates").update({ status: "archived" }).eq("id", r.target_id);
    if (error) { logError("moderation_template_archive_failed", error, { id }); return { error: TRY_AGAIN }; }
    message = "Signalement retenu : le modèle est retiré de la galerie.";
  }
  if (decision === "upheld" && r.target_type === "order") {
    const { data: f } = await supabase.from("fulfillments").select("id").eq("order_id", r.target_id).maybeSingle();
    if (f) {
      const t = await runTransition(f.id, { type: "hold", reason: `Modération : ${note}` }, { role: "admin", userId: user.id });
      message = "error" in t
        ? `Signalement retenu. La production n'a pas pu être mise en pause (${t.error}) : voyez la commande.`
        : "Signalement retenu : la production est en pause. Contactez le client (correction ou remboursement).";
    }
  }
  const { error } = await supabase.from("content_reports")
    .update({ status: decision, resolution_note: note, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", id).eq("status", "open");
  if (error) { logError("moderation_resolve_failed", error, { id }); return { error: TRY_AGAIN }; }
  await audit({ actorUserId: user.id, action: `report.${decision}`, entityType: "content_report", entityId: id, after: { target: r.target_type, targetId: r.target_id, reason: r.reason, note } });
  revalidatePath("/admin/moderation");
  return { ok: message };
}
