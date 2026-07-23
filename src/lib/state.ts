import "server-only";

import { getAccountSession, isAdmin } from "./auth";
import { signDrawing } from "./catchmind/server";
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

export async function buildState(): Promise<AppState> {
  const sb = createServiceClient();
  const [session, admin, gRes, sRes, aRes] = await Promise.all([
    getAccountSession(),
    isAdmin(),
    sb.from("ma_games").select("*").eq("active", true).order("sort"),
    sb.from("ma_scores").select("*"),
    sb.from("ma_accounts").select("id,name,active,solo,created_at").eq("active", true),
  ]);

  const games = (gRes.data ?? []) as Game[];
  const scores = (sRes.data ?? []) as Score[];
  const accounts = (aRes.data ?? []) as Account[];
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const soloById = new Map(accounts.map((a) => [a.id, a.solo]));

  const gameViews: GameView[] = games.map((g) => {
    // 계정별 베스트 (활성 + 솔로모드 아닌 계정만) — 리더보드용.
    const bestByAccount = new Map<string, number>();
    // 내 베스트는 솔로 여부와 무관하게 항상 계산한다(내정보/게임 화면에서 보여준다).
    let myBest: number | null = null;
    // 솔로모드에서 세운 기록만의 베스트(meta.solo === true).
    let mySoloBest: number | null = null;
    for (const s of scores) {
      if (s.game_slug !== g.slug) continue;
      if (session && s.account_id === session.id) {
        myBest = myBest == null ? s.score : better(g.scoring, myBest, s.score);
        if (s.meta && (s.meta as Record<string, unknown>).solo === true) {
          mySoloBest = mySoloBest == null ? s.score : better(g.scoring, mySoloBest, s.score);
        }
      }
      if (!nameById.has(s.account_id)) continue; // 비활성/삭제 계정 제외
      if (soloById.get(s.account_id)) continue; // 솔로모드 계정은 리더보드에서 제외
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
      myBest,
      mySoloBest,
      leaderboard: rows,
    };
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
      imageUrl: await signDrawing(sb, q.image_path),
      createdAt: q.created_at,
    });
  }
  return out;
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
