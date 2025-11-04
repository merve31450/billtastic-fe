import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: { root: __dirname },
  images: { unoptimized: true },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
    ];
  },

  // 🔑 Sadece geliştirmede HMR’i açmak için:
  allowedDevOrigins: ["http://localhost:3000"],
};

export default nextConfig;

