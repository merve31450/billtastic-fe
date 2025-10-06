// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: { root: __dirname },   // ✨ yanlış root algısını engeller
  images: { unoptimized: true },    // dev’de optimize etmeye çalışma
};

export default nextConfig;
