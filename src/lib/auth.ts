import "server-only";

import crypto from "node:crypto";

import { cookies } from "next/headers";

// 경량 세션. PIN 검증 성공 후 서명된 httpOnly 쿠키를 심는다.
// 서명 키는 서버 전용 비밀(service_role 키)에서 파생.

export const ACCOUNT_COOKIE = "ma_session";
export const ADMIN_COOKIE = "ma_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

export interface AccountSession {
  role: "account";
  id: string;
  name: string;
}
export interface AdminSession {
  role: "admin";
  at: number; // 발급 시각(ms). 관리자 세션은 짧게만 유지한다.
}

// 관리자 세션 유효 시간. 이 시간이 지나면 PIN 을 다시 요구한다.
export const ADMIN_SESSION_MS = 10 * 60 * 1000; // 10분

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 없어 세션 서명을 할 수 없습니다.");
  return s;
}

export function signSession(payload: AccountSession | AdminSession): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${mac}`;
}

function verifyToken(token: string | undefined): unknown {
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  const macBuf = Buffer.from(mac);
  const expBuf = Buffer.from(expected);
  if (macBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(macBuf, expBuf)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return null;
  }
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

// 관리자 쿠키는 브라우저 세션 쿠키(maxAge 없음)로 심어 탭을 닫으면 사라지게 한다.
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export async function getAccountSession(): Promise<AccountSession | null> {
  const jar = await cookies();
  const payload = verifyToken(jar.get(ACCOUNT_COOKIE)?.value);
  if (payload && typeof payload === "object" && (payload as AccountSession).role === "account") {
    return payload as AccountSession;
  }
  return null;
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const payload = verifyToken(jar.get(ADMIN_COOKIE)?.value);
  if (!payload || typeof payload !== "object") return false;
  const session = payload as AdminSession;
  if (session.role !== "admin") return false;
  // 발급 후 ADMIN_SESSION_MS 가 지나면 만료 — PIN 재확인 필요.
  if (typeof session.at !== "number" || Date.now() - session.at > ADMIN_SESSION_MS) return false;
  return true;
}
