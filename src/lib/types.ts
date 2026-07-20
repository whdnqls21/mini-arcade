// Supabase 테이블 행 타입 (schema.sql, prefix ma_).

export type Scoring = "high" | "low" | "time"; // 정렬 방향

export interface Account {
  id: string;
  name: string;
  active: boolean;
  // pin_hash 는 서버에서만 다루며 클라이언트로 내려보내지 않는다.
  created_at: string;
}

export interface Game {
  slug: string;
  name: string;
  description: string | null;
  scoring: Scoring;
  active: boolean;
  sort: number;
  created_at: string;
}

export interface Score {
  id: string;
  account_id: string;
  game_slug: string;
  score: number; // time 게임은 밀리초
  meta: Record<string, unknown> | null;
  created_at: string;
}
