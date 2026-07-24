import "server-only";

import { getAccountSession, isAdmin } from "./auth";
import { drawingUrl } from "./catchmind/server";
import { createServiceClient } from "./supabase/server";
import type { Account, Game, Score, Scoring } from "./types";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LeaderRow {
  accountId: string;
  name: string;
  best: number;
  rank: number;
}

export interface GameView extends Game {
  myBest: number | null;
  mySoloBest: number | null; // 솔로모드에서 세운 기록만의 베스트(내정보 솔로 표시용)
  leaderboard: LeaderRow[];
}
// GameView 는 Game 을 확장하므로 reset_at/reset_note 가 이미 포함된다.

export interface AppState {
  session: { id: string; name: string; solo: boolean } | null;
  isAdmin: boolean;
  games: GameView[];
}

// high·htime 은 클수록 상위, time·low 는 작을수록 상위.
const isHigh = (scoring: Scoring) => scoring === "high" || scoring === "htime";
const better = (scoring: Scoring, a: number, b: number) =>
  isHigh(scoring) ? Math.max(a, b) : Math.min(a, b);
const sortDir = (scoring: Scoring) => (isHigh(scoring) ? -1 : 1); // 내림차순=상위 먼저

// (게임×계정)별 점수 집계. ma_scores 전량 조회 대신 DB 뷰(ma_scores_agg)에서 받는다.
// 뷰가 없으면(마이그레이션 전) ma_scores 를 받아 JS 로 집계(폴백).
interface ScoreAgg {
  game_slug: string;
  account_id: string;
  max_all: number;
  min_all: number;
  max_solo: number | null;
  min_solo: number | null;
  plays: number;
}

async function fetchScoreAgg(sb: SupabaseClient): Promise<ScoreAgg[]> {
  const viewRes = await sb
    .from("ma_scores_agg")
    .select("game_slug,account_id,max_all,min_all,max_solo,min_solo,plays");
  if (!viewRes.error && viewRes.data) return viewRes.data as ScoreAgg[];

  console.warn("ma_scores_agg 뷰 없음 — ma_scores 폴백", viewRes.error?.message);
  const { data } = await sb.from("ma_scores").select("account_id,game_slug,score,meta");
  const m = new Map<string, ScoreAgg>();
  for (const s of (data ?? []) as {
    account_id: string;
    game_slug: string;
    score: number;
    meta: Record<string, unknown> | null;
  }[]) {
    const key = `${s.game_slug}|${s.account_id}`;
    let r = m.get(key);
    if (!r) {
      r = { game_slug: s.game_slug, account_id: s.account_id, max_all: s.score, min_all: s.score, max_solo: null, min_solo: null, plays: 0 };
      m.set(key, r);
    }
    r.max_all = Math.max(r.max_all, s.score);
    r.min_all = Math.min(r.min_all, s.score);
    r.plays += 1;
    if (s.meta && s.meta.solo === true) {
      r.max_solo = r.max_solo == null ? s.score : Math.max(r.max_solo, s.score);
      r.min_solo = r.min_solo == null ? s.score : Math.min(r.min_solo, s.score);
    }
  }
  return [...m.values()];
}

export async function buildState(): Promise<AppState> {
  const sb = createServiceClient();
  const [session, admin, gRes, agg, aRes] = await Promise.all([
    getAccountSession(),
    isAdmin(),
    sb.from("ma_games").select("*").eq("active", true).order("sort"),
    fetchScoreAgg(sb),
    sb.from("ma_accounts").select("id,name,active,solo,created_at").eq("active", true),
  ]);

  const games = (gRes.data ?? []) as Game[];
  const accounts = (aRes.data ?? []) as Account[];
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const soloById = new Map(accounts.map((a) => [a.id, a.solo]));

  // 게임별 집계 행 묶기.
  const aggByGame = new Map<string, ScoreAgg[]>();
  for (const r of agg) {
    const list = aggByGame.get(r.game_slug) ?? [];
    list.push(r);
    aggByGame.set(r.game_slug, list);
  }

  const gameViews: GameView[] = games.map((g) => {
    const high = isHigh(g.scoring);
    const bestAll = (r: ScoreAgg) => (high ? r.max_all : r.min_all);
    const bestSolo = (r: ScoreAgg) => (high ? r.max_solo : r.min_solo);

    // 내 베스트는 솔로 여부와 무관하게 계산. 솔로 베스트는 meta.solo 기록만.
    let myBest: number | null = null;
    let mySoloBest: number | null = null;
    const rows: LeaderRow[] = [];
    for (const r of aggByGame.get(g.slug) ?? []) {
      if (session && r.account_id === session.id) {
        myBest = bestAll(r);
        mySoloBest = bestSolo(r);
      }
      if (!nameById.has(r.account_id)) continue; // 비활성/삭제 계정 제외
      if (soloById.get(r.account_id)) continue; // 솔로모드 계정은 리더보드에서 제외
      rows.push({ accountId: r.account_id, name: nameById.get(r.account_id) ?? "", best: bestAll(r), rank: 0 });
    }
    rows.sort((x, y) => (x.best - y.best) * sortDir(g.scoring));
    rows.forEach((r, i) => {
      r.rank = i > 0 && rows[i - 1].best === r.best ? rows[i - 1].rank : i + 1;
    });

    return { ...g, myBest, mySoloBest, leaderboard: rows };
  });

  return {
    session: session
      ? { id: session.id, name: session.name, solo: soloById.get(session.id) ?? false }
      : null,
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
// 캐치마인드에서 신고 누적으로 자동 숨김된 그림(관리자 검토 대상)
export interface AdminHiddenQuiz {
  id: string;
  authorName: string;
  word: string;
  reportCount: number;
  reasons: string[]; // 신고 사유(한글 라벨)
  imageUrl: string | null; // 서명 URL
  createdAt: string;
}
export interface AdminState {
  adminPinSet: boolean;
  accounts: AdminAccount[];
  games: AdminGame[];
  hiddenQuizzes: AdminHiddenQuiz[];
}

const CM_REASON_LABEL: Record<string, string> = {
  lazy: "성의없음",
  inappropriate: "부적절",
  answer_leak: "정답유출",
};

// 신고 누적으로 숨겨진(미삭제) 그림들을 검토용으로 모은다. 테이블이 없으면 []（error 무시).
async function buildHiddenQuizzes(
  sb: SupabaseClient,
  nameById: Map<string, string>
): Promise<AdminHiddenQuiz[]> {
  const { data } = await sb
    .from("ma_cm_quizzes")
    .select("id,author_id,word_id,image_path,report_count,created_at")
    .eq("is_hidden", true)
    .eq("is_deleted", false)
    .order("report_count", { ascending: false });
  const quizzes = (data ?? []) as {
    id: string;
    author_id: string;
    word_id: number;
    image_path: string;
    report_count: number;
    created_at: string;
  }[];
  if (quizzes.length === 0) return [];

  const wordIds = [...new Set(quizzes.map((q) => q.word_id))];
  const quizIds = quizzes.map((q) => q.id);
  const [wRes, rRes] = await Promise.all([
    sb.from("ma_cm_words").select("id,text").in("id", wordIds),
    sb.from("ma_cm_reports").select("quiz_id,reason").in("quiz_id", quizIds),
  ]);
  const wordById = new Map(((wRes.data ?? []) as { id: number; text: string }[]).map((w) => [w.id, w.text]));
  const reasonsByQuiz = new Map<string, string[]>();
  for (const r of (rRes.data ?? []) as { quiz_id: string; reason: string | null }[]) {
    const label = r.reason ? CM_REASON_LABEL[r.reason] ?? r.reason : "기타";
    const arr = reasonsByQuiz.get(r.quiz_id) ?? [];
    arr.push(label);
    reasonsByQuiz.set(r.quiz_id, arr);
  }

  const out: AdminHiddenQuiz[] = [];
  for (const q of quizzes) {
    out.push({
      id: q.id,
      authorName: nameById.get(q.author_id) ?? "(탈퇴)",
      word: wordById.get(q.word_id) ?? "",
      reportCount: q.report_count,
      reasons: reasonsByQuiz.get(q.id) ?? [],
      imageUrl: drawingUrl(sb, q.image_path),
      createdAt: q.created_at,
    });
  }
  return out;
}

export async function buildAdminState(): Promise<AdminState> {
  const sb = createServiceClient();
  const [setRes, aRes, agg, gRes] = await Promise.all([
    sb.from("ma_settings").select("admin_pin_hash").eq("id", 1).maybeSingle(),
    sb.from("ma_accounts").select("id,name,active,created_at").order("created_at"),
    fetchScoreAgg(sb),
    sb.from("ma_games").select("*").order("sort"),
  ]);
  const accounts = (aRes.data ?? []) as Account[];
  const playCount = new Map<string, number>();
  const scoreCount = new Map<string, number>();
  for (const r of agg) {
    playCount.set(r.account_id, (playCount.get(r.account_id) ?? 0) + r.plays);
    scoreCount.set(r.game_slug, (scoreCount.get(r.game_slug) ?? 0) + r.plays);
  }

  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const hiddenQuizzes = await buildHiddenQuizzes(sb, nameById);

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
    hiddenQuizzes,
  };
}
