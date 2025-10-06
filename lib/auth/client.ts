// ─────────────────────────────────────────────────────────────────────────────


export type FirmSize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';


export type LoginFormValues = { username: string; password: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoginResponse = { token?: string; access_token?: string; [k: string]: any };


export function setAuthCookie(token: string, days = 1) {
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const sameSite = isHttps ? 'None' : 'Lax';
const secure = isHttps ? '; Secure' : '';
const expires = new Date(Date.now() + days * 864e5).toUTCString();
document.cookie = `accessToken=${encodeURIComponent(token)}; Expires=${expires}; Path=/; SameSite=${sameSite}${secure}`;
}
