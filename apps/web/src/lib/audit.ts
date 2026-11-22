import "server-only";
import { logError } from "./log";
import { createServiceClient } from "./supabase/server";

/** Append to the audit log (service role: users cannot write it themselves). Throws if it fails. */
export async function audit(entry: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  const { error } = await createServiceClient().from("audit_log").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  if (error) { logError("audit_write_failed", error, { action: entry.action }); throw new Error("Journal d'audit indisponible : l'action n'a pas été confirmée."); }
}
