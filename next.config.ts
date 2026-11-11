import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "512kb" } },
  poweredByHeader: false,
};
export default config;
