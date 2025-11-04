// src/lib/api.ts
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

/* ------------------------------------------------------------------ */
/* 1) TEK NOKTADAN BACKEND ADRESİ                                     */
/* ------------------------------------------------------------------ */
const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8080/api";

/* ------------------------------------------------------------------ */
/* 2) TOKEN YARDIMCILARI                                              */
/* ------------------------------------------------------------------ */
const TOKEN_KEY = "accessToken";

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.split("=")[1];
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || getCookie(TOKEN_KEY);
  } catch {
    return getCookie(TOKEN_KEY);
  }
}

export function setAuthCookie(token: string, days = 1) {
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const sameSite = isHttps ? "None" : "Lax";
  const secure = isHttps ? "; Secure" : "";
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(
    token
  )}; Expires=${expires}; Path=/; SameSite=${sameSite}${secure}`;
}

/* ------------------------------------------------------------------ */
/* 3) TOKEN INTERCEPTOR                                               */
/* ------------------------------------------------------------------ */
function attachToken(cfg: InternalAxiosRequestConfig) {
  const token = getToken();
  if (token) {
    const raw = cfg.headers ?? {};
    const headers =
      raw instanceof AxiosHeaders
        ? raw
        : AxiosHeaders.from(raw as Record<string, string>);
    headers.set("Authorization", `Bearer ${token}`);
    cfg.headers = headers;
  }
  return cfg;
}

/* ------------------------------------------------------------------ */
/* 4) ORTAK AXIOS INSTANCE                                            */
/* ------------------------------------------------------------------ */
export const api = axios.create({
  baseURL: BACKEND_BASE,
  withCredentials: false, //  cookie taşımıyorsun, JWT header kullanıyorsun
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(attachToken);

/* ------------------------------------------------------------------ */
/* 5) KULLANIM KOLAYLIĞI                                              */
/* ------------------------------------------------------------------ */
export const authApi = api;

/* ------------------------------------------------------------------ */
/* 6) DEBUG BİLGİSİ                                                   */
/* ------------------------------------------------------------------ */
if (typeof window !== "undefined") {
  console.info("🌐 API baseURL:", BACKEND_BASE);
}
