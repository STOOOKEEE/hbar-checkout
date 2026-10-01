import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@hbar-checkout/checkout"],
  poweredByHeader: false,
  agentRules: false,
};
export default config;
