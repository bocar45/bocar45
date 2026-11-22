"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { TRY_AGAIN, logError } from "@/lib/log";
import { normalizeSenegalPhone } from "@/lib/phone";
import { requireActiveVendor } from "@/lib/vendor";

/** Invite someone by phone (owner: managers and operators; manager: operators). Checked again in SQL. */
export async function inviteMember(fd: FormData) {
  const { supabase, vendor, role, user } = await requireActiveVendor("/pro/equipe");
  const phone = normalizeSenegalPhone(String(fd.get("phone") ?? ""));
  const newRole = String(fd.get("role") ?? "");
  if (!phone) return { error: "Numéro sénégalais invalide (ex. 77 123 45 67)." };
  if (!["manager", "operator"].includes(newRole) || (role !== "owner" && newRole !== "operator")) return { error: "Vous ne pouvez pas inviter avec ce rôle." };
  const { error } = await supabase.rpc("invite_vendor_member", { p_vendor: vendor.id, p_phone: phone, p_role: newRole });
  if (error) { logError("vendor_invite_failed", error, { vendorId: vendor.id }); return { error: error.code === "42501" ? "Vous ne pouvez pas inviter avec ce rôle." : TRY_AGAIN }; }
  await audit({ actorUserId: user.id, action: "vendor.invite", entityType: "organization", entityId: vendor.id, after: { role: newRole } });
  revalidatePath("/pro/equipe");
  return { ok: `Invitation créée. Demandez à la personne de se connecter sur SAWWA avec le ${phone} : elle verra l'invitation dans « Espace atelier » (valable 7 jours).` };
}

/** Owner only: change a role or remove someone (a workshop keeps at least one owner). */
export async function setMember(userId: string, newRole: "owner" | "manager" | "operator" | null) {
  const { supabase, vendor, role, user } = await requireActiveVendor("/pro/equipe");
  if (role !== "owner") return { error: "Seul le propriétaire gère l'équipe." };
  const { error } = await supabase.rpc("set_vendor_member", { p_vendor: vendor.id, p_user: userId, p_role: newRole });
  if (error) return { error: error.code === "23514" ? "L'atelier doit garder au moins un propriétaire." : TRY_AGAIN };
  await audit({ actorUserId: user.id, action: newRole ? "vendor.member_role" : "vendor.member_remove", entityType: "organization", entityId: vendor.id, after: { userId, role: newRole } });
  revalidatePath("/pro/equipe");
  return { ok: newRole ? "Rôle modifié." : "Personne retirée de l'atelier." };
}

/** The invited person accepts (phone must match their account; one account = one workshop). */
export async function acceptInvitation(id: string) {
  const { supabase, user } = await requireUser("/pro");
  const { data, error } = await supabase.rpc("accept_vendor_invitation", { p_invitation: id });
  if (error) return { error: error.code === "23514" ? "Votre compte est déjà rattaché à un atelier." : "Invitation introuvable ou expirée : demandez-en une nouvelle." };
  await audit({ actorUserId: user.id, action: "vendor.join", entityType: "organization", entityId: data as string });
  redirect("/pro");
}
