import "server-only";
import { OCCASIONS, isOccasion, type Occasion } from "@sawwa/catalog";
import { parseDesign, type DesignDocument } from "@sawwa/design";
import { isSupabaseConfigured } from "./env";
import { logError } from "./log";
import { imageUrls } from "./storage-refs";
import { createClient } from "./supabase/server";

export interface TemplateCard {
  id: string; slug: string; title: string; description: string; occasion: Occasion; occasionLabel: string;
  product: { slug: string; name: string; categorySlug: string; colorHex: string; zones: { key: string; maxWidthMm: number; maxHeightMm: number }[] };
  document: DesignDocument; urls: Record<string, string>;
}

const fr = (v: unknown) => (v && typeof v === "object" && "fr" in v ? String((v as { fr: unknown }).fr ?? "") : "");
const SELECT = "id, slug, title, description, occasion, status, document, product:base_products(slug, name, category:categories(slug), variants:base_product_variants(color_key, color_hex), zones(key, max_width_mm, max_height_mm))";

type Row = {
  id: string; slug: string; title: string; description: string; occasion: string; status: string; document: unknown;
  product: { slug: string; name: unknown; category: { slug: string } | null; variants: { color_key: string; color_hex: string }[];
    zones: { key: string; max_width_mm: number; max_height_mm: number }[] } | null;
};

async function toCard(client: Awaited<ReturnType<typeof createClient>>, r: Row): Promise<TemplateCard | null> {
  const parsed = parseDesign(r.document);
  if (!parsed.ok || !r.product || !isOccasion(r.occasion)) return null;
  const doc = parsed.value;
  const colorHex = r.product.variants.find((v) => v.color_key === doc.colorKey)?.color_hex ?? r.product.variants[0]?.color_hex ?? "#F2E9D8";
  return {
    id: r.id, slug: r.slug, title: r.title, description: r.description, occasion: r.occasion, occasionLabel: OCCASIONS[r.occasion],
    product: { slug: r.product.slug, name: fr(r.product.name), categorySlug: r.product.category?.slug ?? "default", colorHex,
      zones: (r.product.zones ?? []).map((z) => ({ key: z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm })) },
    document: doc, urls: await imageUrls(client, doc),
  };
}

/** Published templates (RLS: published and product on sale), most popular first. */
export async function listTemplates(filter: { occasion?: string; product?: string }): Promise<TemplateCard[]> {
  if (!isSupabaseConfigured()) return [];
  const client = await createClient();
  let q = client.from("templates").select(SELECT).eq("status", "published").order("popularity", { ascending: false }).order("created_at", { ascending: false }).limit(60);
  if (filter.occasion && isOccasion(filter.occasion)) q = q.eq("occasion", filter.occasion);
  const { data, error } = await q;
  if (error) { logError("templates_read_failed", error); throw new Error("Modèles indisponibles pour le moment."); }
  const cards = await Promise.all(((data ?? []) as unknown as Row[]).map((r) => toCard(client, r)));
  return cards.filter((c): c is TemplateCard => c !== null && (!filter.product || c.product.slug === filter.product));
}

/** One published template for the customer assistant (null if unknown, unpublished or for another product). */
export async function publishedTemplate(slug: string, productSlug: string): Promise<TemplateCard | null> {
  if (!isSupabaseConfigured()) return null;
  const client = await createClient();
  const { data, error } = await client.from("templates").select(SELECT).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) { logError("template_read_failed", error, { slug }); return null; }
  const card = data ? await toCard(client, data as unknown as Row) : null;
  return card && card.product.slug === productSlug && card.document.product === productSlug ? card : null;
}

/** Any template, for the catalogue team editing it in the studio (RLS lets only them read drafts). */
export async function templateForEdit(id: string) {
  const client = await createClient();
  const { data } = await client.from("templates").select("id, slug, title, status, document, product:base_products(slug)").eq("id", id).maybeSingle();
  if (!data) return null;
  const parsed = parseDesign(data.document);
  if (!parsed.ok) return null;
  return {
    id: data.id as string, slug: data.slug as string, title: data.title as string, status: data.status as string,
    productSlug: (data.product as unknown as { slug: string } | null)?.slug ?? "", document: parsed.value, urls: await imageUrls(client, parsed.value),
  };
}
