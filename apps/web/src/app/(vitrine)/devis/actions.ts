"use server";

import { redirect } from "next/navigation";
import { TOO_MANY, rateLimit } from "@/lib/rate-limit";
import { normalizeSenegalPhone } from "@/lib/phone";
import { TRY_AGAIN, logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

export interface QuoteRequestInput {
  organizationName: string; contactName: string; phone: string; productId: string | null; quantity: number;
  deadline: string | null; message: string; logoPath: string | null; designId: string | null;
}

/** Create a quote request for the signed-in customer (RLS: own row, status « new »). */
export async function requestQuote(input: QuoteRequestInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Connectez-vous pour demander un devis." };
  if (!(await rateLimit("quoteRequestPerUser", user.id))) return { error: TOO_MANY };
  const organizationName = String(input.organizationName ?? "").trim().slice(0, 120);
  const contactName = String(input.contactName ?? "").trim().slice(0, 80);
  const phone = normalizeSenegalPhone(String(input.phone ?? ""));
  const quantity = Math.floor(Number(input.quantity));
  if (organizationName.length < 2) return { error: "Indiquez le nom de l'organisation (association, entreprise, club…)." };
  if (contactName.length < 2) return { error: "Indiquez le nom de la personne à contacter." };
  if (!phone) return { error: "Numéro de téléphone sénégalais invalide (ex. 77 123 45 67)." };
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100000) return { error: "Quantité entre 1 et 100 000." };
  const deadline = input.deadline && /^\d{4}-\d{2}-\d{2}$/.test(input.deadline) ? input.deadline : null;
  if (deadline && Date.parse(deadline) < Date.now() - 86400000) return { error: "La date souhaitée est déjà passée." };
  const logoPath = input.logoPath && input.logoPath.startsWith(`${user.id}/`) && !input.logoPath.includes("..") ? input.logoPath : null;
  if (input.logoPath && !logoPath) return { error: "Logo invalide : importez-le à nouveau." };
  const { data, error } = await supabase.from("quote_requests").insert({
    organization_name: organizationName, contact_name: contactName, phone, quantity, deadline,
    base_product_id: input.productId || null, message: String(input.message ?? "").trim().slice(0, 2000),
    logo_path: logoPath, design_id: input.designId || null,
  }).select("id").single();
  if (error) { logError("quote_request_failed", error, { userId: user.id }); return { error: TRY_AGAIN }; }
  redirect(`/compte/devis/${data.id}`);
}

/** Customer cancels their request (SQL function checks ownership and status). */
export async function cancelQuoteRequest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_quote_request", { p_request: id });
  if (error) { logError("quote_cancel_failed", error, { id }); return { error: "Cette demande ne peut plus être annulée." }; }
  redirect(`/compte/devis/${id}`);
}
