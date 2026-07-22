import type { Scoring } from "./types";

// 점수 표시 (클라이언트/서버 공용). time·htime 은 ms → 초(소수점 2자리).
export function formatScore(scoring: Scoring, v: number): string {
  if (scoring === "time" || scoring === "htime") return `${(v / 1000).toFixed(2)}초`;
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
