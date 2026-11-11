import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist"],
  experimental: { serverActions: { bodySizeLimit: "512kb" } },
  poweredByHeader: false,
};
export default config;
