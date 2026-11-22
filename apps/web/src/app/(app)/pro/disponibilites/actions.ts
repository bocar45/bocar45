"use server";

import { revalidatePath } from "next/cache";
import { int, str } from "@/lib/form";
import { TRY_AGAIN, logError } from "@/lib/log";
import { requireActiveVendor } from "@/lib/vendor";

export async function saveCapacity(fd: FormData) {
  const { supabase, vendor, canManage } = await requireActiveVendor("/pro/disponibilites");
  if (!canManage) return { error: "Réservé au propriétaire et aux gérants." };
  const capacity = int(fd, "capacity");
  if (capacity !== null && (Number.isNaN(capacity) || capacity < 1 || capacity > 100000)) return { error: "Capacité : nombre entier de pièces par jour (ou laissez vide)." };
  const { error } = await supabase.from("vendor_profiles").update({ capacity_per_day: capacity }).eq("organization_id", vendor.id);
  if (error) { logError("capacity_save_failed", error, { vendorId: vendor.id }); return { error: TRY_AGAIN }; }
  revalidatePath("/pro/disponibilites");
  return { ok: "Capacité enregistrée." };
}

export async function addClosure(fd: FormData) {
  const { supabase, vendor, canManage } = await requireActiveVendor("/pro/disponibilites");
  if (!canManage) return { error: "Réservé au propriétaire et aux gérants." };
  const from = str(fd, "from"), to = str(fd, "to");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { error: "Indiquez une date de début et une date de fin (fin ≥ début)." };
  if (to < new Date().toISOString().slice(0, 10)) return { error: "Cette période est déjà passée." };
  const { error } = await supabase.from("vendor_closures").insert({ vendor_id: vendor.id, starts_on: from, ends_on: to, reason: str(fd, "reason").slice(0, 200) });
  if (error) { logError("closure_add_failed", error, { vendorId: vendor.id }); return { error: error.code === "23514" ? "Une fermeture ne dépasse pas un an." : TRY_AGAIN }; }
  revalidatePath("/pro/disponibilites");
  return { ok: "Fermeture enregistrée : SAWWA ne vous affectera pas de commande pendant cette période." };
}

export async function removeClosure(id: string) {
  const { supabase, canManage } = await requireActiveVendor("/pro/disponibilites");
  if (!canManage) return { error: "Réservé au propriétaire et aux gérants." };
  const { error } = await supabase.from("vendor_closures").delete().eq("id", id);
  if (error) return { error: TRY_AGAIN };
  revalidatePath("/pro/disponibilites");
  return { ok: "Fermeture supprimée." };
}
