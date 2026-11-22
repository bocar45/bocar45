import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/** E24c: public pages are indexed; accounts, workshop and admin spaces, APIs and sign-in are not. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/pro", "/compte", "/api", "/connexion", "/auth", "/deconnexion", "/signaler", "/acces-refuse"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
