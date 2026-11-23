"use server";

import { createHash } from "node:crypto";
import { MAX_ROSTER, blocking, blankPieces, checkRoster, checkSurface, decorationsFor, needsRoster, parseDesign, preflight, sizesFromRoster, widestPiece, type DesignDocument, type RosterEntry } from "@sawwa/design";
import { transition, type FulfillmentStatus } from "@sawwa/workflow";
import type { Quote } from "@sawwa/pricing";
import { fitsQuote, isQuoteValid, repriceFrozen, type B2bQuoteRow } from "@/lib/b2b";
import { planCorrection } from "@/lib/correction";
import { patternOf } from "@/lib/pattern-zone";
import { foreignImages, needsRightsDeclaration } from "@/lib/design-ownership";
import { TOO_MANY, clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeSenegalPhone } from "@/lib/phone";
import { bestQuote, sanitizeDecorations } from "@/lib/quoting";
import { DELIVERY_OPTIONS, isDeliveryKey } from "@/lib/shipping";
import { quoteStudio, type StudioDecoration } from "@/lib/studio-data";
import { storefrontForStudio } from "@/lib/storefront";
import { orderVendorScope } from "@/lib/storefront-form";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TRY_AGAIN, logError } from "@/lib/log";

export async function getStudioQuote(slug: string, colorKey: string, quantity: number, decorations: StudioDecoration[]) {
  if (!(await rateLimit("quotePerIp", await clientIp()))) return { ok: false as const, reason: "rate_limited" as const, message: TOO_MANY };
  return quoteStudio({ slug: String(slug), colorKey: String(colorKey), quantity: Number(quantity), decorations: Array.isArray(decorations) ? decorations : [] });
}

/**
 * E27: price in a white-label storefront with that shop's workshop only. The shop is resolved on the server from its
 * public address (bound by the page), never from a vendor id sent by the browser.
 */
export async function getStorefrontStudioQuote(boutique: string, slug: string, colorKey: string, quantity: number, decorations: StudioDecoration[]) {
  if (!(await rateLimit("quotePerIp", await clientIp()))) return { ok: false as const, reason: "rate_limited" as const, message: TOO_MANY };
  const shop = await storefrontForStudio(String(boutique), String(slug));
  if (!shop) return getStudioQuote(slug, colorKey, quantity, decorations);
  return quoteStudio({ slug: String(slug), colorKey: String(colorKey), quantity: Number(quantity), decorations: Array.isArray(decorations) ? decorations : [], vendorId: shop.vendorId });
}

const onDeviceImages = (d: DesignDocument) => d.surfaces.some((s) => s.layers.some((l) => l.type === "image" && !l.src.startsWith("storage:")));

export async function saveDesign(input: { id: string | null; slug: string; title: string; document: unknown; rightsDeclared?: boolean }) {
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
  // E18d: imported images need the customer's declaration that they may print them (date kept on the design).
  const declared = input.rightsDeclared === true;
  let alreadyDeclared = false;
  if (input.id) {
    const { data: existing } = await supabase.from("designs").select("rights_declared_at").eq("id", input.id).maybeSingle();
    alreadyDeclared = Boolean(existing?.rights_declared_at);
  }
  if (needsRightsDeclaration(parsed.value) && !declared && !alreadyDeclared) {
    return { error: "Confirmez que vous avez le droit d'utiliser les images importées (case à cocher dans le studio)." };
  }
  const rights = declared && !alreadyDeclared ? { rights_declared_at: new Date().toISOString() } : {};
  if (input.id) {
    const { error } = await supabase.from("designs").update({ title, document: parsed.value, ...rights }).eq("id", input.id);
    if (error) { logError("design_update_failed", error, { designId: input.id }); return { error: TRY_AGAIN }; }
    return { ok: true as const, id: input.id };
  }
  const { data, error } = await supabase.from("designs").insert({ owner_id: user.id, base_product_id: product.id, title, document: parsed.value, ...rights }).select("id").single();
  if (error || !data) { logError("design_insert_failed", error, { userId: user.id }); return { error: TRY_AGAIN }; }
  return { ok: true as const, id: data.id as string };
}

export interface PlaceOrderInput {
  designId: string;
  sizes: Record<string, number>;
  delivery: string;
  address: { name: string; phone: string; district: string; landmark: string; city: string };
  acceptWarnings: boolean;
  /** E16: one line per piece when the design has a name or a number per piece (sizes are then taken from it). */
  roster?: RosterEntry[] | null;
  /** E17: order at the price of an accepted B2B quote (frozen). */
  quoteId?: string | null;
}

export async function placeOrder(input: PlaceOrderInput) {
  return placeOrderFor(input, null);
}

/**
 * E27: an order placed from a white-label storefront is priced with that shop's workshop only, exactly as the studio
 * showed it. The shop is resolved on the server from its address (bound by the page); unknown, inactive, or a product
 * the shop does not sell → the order is refused rather than silently priced by another workshop.
 */
export async function placeStorefrontOrder(boutique: string, input: PlaceOrderInput) {
  return placeOrderFor(input, String(boutique));
}

async function placeOrderFor(input: PlaceOrderInput, boutique: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Connectez-vous pour commander." };
  if (!(await rateLimit("orderPerUser", user.id))) return { error: TOO_MANY };

  // Inputs
  let sizes: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.sizes ?? {})) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 5000) return { error: "Quantités invalides." };
    if (n > 0) sizes[String(k).slice(0, 10)] = n;
  }
  let quantity = Object.values(sizes).reduce((a, b) => a + b, 0);
  if (quantity < 1 && !Array.isArray(input.roster)) return { error: "Indiquez au moins une pièce." };
  if (!isDeliveryKey(input.delivery)) return { error: "Choisissez un mode de livraison." };
  const phone = normalizeSenegalPhone(input.address?.phone ?? "");
  const name = String(input.address?.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Indiquez le nom de la personne qui reçoit la commande." };
  if (!phone) return { error: "Numéro de téléphone sénégalais invalide (ex. 77 123 45 67)." };
  const district = String(input.address?.district ?? "").trim().slice(0, 80);
  if (input.delivery !== "pickup" && !district) return { error: "Indiquez le quartier de livraison." };

  // Design (owner only, through RLS)
  const { data: design } = await supabase
    .from("designs").select("id, document, rights_declared_at, product:base_products(id, slug, status, category:categories(slug), zones(key, max_width_mm, max_height_mm, allowed_techniques, anchor))")
    .eq("id", input.designId).maybeSingle();
  const product = design?.product as unknown as { id: string; slug: string; status: string; category: { slug: string } | null; zones: { key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: string[]; anchor: unknown }[] } | null;
  if (!design || !product || product.status !== "active") return { error: "Création ou produit introuvable." };
  const scope = orderVendorScope(boutique, boutique ? await storefrontForStudio(boutique, product.slug) : null);
  if (!scope.ok) return { error: scope.error };
  const parsed = parseDesign(design.document);
  if (!parsed.ok) return { error: "Création illisible." };
  const doc = parsed.value;
  if (onDeviceImages(doc)) return { error: "Enregistrez d'abord votre création dans votre compte." };
  if (foreignImages(doc, user.id).length) return { error: "Cette création utilise des images qui ne vous appartiennent pas." };
  if (needsRightsDeclaration(doc) && !design.rights_declared_at) return { error: "Confirmez que vous avez le droit d'utiliser les images importées, puis enregistrez à nouveau." };

  // Fabrication checks, recomputed on the server
  const zoneSizes = product.zones.map((z) => ({ key: z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm, pattern: patternOf(z.anchor) }));

  // E16: names and numbers per piece — the roster decides the sizes and the quantity.
  let roster: RosterEntry[] | null = null;
  if (needsRoster(doc)) {
    if (!Array.isArray(input.roster) || input.roster.length === 0) return { error: "Ajoutez la liste des pièces (taille, nom, numéro)." };
    if (input.roster.length > MAX_ROSTER) return { error: `${MAX_ROSTER} pièces au plus par commande.` };
    roster = input.roster.map((e) => {
      const name = String(e?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
      const number = String(e?.number ?? "").trim().slice(0, 6);
      return { size: String(e?.size ?? "").slice(0, 10), ...(name ? { name } : {}), ...(number ? { number } : {}) };
    });
    const { data: variants } = await supabase.from("base_product_variants").select("size").eq("base_product_id", product.id).eq("color_key", doc.colorKey);
    const { errors } = checkRoster(doc, roster, [...new Set((variants ?? []).map((v) => v.size as string))], zoneSizes);
    if (errors.length) return { error: errors.slice(0, 3).join(" ") + (errors.length > 3 ? ` (et ${errors.length - 3} autre${errors.length > 4 ? "s" : ""})` : "") };
    sizes = sizesFromRoster(roster);
    quantity = roster.length;
  } else if (Array.isArray(input.roster) && input.roster.length > 0) {
    return { error: "Cette création n'a pas de nom ni de numéro par pièce." };
  }
  if (quantity < 1) return { error: "Indiquez au moins une pièce." };
  const issues = doc.surfaces.flatMap((s) => {
    const z = zoneSizes.find((x) => x.key === s.zoneKey);
    return z ? checkSurface(s, z, doc.allOver) : [];
  });
  issues.push(...blankPieces(doc, product.zones.map((z) => ({ key: z.key, label: (z.anchor as { label?: string } | null)?.label ?? z.key, pattern: patternOf(z.anchor) }))));
  if (blocking(issues)) return { error: "Votre création contient des points bloquants (voir « Vérification de fabrication »)." };
  if (issues.length > 0 && !input.acceptWarnings) return { error: "Confirmez que vous acceptez les remarques de fabrication." };

  // Team order: priced and printed at the widest name/number of the list (same rule as the studio).
  const decorations = sanitizeDecorations(decorationsFor(roster ? widestPiece(doc, roster) : doc, zoneSizes), product.zones);
  if (decorations.length === 0) return { error: "Votre création est vide." };
  const shipping = DELIVERY_OPTIONS[input.delivery].price;

  // E17: a B2B quote fixes the price. The design must fit what was quoted; the quote is claimed once, atomically,
  // and priced again with its own frozen rule set and workshop grid (+ delivery), so every figure still comes from
  // packages/pricing and the goods amount is exactly the quoted one.
  let b2b: B2bQuoteRow | null = null;
  if (input.quoteId) {
    const { data: row } = await supabase.from("b2b_quotes").select("*").eq("id", String(input.quoteId)).maybeSingle();
    const quote = row as B2bQuoteRow | null;
    if (!quote || !isQuoteValid(quote)) return { error: "Ce devis a expiré ou a déjà été utilisé. Demandez une mise à jour dans « Mes devis »." };
    if (quote.base_product_id !== product.id || quote.color_key !== doc.colorKey) return { error: "Le produit ou la couleur ne correspondent pas au devis." };
    if (quantity !== quote.quantity) return { error: `Le devis porte sur ${quote.quantity} pièces : indiquez exactement cette quantité.` };
    if (quote.sizes && JSON.stringify(Object.entries(quote.sizes).sort()) !== JSON.stringify(Object.entries(sizes).sort())) return { error: "Les tailles doivent être celles du devis." };
    const problems = fitsQuote(decorations, quote.decorations);
    if (problems.length) return { error: `Votre création dépasse le devis : ${problems.join(" ; ")}.` };
    b2b = quote;
  }
  let q: Quote, suggestedVendorId: string, leadTimeDays: number;
  let sizeMix: Record<string, unknown> | null = null;
  if (b2b) {
    const { data: claimed, error: claimError } = await createServiceClient().rpc("claim_b2b_quote", { p_quote: b2b.id, p_customer: user.id });
    if (claimError || !claimed?.length) return { error: "Ce devis a expiré ou a déjà été utilisé. Demandez une mise à jour dans « Mes devis »." };
    const repriced = await repriceFrozen(product.id, b2b.snapshot, shipping, { colorKey: doc.colorKey, sizes });
    if (repriced?.missingSizes.length) {
      await createServiceClient().rpc("release_b2b_quote", { p_quote: b2b.id });
      return { error: `L'atelier prévu pour ce devis ne fabrique pas la taille ${repriced.missingSizes.join(", ")} dans cette couleur. Choisissez d'autres tailles ou demandez une mise à jour du devis.` };
    }
    if (!repriced || repriced.frozen.goodsSubtotal.amount !== b2b.goods_total) {
      await createServiceClient().rpc("release_b2b_quote", { p_quote: b2b.id });
      logError("b2b_reprice_failed", { message: "frozen quote could not be priced again" }, { quoteId: b2b.id });
      return { error: "Le devis n'a pas pu être appliqué. L'équipe SAWWA est prévenue ; réessayez plus tard." };
    }
    // Firm price: the quoted amount. If the real sizes would cost something else, both are kept for the finance team.
    q = repriced.actual && repriced.actual.goodsSubtotal.amount === b2b.goods_total ? repriced.actual : repriced.frozen;
    sizeMix = repriced.actual && q !== repriced.actual
      ? { actualGoods: repriced.actual.goodsSubtotal.amount, actualLines: repriced.actual.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice.amount })) }
      : null;
    suggestedVendorId = b2b.snapshot.vendorId; leadTimeDays = b2b.lead_time_days;
  } else {
    const { best } = await bestQuote({
      productId: product.id, categorySlug: product.category?.slug ?? "default", colorKey: doc.colorKey,
      sizes, quantity, decorations, shipping,
      ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
    });
    if (!best) return { error: "Aucun atelier ne peut fabriquer cette combinaison pour l'instant (tailles, couleur ou marquage)." };
    q = best.quote; suggestedVendorId = best.vendorId; leadTimeDays = best.leadTimeDays;
  }

  // E18b/E24a: the pattern pieces used are frozen with the order (rule 7): a later catalogue change never alters it
  const usedPieces = zoneSizes.filter((z) => z.pattern && decorations.some((d) => d.zoneKey === z.key));
  const frozenPatterns = usedPieces.length ? Object.fromEntries(usedPieces.map((z) => [z.key, z.pattern])) : null;
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
      decorations, roster,
    }],
    p_totals: { subtotal: q.goodsSubtotal.amount, shipping: q.shipping.amount, discount: q.discount.amount, tax: q.tax.amount, total: q.total.amount, deposit_due: q.depositDue?.amount ?? null },
    p_quote: { ...q.snapshot, suggestedVendorId, leadTimeDays, ...(frozenPatterns ? { patterns: frozenPatterns } : {}), ...(b2b ? { b2bQuoteId: b2b.id, b2bQuoteVersion: b2b.version, ...(sizeMix ? { b2bSizeMix: sizeMix } : {}) } : {}), lines: q.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice.amount })), setupFee: q.setupFee.amount, delivery: input.delivery },
    p_address: { name, phone, district, landmark: String(input.address?.landmark ?? "").trim().slice(0, 160), city: String(input.address?.city ?? "Dakar").trim().slice(0, 60), delivery: input.delivery },
  });
  if (error || !data?.[0]) {
    if (b2b) await createServiceClient().rpc("release_b2b_quote", { p_quote: b2b.id });
    logError("create_order_failed", error, { userId: user.id, designId: design.id });
    return { error: "Votre commande n'a pas pu être enregistrée. Rien ne vous a été facturé ; réessayez dans un instant." };
  }
  if (b2b) {
    const { error: linkError } = await createServiceClient().rpc("link_b2b_quote", { p_quote: b2b.id, p_order: data[0].order_id });
    if (linkError) logError("b2b_link_failed", linkError, { quoteId: b2b.id, orderId: data[0].order_id });
  }
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
    .select("id, total, shipping, shipping_address, items:order_items(color_key, sizes, quantity, decorations, roster, product:base_products(id, slug, category:categories(slug), zones(key, max_width_mm, max_height_mm, allowed_techniques, anchor))), fulfillments(id, status, vendor_id, proof_round, held_from)")
    .eq("id", input.orderId).maybeSingle();
  if (!order) return { error: "Commande introuvable." };
  const item = (order.items as unknown as { color_key: string; sizes: Record<string, number>; quantity: number; roster: RosterEntry[] | null; decorations: ReturnType<typeof sanitizeDecorations>; product: { id: string; slug: string; category: { slug: string } | null; zones: { key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: string[]; anchor: unknown }[] } }[])[0];
  const f = (order.fulfillments as { id: string; status: string; vendor_id: string | null; proof_round: number; held_from: string | null }[])[0];
  if (!item || !f) return { error: "Commande incomplète." };
  if (f.status !== "changes_requested") return { error: "Cette commande n'attend pas de correction." };

  const parsed = parseDesign(input.document);
  if (!parsed.ok || parsed.value.product !== item.product.slug) return { error: "Création illisible ou produit différent." };
  const doc = parsed.value;
  if (doc.colorKey !== item.color_key) return { error: "La couleur du produit ne peut pas changer pendant une correction." };
  if (onDeviceImages(doc)) return { error: "Enregistrez d'abord votre création (les images doivent être envoyées)." };
  if (foreignImages(doc, user.id).length) return { error: "Cette création utilise des images qui ne vous appartiennent pas." };

  const zoneSizes = item.product.zones.map((z) => ({ key: z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm, pattern: patternOf(z.anchor) }));
  const issues = doc.surfaces.flatMap((s) => { const z = zoneSizes.find((x) => x.key === s.zoneKey); return z ? checkSurface(s, z, doc.allOver) : []; });
  issues.push(...blankPieces(doc, item.product.zones.map((z) => ({ key: z.key, label: (z.anchor as { label?: string } | null)?.label ?? z.key, pattern: patternOf(z.anchor) }))));
  if (blocking(issues)) return { error: "Votre création contient encore des points bloquants." };
  if (issues.length > 0 && !input.acceptWarnings) return { error: "Confirmez que vous acceptez les remarques de fabrication." };
  // E16: the team list is frozen with the order; the corrected design must still print it correctly.
  if (item.roster?.length) {
    if (!needsRoster(doc)) return { error: "Cette commande d'équipe doit garder le nom et/ou le numéro variables." };
    const { errors } = checkRoster(doc, item.roster, Object.keys(item.sizes), zoneSizes);
    if (errors.length) return { error: `Avec la liste de l'équipe : ${errors.slice(0, 2).join(" ")}` };
  } else if (needsRoster(doc)) {
    return { error: "Un nom ou un numéro par pièce ne peut pas être ajouté pendant une correction : il faudrait une nouvelle commande." };
  }
  const decorations = sanitizeDecorations(decorationsFor(item.roster?.length ? widestPiece(doc, item.roster) : doc, zoneSizes), item.product.zones);
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
    logError("resubmit_design_failed", error, { orderId: order.id });
    return { error: "Le renvoi n'a pas pu être enregistré. Réessayez dans un instant ; si le problème continue, contactez l'équipe SAWWA." };
  }
  return { ok: true as const, surcharge: plan.surcharge };
}
