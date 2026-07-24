import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

// 캐치마인드 서버 전용 로직 — 힌트 계산·정답 판정·점수표·이미지 저장.

export const CM_BUCKET = "cm-drawings";
export const MAX_TRIES = 3;
export const REPORT_THRESHOLD = 3; // 신고 누적 이 값이면 자동 숨김

// 시도 회차(1·2·3)별 점수. 빨리 맞출수록 정답자·출제자 모두 많이 받는다.
const SOLVER_POINTS = [30, 20, 10];
const AUTHOR_POINTS = [10, 5, 3];
export function solverScore(tryNo: number): number {
  return SOLVER_POINTS[tryNo - 1] ?? 0;
}
export function authorScore(tryNo: number): number {
  return AUTHOR_POINTS[tryNo - 1] ?? 0;
}

// 정답 판정용 정규화: 앞뒤 공백 제거 + 모든 공백 제거 + 소문자.
export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, "").toLowerCase();
}

// 한글 초성 추출. 한글이 아니면 원문 글자를 그대로 둔다.
const CHOSUNG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
export function chosung(text: string): string {
  let out = "";
  for (const ch of text.replace(/\s+/g, "")) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHOSUNG[Math.floor((code - 0xac00) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

// 정답 글자 수(공백 제외).
export function answerLength(text: string): number {
  return text.replace(/\s+/g, "").length;
}

// 시도 단계에 따라 이번 시도에 보여줄 힌트.
//  tries=0(1차) → 없음 / tries=1(2차) → 글자 수 / tries=2(3차) → 초성 전체
export function hintForTry(word: string, tries: number): string | null {
  if (tries <= 0) return null;
  if (tries === 1) return "○".repeat(answerLength(word)) + ` (${answerLength(word)}글자)`;
  return chosung(word);
}

// dataURL(webp/png) → Buffer + contentType. 형식이 이상하면 null.
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const m = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  return { buffer: Buffer.from(m[2], "base64"), contentType: m[1] };
}

// Storage 업로드 → 저장 경로 반환.
export async function uploadDrawing(
  sb: SupabaseClient,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ error: string | null }> {
  const { error } = await sb.storage.from(CM_BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) return { error: error.message };
  return { error: null };
}

// 솔로모드 계정인지. 캐치마인드는 사회적 게임이라 솔로 계정은 참여를 막는다.
export async function isSoloAccount(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await sb.from("ma_accounts").select("solo").eq("id", id).maybeSingle();
  return !!data?.solo;
}

// 조회용 URL. 버킷이 공개라 고정 public URL 을 쓴다(서명 왕복·만료 없음 →
// URL 이 안정적이라 브라우저/CDN 캐시가 적중해 재방문이 즉시 뜬다).
export function drawingUrl(sb: SupabaseClient, path: string): string {
  return sb.storage.from(CM_BUCKET).getPublicUrl(path).data.publicUrl;
}
