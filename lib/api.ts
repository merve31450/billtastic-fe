// src/lib/api.ts
import nextConfig from "@/next.config";
import axios, {
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";

const TOKEN_KEY = "accessToken";


/* ---------------- Token & redirect ------------ */
function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.split("=")[1];
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || getCookie(TOKEN_KEY);
  } catch {
    return getCookie(TOKEN_KEY);
  }
}

export function setAuthCookie(token: string, days = 1) {
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const sameSite = isHttps ? "None" : "Lax";
  const secure = isHttps ? "; Secure" : "";
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `accessToken=${encodeURIComponent(token)}; Expires=${expires}; Path=/; SameSite=${sameSite}${secure}`;
}

function attachToken(cfg: InternalAxiosRequestConfig) {
  // ❌ if (isAuthPath(cfg)) return cfg;
  const token = getToken();
  if (token) {
    const raw = cfg.headers ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = raw instanceof AxiosHeaders ? raw : AxiosHeaders.from(raw as any);
    headers.set("Authorization", `Bearer ${token}`);
    cfg.headers = headers;
  }
  return cfg;
}
function resolveApiBase() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    // env yoksa aynı origin altındaki /api'ye düş
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  }
  // SSR için son çare (gerekmez ama boşta kalmasın)
  return "http://localhost:8080/api";
}
/* --------------- API Instance (Tek Gateway) --------------- */
export const api = axios.create({
  baseURL: resolveApiBase(),
  withCredentials: true,               // backend cookie set ediyorsa açık kalsın
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(attachToken);

// Küçük bugfix:
export function logoutAndRedirect() {
  deleteCookie("accessToken");
  try { localStorage.removeItem("accessToken"); } catch {}
  window.location.href = `${nextConfig.basePath}/login`; // backtick DÜZELTİLDİ
}


// Request interceptor - token ekle
api.interceptors.request.use(attachToken);

// Response interceptor - 401'de logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      logoutAndRedirect();
    }
    return Promise.reject(error);
  }
);
export const authApi = axios.create({
  baseURL: resolveApiBase(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
