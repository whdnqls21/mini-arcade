import type { Scoring } from "./types";

// 점수 표시 (클라이언트/서버 공용). time 은 ms → 초.
export function formatScore(scoring: Scoring, v: number): string {
  if (scoring === "time") return `${(v / 1000).toFixed(2)}초`;
  return v.toLocaleString("en-US");
}

export const scoringLabel: Record<Scoring, string> = {
  high: "고득점 순",
  low: "저점 순",
  time: "빠른 기록 순",
};
