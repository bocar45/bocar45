"use server";

import { safeNext } from "@/lib/safe-next";

import { normalizeSenegalPhone } from "@/lib/phone";
import { LIMITS, TOO_MANY, clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Sends the login code from the server, so that each SMS (paid per message) goes through our rate limits:
 * per phone number and per network address. The code is then verified in the browser.
 */
export async function sendLoginCode(input: { phone?: string; email?: string; next: string }) {
  const ip = await clientIp();
  if (!(await rateLimit("otpPerIp", ip))) return { error: TOO_MANY };
  const supabase = await createClient();
  if (input.email !== undefined) {
    const email = String(input.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Adresse e-mail invalide." };
    if (!(await rateLimit("otpPerPhone", email))) return { error: TOO_MANY };
    const next = safeNext(input.next);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${site}/auth/callback?suite=${encodeURIComponent(next)}` } });
    if (error) return { error: "Envoi impossible pour le moment. Réessayez dans un instant." };
    return { ok: true as const, target: email };
  }
  const phone = normalizeSenegalPhone(String(input.phone ?? ""));
  if (!phone) return { error: "Numéro invalide. Saisissez un numéro sénégalais, par exemple 77 123 45 67." };
  if (!(await rateLimit("otpPerPhone", phone))) {
    return { error: `Trop de codes demandés pour ce numéro (${LIMITS.otpPerPhone.limit} par heure). Réessayez plus tard.` };
  }
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: "Envoi du SMS impossible pour le moment. Réessayez dans un instant." };
  return { ok: true as const, target: phone };
}
