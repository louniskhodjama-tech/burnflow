import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  serverExternalPackages: ["web-push", "nodemailer", "node-cron", "pg"],
};

export default nextConfig;
