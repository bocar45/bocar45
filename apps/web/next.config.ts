import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@sawwa/domain", "@sawwa/pricing", "@sawwa/workflow"],
  poweredByHeader: false,
};

export default config;
