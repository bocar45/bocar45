"use server";

import { createHash } from "node:crypto";
import { blocking, decorationsFor, parseDesign, preflight, type DesignDocument } from "@sawwa/design";
import { normalizeSenegalPhone } from "@/lib/phone";
import { bestQuote, sanitizeDecorations } from "@/lib/quoting";
import { DELIVERY_OPTIONS, isDeliveryKey } from "@/lib/shipping";
import { quoteStudio, type StudioDecoration } from "@/lib/studio-data";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function getStudioQuote(slug: string, colorKey: string, quantity: number, decorations: StudioDecoration[]) {
  return quoteStudio({ slug: String(slug), colorKey: String(colorKey), quantity: Number(quantity), decorations: Array.isArray(decorations) ? decorations : [] });
}

const onDeviceImages = (d: DesignDocument) => d.surfaces.some((s) => s.layers.some((l) => l.type === "image" && !l.src.startsWith("storage:")));

export async function saveDesign(input: { id: string | null; slug: string; title: string; document: unknown }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Connectez-vous pour enregistrer votre création." };
  const parsed = parseDesign(input.document);
  if (!parsed.ok) return { error: "Création illisible. Rechargez le studio." };
  if (parsed.value.product !== input.slug) return { error: "Création et produit ne correspondent pas." };
  if (onDeviceImages(parsed.value)) return { error: "Les images n'ont pas pu être envoyées. Réessayez." };
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
