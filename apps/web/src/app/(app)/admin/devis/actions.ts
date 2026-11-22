"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { getSession, hasPlatformRole } from "@/lib/auth";
import { QUOTE_VALIDITY_DAYS } from "@/lib/b2b";
import { TRY_AGAIN, logError } from "@/lib/log";
import { bestQuote, sanitizeDecorations, type DecorationInput } from "@/lib/quoting";

export interface QuoteBuildInput {
  requestId: string; productId: string; colorKey: string; quantity: number;
  sizes: Record<string, number> | null; decorations: DecorationInput[]; validityDays: number; note: string;
}

async function staff() {
  const s = await getSession();
  return s && hasPlatformRole(s.memberships, ["ops", "support"]) ? s : null;
}

/** Price a B2B request with the pricing engine (same path as the studio: bestQuote → packages/pricing). */
async function compute(input: QuoteBuildInput, supabase: NonNullable<Awaited<ReturnType<typeof staff>>>["supabase"]) {
  const { data: product } = await supabase.from("base_products")
    .select("id, slug, status, category:categories(slug), zones(key, max_width_mm, max_height_mm, allowed_techniques)").eq("id", input.productId).maybeSingle();
  if (!product || product.status !== "active") return { error: "Produit introuvable ou pas en vente." } as const;
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100000) return { error: "Quantité entre 1 et 100 000." } as const;
  let sizes: Record<string, number> | null = null;
  if (input.sizes && Object.keys(input.sizes).length) {
    sizes = {};
    for (const [k, v] of Object.entries(input.sizes)) { const n = Math.floor(Number(v)); if (n > 0) sizes[String(k).slice(0, 10)] = n; }
    if (Object.values(sizes).reduce((a, b) => a + b, 0) !== quantity) return { error: "La somme des tailles doit être égale à la quantité (ou laissez les tailles vides)." } as const;
  }
  const decorations = sanitizeDecorations(input.decorations ?? [], (product.zones ?? []) as never);
  if (decorations.length === 0) return { error: "Ajoutez au moins un marquage valide (zone, technique autorisée, taille dans la zone)." } as const;
  const { best, minQty, reason } = await bestQuote({
    productId: product.id, categorySlug: (product.category as unknown as { slug: string } | null)?.slug ?? "default",
    colorKey: String(input.colorKey), sizes, quantity, decorations,
  });
  if (!best) {
    if (reason === "no_offer") return { error: "Aucun atelier actif ne propose ce produit." } as const;
    if (quantity < minQty) return { error: `Minimum ${minQty} pièces chez les ateliers.` } as const;
    return { error: "Aucun atelier ne fabrique cette combinaison (couleur, tailles, technique ou taille de marquage)." } as const;
  }
  return { ok: true as const, product, quantity, sizes, decorations, best };
}

/** Preview: figures for the team, including the workshop cost and SAWWA margin (never shown to the customer). */
export async function previewB2bQuote(input: QuoteBuildInput) {
  const s = await staff();
  if (!s) return { error: "Réservé à l'équipe SAWWA." };
  const r = await compute(input, s.supabase);
  if ("error" in r) return { error: r.error };
  const q = r.best.quote;
  return {
    ok: true as const,
    goodsTotal: q.goodsSubtotal.amount, setupFee: q.setupFee.amount, tax: q.tax.amount, depositDue: q.depositDue?.amount ?? null,
    vendorCost: q.vendorCost.amount, margin: q.margin.amount, leadTimeDays: r.best.leadTimeDays, vendorId: r.best.vendorId,
  };
}

/** Freeze and send the quote (new version; the previous one is superseded). */
export async function sendB2bQuote(input: QuoteBuildInput) {
  const s = await staff();
  if (!s) return { error: "Réservé à l'équipe SAWWA." };
  const { supabase, user } = s;
  const { data: req } = await supabase.from("quote_requests").select("id, status, quotes:b2b_quotes(id, version, status)").eq("id", input.requestId).maybeSingle();
  if (!req) return { error: "Demande introuvable." };
  if (!["new", "quoted"].includes(req.status)) return { error: "Cette demande est close (commandée, déclinée ou annulée)." };
  const r = await compute(input, supabase);
  if ("error" in r) return { error: r.error };
  const q = r.best.quote;
  const days = Math.min(90, Math.max(1, Math.floor(Number(input.validityDays) || QUOTE_VALIDITY_DAYS)));
  const previous = (req.quotes ?? []) as { id: string; version: number; status: string }[];
  const version = Math.max(0, ...previous.map((x) => x.version)) + 1;
  for (const p of previous.filter((x) => x.status === "sent")) {
    const { error } = await supabase.from("b2b_quotes").update({ status: "superseded" }).eq("id", p.id).eq("status", "sent");
    if (error) { logError("b2b_quote_supersede_failed", error, { id: p.id }); return { error: TRY_AGAIN }; }
  }
  const { data: created, error } = await supabase.from("b2b_quotes").insert({
    request_id: req.id, version, base_product_id: r.product.id, color_key: String(input.colorKey), sizes: r.sizes, quantity: r.quantity,
    decorations: r.decorations, unit_price: q.lines[0]!.unitPrice.amount, goods_total: q.goodsSubtotal.amount,
    setup_fee: q.setupFee.amount, tax: q.tax.amount, deposit_due: q.depositDue?.amount ?? null, lead_time_days: r.best.leadTimeDays,
    snapshot: q.snapshot, // reproducible price; internal figures go to b2b_quote_internals (never readable by the customer)
    customer_note: String(input.note ?? "").trim().slice(0, 2000),
    valid_until: new Date(Date.now() + days * 86400000).toISOString(),
  }).select("id").single();
  if (error) { logError("b2b_quote_insert_failed", error, { requestId: req.id }); return { error: TRY_AGAIN }; }
  const { error: eInt } = await supabase.from("b2b_quote_internals").insert({ quote_id: created.id, vendor_cost: q.vendorCost.amount, margin: q.margin.amount });
  if (eInt) {
    // no quote without its internal figures: withdraw it and ask to retry
    logError("b2b_quote_internals_failed", eInt, { quoteId: created.id });
    await supabase.from("b2b_quotes").update({ status: "withdrawn" }).eq("id", created.id);
    return { error: TRY_AGAIN };
  }
  const { error: e2 } = await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", req.id);
  if (e2) logError("quote_request_status_failed", e2, { requestId: req.id });
  await audit({ actorUserId: user.id, action: "b2b_quote.send", entityType: "quote_request", entityId: req.id, after: { quoteId: created.id, version, goodsTotal: q.goodsSubtotal.amount } });
  revalidatePath(`/admin/devis/${req.id}`);
  return { ok: `Devis v${version} envoyé au client (${q.goodsSubtotal.amount.toLocaleString("fr-FR")} FCFA TTC hors livraison).` };
}

export async function declineQuoteRequest(id: string, fd: FormData) {
  const s = await staff();
  if (!s) return { error: "Réservé à l'équipe SAWWA." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000);
  if (note.length < 5) return { error: "Expliquez au client pourquoi (5 caractères au moins)." };
  const { error } = await s.supabase.from("quote_requests").update({ status: "declined", staff_note: note }).eq("id", id).in("status", ["new", "quoted"]);
  if (error) { logError("quote_decline_failed", error, { id }); return { error: TRY_AGAIN }; }
  await s.supabase.from("b2b_quotes").update({ status: "withdrawn" }).eq("request_id", id).eq("status", "sent");
  await audit({ actorUserId: s.user.id, action: "quote_request.decline", entityType: "quote_request", entityId: id, after: { note } });
  revalidatePath(`/admin/devis/${id}`);
  return { ok: "Demande déclinée." };
}
