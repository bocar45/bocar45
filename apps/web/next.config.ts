import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@sawwa/domain", "@sawwa/pricing", "@sawwa/workflow", "@sawwa/catalog", "@sawwa/design", "@sawwa/render"],
  poweredByHeader: false,
  // Design documents may carry vector layers (≤ 300 KB each); the whole document is capped at 1.5 MB in @sawwa/design.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Native renderer for production files; fonts are shipped with the function that renders them.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  outputFileTracingIncludes: { "/api/production/[fulfillmentId]": ["../../packages/render/fonts/**"] },
};

export default config;
