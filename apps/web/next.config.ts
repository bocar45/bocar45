import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@sawwa/domain", "@sawwa/pricing", "@sawwa/workflow", "@sawwa/catalog", "@sawwa/design", "@sawwa/render"],
  poweredByHeader: false,
  // Native renderer for production files; fonts are shipped with the function that renders them.
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  outputFileTracingIncludes: { "/api/production/[fulfillmentId]": ["../../packages/render/fonts/**"] },
};

export default config;
