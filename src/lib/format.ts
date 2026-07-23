import type { Scoring } from "./types";

// 게임별 초 표시 소수 자릿수(기본 2자리). 반응속도류는 ms 단위 변별이 필요해 3자리.
const SECONDS_DECIMALS: Record<string, number> = { greenlight: 3 };

// 점수 표시 (클라이언트/서버 공용). time·htime 은 ms → 초.
export function formatScore(scoring: Scoring, v: number, slug?: string): string {
  if (scoring === "time" || scoring === "htime") {
    const digits = slug ? SECONDS_DECIMALS[slug] ?? 2 : 2;
    return `${(v / 1000).toFixed(digits)}초`;
  }
  return v.toLocaleString("en-US");
}

export const scoringLabel: Record<Scoring, string> = {
  high: "고득점 순",
  low: "저점 순",
  time: "빠른 기록 순",
  htime: "오래 버틴 순",
};

// 상대 시간 — "방금 · N분 전 · N시간 전 · N일 전", 그 이상은 날짜.
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
