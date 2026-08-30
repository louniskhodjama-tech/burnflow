import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone uniquement pour l'image Docker (Linux) : la copie des fichiers
  // tracés crée des symlinks, interdits sous Windows sans mode développeur.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  serverExternalPackages: ["web-push", "nodemailer", "node-cron", "pg"],
};

export default nextConfig;
