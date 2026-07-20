import "server-only";

import { getAccountSession, isAdmin } from "./auth";
import { createServiceClient } from "./supabase/server";
import type { Account, Game, Score, Scoring } from "./types";

export interface LeaderRow {
  accountId: string;
  name: string;
  best: number;
  rank: number;
}

export interface GameView extends Game {
  myBest: number | null;
  leaderboard: LeaderRow[];
}
// GameView 는 Game 을 확장하므로 reset_at/reset_note 가 이미 포함된다.

export interface AppState {
  session: { id: string; name: string } | null;
  isAdmin: boolean;
  games: GameView[];
}

const better = (scoring: Scoring, a: number, b: number) =>
  scoring === "high" ? Math.max(a, b) : Math.min(a, b);
const sortDir = (scoring: Scoring) => (scoring === "high" ? -1 : 1); // high=내림차순

export async function buildState(): Promise<AppState> {
  const sb = createServiceClient();
  const [session, admin, gRes, sRes, aRes] = await Promise.all([
    getAccountSession(),
    isAdmin(),
    sb.from("ma_games").select("*").eq("active", true).order("sort"),
    sb.from("ma_scores").select("*"),
    sb.from("ma_accounts").select("id,name,active,created_at").eq("active", true),
  ]);

  const games = (gRes.data ?? []) as Game[];
  const scores = (sRes.data ?? []) as Score[];
  const accounts = (aRes.data ?? []) as Account[];
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));

  const gameViews: GameView[] = games.map((g) => {
    // 계정별 베스트 (활성 계정만)
    const bestByAccount = new Map<string, number>();
    for (const s of scores) {
      if (s.game_slug !== g.slug) continue;
      if (!nameById.has(s.account_id)) continue; // 비활성/삭제 계정 제외
      const cur = bestByAccount.get(s.account_id);
      bestByAccount.set(s.account_id, cur == null ? s.score : better(g.scoring, cur, s.score));
    }
    const rows = [...bestByAccount.entries()]
      .map(([accountId, best]) => ({ accountId, name: nameById.get(accountId) ?? "", best, rank: 0 }))
      .sort((x, y) => (x.best - y.best) * sortDir(g.scoring));
    rows.forEach((r, i) => {
      r.rank = i > 0 && rows[i - 1].best === r.best ? rows[i - 1].rank : i + 1;
    });

    return {
      ...g,
      myBest: session ? bestByAccount.get(session.id) ?? null : null,
      leaderboard: rows,
    };
  });

  return {
    session: session ? { id: session.id, name: session.name } : null,
    isAdmin: admin,
    games: gameViews,
  };
}

// ── 관리자용: 계정 목록(전체) ────────────────────────────────────────
export interface AdminAccount {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  playCount: number;
}
export interface AdminGame extends Game {
  scoreCount: number; // 이 게임에 쌓인 기록 수(초기화 시 지워질 양)
}
export interface AdminState {
  adminPinSet: boolean;
  accounts: AdminAccount[];
  games: AdminGame[];
}

export async function buildAdminState(): Promise<AdminState> {
  const sb = createServiceClient();
  const [setRes, aRes, sRes, gRes] = await Promise.all([
    sb.from("ma_settings").select("admin_pin_hash").eq("id", 1).maybeSingle(),
    sb.from("ma_accounts").select("id,name,active,created_at").order("created_at"),
    sb.from("ma_scores").select("account_id,game_slug"),
    sb.from("ma_games").select("*").order("sort"),
  ]);
  const accounts = (aRes.data ?? []) as Account[];
  const scores = (sRes.data ?? []) as { account_id: string; game_slug: string }[];
  const playCount = new Map<string, number>();
  const scoreCount = new Map<string, number>();
  for (const s of scores) {
    playCount.set(s.account_id, (playCount.get(s.account_id) ?? 0) + 1);
    scoreCount.set(s.game_slug, (scoreCount.get(s.game_slug) ?? 0) + 1);
  }

  return {
    adminPinSet: !!(setRes.data as { admin_pin_hash: string | null } | null)?.admin_pin_hash,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      active: a.active,
      created_at: a.created_at,
      playCount: playCount.get(a.id) ?? 0,
    })),
    games: ((gRes.data ?? []) as Game[]).map((g) => ({
      ...g,
      scoreCount: scoreCount.get(g.slug) ?? 0,
    })),
  };
}
