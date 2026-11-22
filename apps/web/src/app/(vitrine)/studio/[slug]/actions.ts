"use server";

import { createHash } from "node:crypto";
import { blocking, decorationsFor, parseDesign, preflight, type DesignDocument } from "@sawwa/design";
import { transition, type FulfillmentStatus } from "@sawwa/workflow";
import { planCorrection } from "@/lib/correction";
import { foreignImages } from "@/lib/design-ownership";
import { TOO_MANY, clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeSenegalPhone } from "@/lib/phone";
import { bestQuote, sanitizeDecorations } from "@/lib/quoting";
import { DELIVERY_OPTIONS, isDeliveryKey } from "@/lib/shipping";
import { quoteStudio, type StudioDecoration } from "@/lib/studio-data";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function getStudioQuote(slug: string, colorKey: string, quantity: number, decorations: StudioDecoration[]) {
  if (!(await rateLimit("quotePerIp", await clientIp()))) return { ok: false as const, reason: "min_qty" as const, message: TOO_MANY };
  return quoteStudio({ slug: String(slug), colorKey: String(colorKey), quantity: Number(quantity), decorations: Array.isArray(decorations) ? decorations : [] });
}

const onDeviceImages = (d: DesignDocument) => d.surfaces.some((s) => s.layers.some((l) => l.type === "image" && !l.src.startsWith("storage:")));

export async function saveDesign(input: { id: string | null; slug: string; title: string; document: unknown }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Connectez-vous pour enregistrer votre création." };
  if (!(await rateLimit("saveDesignPerUser", user.id))) return { error: TOO_MANY };
  const parsed = parseDesign(input.document);
  if (!parsed.ok) return { error: "Création illisible. Rechargez le studio." };
  if (parsed.value.product !== input.slug) return { error: "Création et produit ne correspondent pas." };
  if (onDeviceImages(parsed.value)) return { error: "Les images n'ont pas pu être envoyées. Réessayez." };
  if (foreignImages(parsed.value, user.id).length) return { error: "Cette création utilise des images qui ne vous appartiennent pas." };
  const { data: product } = await supabase.from("base_products").select("id").eq("slug", input.slug).eq("status", "active").maybeSingle();
  if (!product) return { error: "Ce produit n'est plus disponible." };
  const title = String(input.title ?? "").trim().slice(0, 80) || "Ma création";
  if (input.id) {
    const { error } = await supabase.from("designs").update({ title, document: parsed.value }).eq("id", input.id);
    if (error) return { error: `Enregistrement impossible : ${error.message}` };
    return { ok: true as const, id: input.id };
  }
  const { data, error } = await supabase.from("designs").insert({ owner_id: user.id, base_product_id: product.id, title, document: parsed.value }).select("id").single();
  if (error || !data) return { error: `Enregistrement impossible : ${error?.message}` };
  return { ok: true as const, id: data.id as string };
}

export interface PlaceOrderInput {
  designId: string;
  sizes: Record<string, number>;
  delivery: string;
  address: { name: string; phone: string; district: string; landmark: string; city: string };
  acceptWarnings: boolean;
}

export async function placeOrder(input: PlaceOrderInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Connectez-vous pour commander." };
  if (!(await rateLimit("orderPerUser", user.id))) return { error: TOO_MANY };

  // Inputs
  const sizes: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.sizes ?? {})) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 5000) return { error: "Quantités invalides." };
    if (n > 0) sizes[String(k).slice(0, 10)] = n;
  }
  const quantity = Object.values(sizes).reduce((a, b) => a + b, 0);
  if (quantity < 1) return { error: "Indiquez au moins une pièce." };
  if (!isDeliveryKey(input.delivery)) return { error: "Choisissez un mode de livraison." };
  const phone = normalizeSenegalPhone(input.address?.phone ?? "");
  const name = String(input.address?.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Indiquez le nom de la personne qui reçoit la commande." };
  if (!phone) return { error: "Numéro de téléphone sénégalais invalide (ex. 77 123 45 67)." };
  const district = String(input.address?.district ?? "").trim().slice(0, 80);
  if (input.delivery !== "pickup" && !district) return { error: "Indiquez le quartier de livraison." };

  // Design (owner only, through RLS)
  const { data: design } = await supabase
    .from("designs").select("id, document, product:base_products(id, slug, status, category:categories(slug), zones(key, max_width_mm, max_height_mm, allowed_techniques))")
    .eq("id", input.designId).maybeSingle();
  const product = design?.product as unknown as { id: string; slug: string; status: string; category: { slug: string } | null; zones: { key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: string[] }[] } | null;
  if (!design || !product || product.status !== "active") return { error: "Création ou produit introuvable." };
  const parsed = parseDesign(design.document);
  if (!parsed.ok) return { error: "Création illisible." };
  const doc = parsed.value;
  if (onDeviceImages(doc)) return { error: "Enregistrez d'abord votre création dans votre compte." };
  if (foreignImages(doc, user.id).length) return { error: "Cette création utilise des images qui ne vous appartiennent pas." };

  // Fabrication checks, recomputed on the server
  const zoneSizes = product.zones.map((z) => ({ key: z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm }));
  const issues = doc.surfaces.flatMap((s) => {
    const z = zoneSizes.find((x) => x.key === s.zoneKey);
    return z ? preflight(s, z) : [];
  });
  if (blocking(issues)) return { error: "Votre création contient des points bloquants (voir « Vérification de fabrication »)." };
  if (issues.length > 0 && !input.acceptWarnings) return { error: "Confirmez que vous acceptez les remarques de fabrication." };

  const decorations = sanitizeDecorations(decorationsFor(doc, zoneSizes), product.zones);
  if (decorations.length === 0) return { error: "Votre création est vide." };
  const shipping = DELIVERY_OPTIONS[input.delivery].price;
  const { best } = await bestQuote({
    productId: product.id, categorySlug: product.category?.slug ?? "default", colorKey: doc.colorKey,
    sizes, quantity, decorations, shipping,
  });
  if (!best) return { error: "Aucun atelier ne peut fabriquer cette combinaison pour l'instant (tailles, couleur ou marquage)." };
  const q = best.quote;

  const { data, error } = await createServiceClient().rpc("create_order", {
    p_customer: user.id,
    p_design: design.id,
    p_document: doc,
    p_sha256: createHash("sha256").update(JSON.stringify(doc)).digest("hex"),
    p_preflight: issues,
    p_items: [{
      color_key: doc.colorKey, sizes, quantity,
      unit_price: q.lines[0]!.unitPrice.amount,
      line_total: q.goodsSubtotal.amount,
      decorations,
    }],
    p_totals: { subtotal: q.goodsSubtotal.amount, shipping: q.shipping.amount, discount: q.discount.amount, tax: q.tax.amount, total: q.total.amount, deposit_due: q.depositDue?.amount ?? null },
    p_quote: { ...q.snapshot, suggestedVendorId: best.vendorId, leadTimeDays: best.leadTimeDays, lines: q.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice.amount })), setupFee: q.setupFee.amount, delivery: input.delivery },
    p_address: { name, phone, district, landmark: String(input.address?.landmark ?? "").trim().slice(0, 160), city: String(input.address?.city ?? "Dakar").trim().slice(0, 60), delivery: input.delivery },
  });
  if (error || !data?.[0]) return { error: `La commande n'a pas pu être créée : ${error?.message ?? "réessayez"}` };
  return { ok: true as const, orderId: data[0].order_id as string, number: data[0].order_number as string };
}

/**
 * E10 — the customer sends a corrected design back to the workshop (order in « correction demandée »).
 * Same checks as an order; price recomputed; a higher price needs explicit agreement on the exact surcharge.
 */
export async function resubmitCorrection(input: { orderId: string; document: unknown; acceptWarnings: boolean; acceptedSurcharge: number | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Connectez-vous pour corriger votre commande." };
  if (!(await rateLimit("orderPerUser", user.id))) return { error: TOO_MANY };

  const { data: order } = await supabase
    .from("orders")
    .select("id, total, shipping, shipping_address, items:order_items(color_key, sizes, quantity, decorations, product:base_products(id, slug, category:categories(slug), zones(key, max_width_mm, max_height_mm, allowed_techniques))), fulfillments(id, status, vendor_id, proof_round, held_from)")
    .eq("id", input.orderId).maybeSingle();
  if (!order) return { error: "Commande introuvable." };
  const item = (order.items as unknown as { color_key: string; sizes: Record<string, number>; quantity: number; decorations: ReturnType<typeof sanitizeDecorations>; product: { id: string; slug: string; category: { slug: string } | null; zones: { key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: string[] }[] } }[])[0];
  const f = (order.fulfillments as { id: string; status: string; vendor_id: string | null; proof_round: number; held_from: string | null }[])[0];
  if (!item || !f) return { error: "Commande incomplète." };
  if (f.status !== "changes_requested") return { error: "Cette commande n'attend pas de correction." };

  const parsed = parseDesign(input.document);
  if (!parsed.ok || parsed.value.product !== item.product.slug) return { error: "Création illisible ou produit différent." };
  const doc = parsed.value;
  if (doc.colorKey !== item.color_key) return { error: "La couleur du produit ne peut pas changer pendant une correction." };
  if (onDeviceImages(doc)) return { error: "Enregistrez d'abord votre création (les images doivent être envoyées)." };
  if (foreignImages(doc, user.id).length) return { error: "Cette création utilise des images qui ne vous appartiennent pas." };

  const zoneSizes = item.product.zones.map((z) => ({ key: z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm }));
  const issues = doc.surfaces.flatMap((s) => { const z = zoneSizes.find((x) => x.key === s.zoneKey); return z ? preflight(s, z) : []; });
  if (blocking(issues)) return { error: "Votre création contient encore des points bloquants." };
  if (issues.length > 0 && !input.acceptWarnings) return { error: "Confirmez que vous acceptez les remarques de fabrication." };
  const decorations = sanitizeDecorations(decorationsFor(doc, zoneSizes), item.product.zones);
  if (decorations.length === 0) return { error: "Votre création est vide." };

  // Both versions are priced with the workshop already assigned (D16): feasibility and surcharge are its own.
  if (!f.vendor_id) return { error: "Cette commande n'a pas d'atelier affecté. Contactez l'équipe SAWWA." };
  const basis = { productId: item.product.id, categorySlug: item.product.category?.slug ?? "default", colorKey: doc.colorKey, sizes: item.sizes, quantity: item.quantity, shipping: order.shipping, vendorId: f.vendor_id };
  const [before, after] = await Promise.all([bestQuote({ ...basis, decorations: item.decorations }), bestQuote({ ...basis, decorations })]);
  const plan = planCorrection({
    agreedTotal: order.total, before: before.best?.quote.total.amount ?? null, after: after.best?.quote.total.amount ?? null,
    acceptedSurcharge: input.acceptedSurcharge,
  });
  if (!plan.ok) return { error: plan.message, ...(plan.surcharge ? { surcharge: plan.surcharge } : {}) };
  const q = after.best!.quote;
  const frozenQuote = {
    ...q.snapshot, vendorId: f.vendor_id, total: q.total.amount, goodsSubtotal: q.goodsSubtotal.amount, tax: q.tax.amount,
    shipping: q.shipping.amount, setupFee: q.setupFee.amount, vendorCost: q.vendorCost.amount,
    lines: q.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice.amount })),
    comparedWith: plan.priceBefore, surcharge: plan.surcharge,
  };

  let next;
  try {
    next = transition(
      { status: f.status as FulfillmentStatus, vendorId: f.vendor_id, proofRound: f.proof_round, heldFrom: (f.held_from as FulfillmentStatus | null) ?? null },
      { type: "resubmit_design", designVersionId: "pending" },
      { role: "customer" },
    );
  } catch {
    return { error: "Cette correction n'est plus possible à cette étape." };
  }
  const { error } = await createServiceClient().rpc("resubmit_design", {
    p_order: order.id, p_customer: user.id, p_document: doc,
    p_sha256: createHash("sha256").update(JSON.stringify(doc)).digest("hex"), p_preflight: issues,
    p_decorations: decorations, p_surcharge: plan.surcharge, p_state: next.state,
    p_quote: frozenQuote, p_vendor_cost: q.vendorCost.amount,
  });
  if (error) {
    if (error.message.includes("conflict")) return { error: "Cette commande vient de changer. Rechargez la page." };
    console.error("resubmit_design failed", error);
    return { error: "Le renvoi n'a pas pu être enregistré. Réessayez dans un instant ; si le problème continue, contactez l'équipe SAWWA." };
  }
  return { ok: true as const, surcharge: plan.surcharge };
}
