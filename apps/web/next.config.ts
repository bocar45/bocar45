import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const config: NextConfig = {
  transpilePackages: ["@sawwa/domain", "@sawwa/pricing", "@sawwa/workflow", "@sawwa/catalog", "@sawwa/design", "@sawwa/render"],
  poweredByHeader: false,
  // E24a: security headers on every response (CSP, HSTS, no framing…)
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, dev: process.env.NODE_ENV !== "production" }) }];
  },
  // Design documents may carry vector layers (≤ 300 KB each); the whole document is capped at 1.5 MB in @sawwa/design.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Native renderer for production files; fonts are shipped with the function that renders them.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  outputFileTracingIncludes: { "/api/production/[fulfillmentId]": ["../../packages/render/fonts/**"] },
};

export default config;
