"use server";

import { revalidatePath } from "next/cache";
import type { PlatformRuleSet } from "@sawwa/pricing";
import { requirePlatformRole } from "@/lib/auth";
import { int, percentToBps } from "@/lib/form";
import { TRY_AGAIN, logError } from "@/lib/log";

export async function createRuleSet(fd: FormData) {
  const { supabase } = await requirePlatformRole(["finance"], "/admin/regles-prix");
  const margin = percentToBps(fd, "margin_pct");
  const vat = percentToBps(fd, "vat_pct");
  const depositPct = percentToBps(fd, "deposit_pct");
  const minMargin = int(fd, "min_margin");
  const step = int(fd, "price_step");
  const depositThreshold = int(fd, "deposit_threshold");
  const errors: string[] = [];
  if (margin === null || Number.isNaN(margin) || margin < 0 || margin > 30000) errors.push("Marge : pourcentage entre 0 et 300.");
  if (vat === null || Number.isNaN(vat) || vat > 5000) errors.push("TVA : pourcentage valide (18 au Sénégal).");
  if (minMargin === null || Number.isNaN(minMargin) || minMargin < 0) errors.push("Marge minimale par pièce : FCFA entiers ≥ 0.");
  if (step === null || Number.isNaN(step) || step < 1) errors.push("Arrondi : FCFA entiers ≥ 1 (ex. 50).");
  if (Number.isNaN(depositThreshold) || Number.isNaN(depositPct)) errors.push("Acompte : valeurs invalides.");
  if ((depositThreshold === null) !== (depositPct === null)) errors.push("Acompte : renseignez le seuil et le pourcentage, ou aucun des deux.");
  if (errors.length) return { error: errors.join("\n") };

  const { data: last } = await supabase.from("price_rule_sets").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const rules: PlatformRuleSet = {
    version,
    currency: "XOF",
    defaultMarginBps: margin!,
    minMarginPerUnit: minMargin!,
    vatBps: vat!,
    priceStep: step!,
    ...(depositThreshold !== null && depositPct !== null ? { deposit: { thresholdTotal: depositThreshold, bps: depositPct } } : {}),
  };
  const { error } = await supabase.from("price_rule_sets").insert({ version, currency: "XOF", rules, status: "draft" });
  if (error) { logError("price_rules_insert_failed", error); return { error: TRY_AGAIN }; }
  revalidatePath("/admin/regles-prix");
  return { ok: `Version ${version} créée en brouillon.` };
}

export async function activateRuleSet(id: string) {
  const { supabase } = await requirePlatformRole(["finance"], "/admin/regles-prix");
  const { error } = await supabase.rpc("activate_price_rule_set", { p_id: id });
  if (error) { logError("price_rules_activate_failed", error, { id }); return { error: error.message.includes("only a draft") ? "Seul un brouillon peut être activé." : TRY_AGAIN }; }
  revalidatePath("/catalogue", "layout");
  revalidatePath("/produits/[slug]", "page");
  revalidatePath("/admin/regles-prix");
  return { ok: "Version activée. Les commandes déjà validées gardent leur prix." };
}
