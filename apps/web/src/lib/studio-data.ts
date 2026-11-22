import "server-only";
import type { Technique } from "@sawwa/catalog";
import { isSupabaseConfigured } from "./env";
import { bestQuote, sanitizeDecorations, type DecorationInput } from "./quoting";
import { createServiceClient } from "./supabase/server";

export interface StudioZone { key: string; label: string; viewLabel: string; maxWidthMm: number; maxHeightMm: number; techniques: Technique[] }
export interface StudioProduct {
  slug: string;
  name: string;
  categorySlug: string;
  colors: { key: string; hex: string; sizes: string[] }[];
  zones: StudioZone[];
}

const fr = (v: unknown) => (v && typeof v === "object" && "fr" in v ? String((v as { fr: unknown }).fr ?? "") : "");

export async function loadStudioProduct(slug: string): Promise<StudioProduct | null> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data: p, error } = await createServiceClient()
    .from("base_products")
    .select("slug, name, category:categories(slug), variants:base_product_variants(color_key, color_hex, size), views:product_views(id, key, mockup_assets, sort), zones(key, view_id, anchor, max_width_mm, max_height_mm, allowed_techniques)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`Produit indisponible : ${error.message}`);
  if (!p) return null;
  const views = (p.views ?? []) as { id: string; key: string; mockup_assets: { label?: string } | null; sort: number }[];
  const colors = new Map<string, { key: string; hex: string; sizes: string[] }>();
  for (const v of (p.variants ?? []) as { color_key: string; color_hex: string; size: string }[]) {
    const c = colors.get(v.color_key) ?? { key: v.color_key, hex: v.color_hex, sizes: [] };
    c.sizes.push(v.size);
    colors.set(v.color_key, c);
  }
  const zones = ((p.zones ?? []) as { key: string; view_id: string; anchor: { label?: string } | null; max_width_mm: number; max_height_mm: number; allowed_techniques: Technique[] }[])
    .map((z) => {
      const view = views.find((v) => v.id === z.view_id);
      return { key: z.key, label: z.anchor?.label ?? z.key, viewLabel: view?.mockup_assets?.label ?? view?.key ?? "", sort: view?.sort ?? 0, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm, techniques: z.allowed_techniques };
    })
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _s, ...z }) => z);
  return { slug: p.slug, name: fr(p.name), categorySlug: (p.category as unknown as { slug: string } | null)?.slug ?? "default", colors: [...colors.values()], zones };
}

export type { DecorationInput as StudioDecoration } from "./quoting";
export type StudioQuote =
  | { ok: true; unitPrice: number; total: number; quantity: number; leadTimeDays: number; depositDue: number | null; setupFee: number }
  | { ok: false; reason: "not_configured" | "no_offer" | "not_offered" | "min_qty"; message: string };

/** Best public price for a design (studio). Only public TTC figures leave the server. */
export async function quoteStudio(input: { slug: string; colorKey: string; quantity: number; decorations: DecorationInput[] }): Promise<StudioQuote> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: "not_configured", message: "Prix indisponible pour le moment." };
  const quantity = Math.floor(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 5000) return { ok: false, reason: "min_qty", message: "Quantité entre 1 et 5 000." };
  const { data: product } = await createServiceClient()
    .from("base_products").select("id, category:categories(slug), zones(key, max_width_mm, max_height_mm, allowed_techniques)")
    .eq("slug", input.slug).eq("status", "active").maybeSingle();
  if (!product) return { ok: false, reason: "no_offer", message: "Produit introuvable." };
  const decorations = sanitizeDecorations(input.decorations, product.zones ?? []);
  if (decorations.length === 0) return { ok: false, reason: "not_offered", message: "Ajoutez un élément dans une zone pour voir le prix." };
  const { best, minQty, reason } = await bestQuote({
    productId: product.id, categorySlug: (product.category as unknown as { slug: string } | null)?.slug ?? "default",
    colorKey: input.colorKey, sizes: null, quantity, decorations,
  });
  if (best) {
    const q = best.quote;
    return { ok: true, unitPrice: q.lines[0]!.unitPrice.amount, total: q.total.amount, quantity, leadTimeDays: best.leadTimeDays, depositDue: q.depositDue?.amount ?? null, setupFee: q.setupFee.amount };
  }
  if (reason === "no_offer") return { ok: false, reason, message: "Aucun atelier ne propose encore ce produit." };
  if (quantity < minQty) return { ok: false, reason: "min_qty", message: `Minimum ${minQty} pièces pour ce produit.` };
  return { ok: false, reason: "not_offered", message: "Cette combinaison (taille du marquage, technique ou couleur) n'est proposée par aucun atelier pour l'instant." };
}
