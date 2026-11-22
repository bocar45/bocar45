import type { MetadataRoute } from "next";
import { loadPublicCatalog } from "@/lib/catalog-public";
import { logError } from "@/lib/log";
import { siteUrl, templateMetadata } from "@/lib/seo";
import { listTemplates } from "@/lib/templates";

export const revalidate = 3600;

/** E24c: home, catalogue, categories, product pages, templates gallery and published templates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/catalogue`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/modeles`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/devis`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...["mentions-legales", "cgv", "confidentialite"].map((p) => ({ url: `${base}/${p}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
  try {
    const catalog = await loadPublicCatalog();
    for (const c of catalog?.categories ?? []) pages.push({ url: `${base}/catalogue/${c.slug}`, changeFrequency: "weekly", priority: 0.7 });
    for (const p of catalog?.products ?? []) pages.push({ url: `${base}/produits/${p.slug}`, changeFrequency: "weekly", priority: 0.8 });
  } catch (e) { logError("sitemap_catalog_failed", e); }
  try {
    for (const t of await listTemplates({})) pages.push({ url: `${base}${templateMetadata(t).alternates.canonical}`, changeFrequency: "monthly", priority: 0.5 }); // same canonical as the page
  } catch (e) { logError("sitemap_templates_failed", e); }
  return pages;
}
