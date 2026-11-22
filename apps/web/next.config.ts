import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@sawwa/domain", "@sawwa/pricing", "@sawwa/workflow", "@sawwa/catalog"],
  poweredByHeader: false,
};

export default config;
