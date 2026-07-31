import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

// 제목 학원 서버 전용 로직 — 이미지 저장·조회·솔로 판정.

export const TT_BUCKET = "title-photos";
export const REPORT_THRESHOLD = 3; // 신고 누적 이 값이면 자동 숨김
export const TITLE_MAX = 60; // 제목 글자 수 상한
export const COMMENT_MAX = 500;

// dataURL(webp/png/jpeg) → Buffer + contentType. 형식이 이상하면 null.
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const m = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  return { buffer: Buffer.from(m[2], "base64"), contentType: m[1] };
}

// Storage 업로드 → 저장 경로 반환.
export async function uploadPhoto(
  sb: SupabaseClient,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ error: string | null }> {
  const { error } = await sb.storage.from(TT_BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) return { error: error.message };
  return { error: null };
}

// 조회용 URL. 버킷이 공개라 고정 public URL 을 쓴다(서명 왕복·만료 없음).
export function photoUrl(sb: SupabaseClient, path: string): string {
  return sb.storage.from(TT_BUCKET).getPublicUrl(path).data.publicUrl;
}

// 솔로모드 계정인지. 제목 학원은 사회적 게임이라 솔로 계정은 참여를 막는다.
export async function isSoloAccount(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await sb.from("ma_accounts").select("solo").eq("id", id).maybeSingle();
  return !!data?.solo;
}
