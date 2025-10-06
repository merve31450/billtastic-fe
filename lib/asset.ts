// src/lib/asset.ts
import nextConfig from "@/next.config";
export function asset(p: string) {
  const bp = nextConfig.basePath || "";
  return `${bp}${p.startsWith("/") ? "" : "/"}${p}`;
}
