import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@sawwa/domain", "@sawwa/pricing", "@sawwa/workflow", "@sawwa/catalog", "@sawwa/design"],
  poweredByHeader: false,
};

export default config;
