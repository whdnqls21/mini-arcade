import "server-only";

import { getAccountSession, isAdmin } from "./auth";
import { drawingUrl } from "./catchmind/server";
import { EARN_COND } from "./icons";
import { createServiceClient } from "./supabase/server";
import type { Account, Game, Score, Scoring } from "./types";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LeaderRow {
  accountId: string;
  name: string;
  icon: string | null; // 닉네임 옆 아이콘 키
  title: string | null; // 칭호 키(획득 아이콘 키)
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
  session: {
    id: string;
    name: string;
    solo: boolean;
    icon: string | null; // 현재 장착 아이콘 키
    title: string | null; // 현재 칭호 키(획득 아이콘 키)
    bio: string | null; // 한 줄 소개
    // 아이콘 선택 UI 용 — granted: 이미 영구 획득, eligible: 지금 조건 충족(장착 시 영구 획득)
    icons: { granted: string[]; eligible: string[] };
    newlyEarned: string[]; // 이번 로드에서 새로 영구 획득한 아이콘(획득 알림용). 한 번만 채워진다.
  } | null;
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

// ── 닉네임 꾸미기(아이콘·칭호·소개) ──────────────────────────────────
// 계정별 장착 정보. title/bio 컬럼이 아직 없으면(마이그레이션 전) icon 만이라도 받고,
// icon 도 없으면 빈 맵으로 조용히 폴백한다.
export interface Deco {
  icon: string | null;
  title: string | null;
  bio: string | null;
}
async function fetchDeco(sb: SupabaseClient): Promise<Map<string, Deco>> {
  let res = await sb.from("ma_accounts").select("id,icon,title,bio");
  if (res.error) res = await sb.from("ma_accounts").select("id,icon"); // title/bio 마이그레이션 전
  if (res.error) return new Map();
  return new Map(
    ((res.data ?? []) as { id: string; icon?: string | null; title?: string | null; bio?: string | null }[]).map(
      (r) => [r.id, { icon: r.icon ?? null, title: r.title ?? null, bio: r.bio ?? null }]
    )
  );
}

// 영구 획득한 아이콘 키들. 테이블이 없으면 조용히 [].
async function fetchGrantedIcons(sb: SupabaseClient, accountId: string): Promise<string[]> {
  const { data, error } = await sb.from("ma_account_icons").select("icon_key").eq("account_id", accountId);
  if (error) return [];
  return ((data ?? []) as { icon_key: string }[]).map((r) => r.icon_key);
}

// 캐치마인드·게시판 기반 조건 판정에 쓰는 계정별 활동 집계.
export interface AccountStats {
  cmAuthored: number; // 캐치마인드 출제 수
  cmSolved: number; // 캐치마인드 정답 수
  cmAuthorSolves: number; // 내 문제가 맞혀진 횟수
  likesReceived: number; // 게시판에서 받은 좋아요 수
  boardActivity: number; // 게시판 글+댓글 수
}
const EMPTY_STATS: AccountStats = {
  cmAuthored: 0,
  cmSolved: 0,
  cmAuthorSolves: 0,
  likesReceived: 0,
  boardActivity: 0,
};

// 한 계정의 활동 집계. 테이블이 없거나 오류면 그 항목만 0(조용히).
export async function computeAccountStats(sb: SupabaseClient, accountId: string): Promise<AccountStats> {
  const head = { count: "exact" as const, head: true };
  const [authored, solved, authorSolved, myPosts, myComments] = await Promise.all([
    sb.from("ma_cm_quizzes").select("id", head).eq("author_id", accountId).eq("is_deleted", false),
    sb.from("ma_cm_attempts").select("id", head).eq("user_id", accountId).eq("is_correct", true),
    sb.from("ma_cm_point_logs").select("id", head).eq("user_id", accountId).eq("reason", "author_solved"),
    sb.from("ma_posts").select("id").eq("account_id", accountId),
    sb.from("ma_post_comments").select("id").eq("account_id", accountId),
  ]);
  const postIds = ((myPosts.data ?? []) as { id: string }[]).map((r) => r.id);
  const commentIds = ((myComments.data ?? []) as { id: string }[]).map((r) => r.id);
  const [postLikes, commentLikes] = await Promise.all([
    postIds.length
      ? sb.from("ma_post_votes").select("post_id", head).in("post_id", postIds)
      : Promise.resolve({ count: 0 }),
    commentIds.length
      ? sb.from("ma_post_comment_votes").select("comment_id", head).in("comment_id", commentIds)
      : Promise.resolve({ count: 0 }),
  ]);
  return {
    cmAuthored: authored.count ?? 0,
    cmSolved: solved.count ?? 0,
    cmAuthorSolves: authorSolved.count ?? 0,
    likesReceived: (postLikes.count ?? 0) + (commentLikes.count ?? 0),
    boardActivity: postIds.length + commentIds.length,
  };
}

// 리더보드(솔로 제외) + 활동 집계 기준으로 accountId 가 지금 조건을 충족하는 획득 아이콘 키.
export function eligibleIcons(input: {
  games: { slug: string; scoring: Scoring }[];
  agg: ScoreAgg[];
  soloIds: Set<string>;
  accountId: string;
  stats?: AccountStats;
}): string[] {
  const { games, agg, soloIds, accountId } = input;
  const stats = input.stats ?? EMPTY_STATS;

  const aggByGame = new Map<string, ScoreAgg[]>();
  for (const r of agg) {
    const list = aggByGame.get(r.game_slug) ?? [];
    list.push(r);
    aggByGame.set(r.game_slug, list);
  }

  // 게임별 내 순위(솔로 계정 제외하고 매김). 내가 솔로면 리더보드에 없어 순위 없음 → 챔피언 불가.
  const myRank = new Map<string, number>();
  for (const g of games) {
    const high = isHigh(g.scoring);
    const rows = (aggByGame.get(g.slug) ?? [])
      .filter((r) => !soloIds.has(r.account_id))
      .map((r) => ({ id: r.account_id, best: high ? r.max_all : r.min_all }));
    rows.sort((a, b) => (a.best - b.best) * sortDir(g.scoring));
    let rank = 0;
    let prev: number | null = null;
    rows.forEach((r, i) => {
      rank = prev !== null && prev === r.best ? rank : i + 1;
      prev = r.best;
      if (r.id === accountId) myRank.set(g.slug, rank);
    });
  }

  const ranks = [...myRank.values()];
  const champCount = ranks.filter((r) => r === 1).length;
  const playedGames = new Set(
    agg.filter((r) => r.account_id === accountId && r.plays > 0).map((r) => r.game_slug)
  );
  const playedAll = games.length > 0 && games.every((g) => playedGames.has(g.slug));
  const myPlays = agg.filter((r) => r.account_id === accountId).reduce((sum, r) => sum + r.plays, 0);

  const out: string[] = [];
  for (const [key, cond] of Object.entries(EARN_COND)) {
    let ok = false;
    switch (cond.kind) {
      case "champion":
        ok = myRank.get(cond.slug) === 1;
        break;
      case "goat":
        ok = games.length > 0 && games.every((g) => myRank.get(g.slug) === 1);
        break;
      case "plays":
        ok = myPlays >= cond.count;
        break;
      case "championsAtLeast":
        ok = champCount >= cond.count;
        break;
      case "anyRank":
        ok = ranks.some((r) => r === cond.rank);
        break;
      case "playedAll":
        ok = playedAll;
        break;
      case "cmAuthored":
        ok = stats.cmAuthored >= cond.count;
        break;
      case "cmSolved":
        ok = stats.cmSolved >= cond.count;
        break;
      case "cmAuthorSolves":
        ok = stats.cmAuthorSolves >= cond.count;
        break;
      case "likesReceived":
        ok = stats.likesReceived >= cond.count;
        break;
      case "boardActivity":
        ok = stats.boardActivity >= cond.count;
        break;
    }
    if (ok) out.push(key);
  }
  return out;
}

// 데이터를 따로 안 들고 있는 라우트(아이콘 장착)용 — 필요한 것만 조회해 판정한다.
// pre 로 games/agg/soloIds 를 넘기면 그만큼 재조회를 아낀다(활동 집계는 항상 새로 조회).
export async function computeEligibleIcons(
  sb: SupabaseClient,
  accountId: string,
  pre?: { games: { slug: string; scoring: Scoring }[]; agg: ScoreAgg[]; soloIds: Set<string> }
): Promise<string[]> {
  const [games, agg, soloIds, stats] = await Promise.all([
    pre?.games ??
      sb
        .from("ma_games")
        .select("slug,scoring")
        .eq("active", true)
        .then((r) => (r.data ?? []) as { slug: string; scoring: Scoring }[]),
    pre?.agg ?? fetchScoreAgg(sb),
    pre?.soloIds ??
      sb
        .from("ma_accounts")
        .select("id")
        .eq("solo", true)
        .then((r) => new Set(((r.data ?? []) as { id: string }[]).map((a) => a.id))),
    computeAccountStats(sb, accountId),
  ]);
  return eligibleIcons({ games, agg, soloIds, accountId, stats });
}

export async function buildState(): Promise<AppState> {
  const sb = createServiceClient();
  const [session, admin, gRes, agg, aRes, decoById] = await Promise.all([
    getAccountSession(),
    isAdmin(),
    sb.from("ma_games").select("*").eq("active", true).order("sort"),
    fetchScoreAgg(sb),
    sb.from("ma_accounts").select("id,name,active,solo,created_at").eq("active", true),
    fetchDeco(sb),
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
      rows.push({
        accountId: r.account_id,
        name: nameById.get(r.account_id) ?? "",
        icon: decoById.get(r.account_id)?.icon ?? null,
        title: decoById.get(r.account_id)?.title ?? null,
        best: bestAll(r),
        rank: 0,
      });
    }
    rows.sort((x, y) => (x.best - y.best) * sortDir(g.scoring));
    rows.forEach((r, i) => {
      r.rank = i > 0 && rows[i - 1].best === r.best ? rows[i - 1].rank : i + 1;
    });

    return { ...g, myBest, mySoloBest, leaderboard: rows };
  });

  let sessionOut: AppState["session"] = null;
  if (session) {
    const soloIds = new Set(accounts.filter((a) => a.solo).map((a) => a.id));
    const [eligible, grantedInit] = await Promise.all([
      computeEligibleIcons(sb, session.id, {
        games: games.map((g) => ({ slug: g.slug, scoring: g.scoring })),
        agg,
        soloIds,
      }),
      fetchGrantedIcons(sb, session.id),
    ]);
    let granted = grantedInit;

    // 자동 획득 — 조건을 충족했는데 아직 기록 안 된 아이콘은 이 순간 영구 획득 처리한다.
    // 신규 달성분만 upsert 하므로 평소(새로 딴 게 없을 때)엔 쓰기가 없다.
    const toGrant = eligible.filter((k) => !granted.includes(k));
    if (toGrant.length > 0) {
      const { error } = await sb.from("ma_account_icons").upsert(
        toGrant.map((icon_key) => ({ account_id: session.id, icon_key })),
        { onConflict: "account_id,icon_key", ignoreDuplicates: true }
      );
      if (error) console.error("아이콘 자동 획득 실패(무시)", error);
      else granted = [...granted, ...toGrant];
    }

    const myDeco = decoById.get(session.id);
    sessionOut = {
      id: session.id,
      name: session.name,
      solo: soloById.get(session.id) ?? false,
      icon: myDeco?.icon ?? null,
      title: myDeco?.title ?? null,
      bio: myDeco?.bio ?? null,
      icons: { granted, eligible },
      newlyEarned: toGrant, // 이번 로드에서 새로 획득한 것(없으면 빈 배열)
    };
  }

  return {
    session: sessionOut,
    isAdmin: admin,
    games: gameViews,
  };
}

// ── 공개 프로필(남의 프로필 보기) ────────────────────────────────────
export interface PublicProfileGame {
  slug: string;
  name: string;
  scoring: Scoring;
  best: number | null;
  rank: number | null; // 솔로모드거나 기록 없으면 null
}
export interface PublicProfile {
  id: string;
  name: string;
  icon: string | null;
  title: string | null;
  bio: string | null;
  createdAt: string;
  solo: boolean;
  isMe: boolean;
  summary: { champions: number; totalPlays: number; iconCount: number };
  games: PublicProfileGame[];
  ownedIcons: string[]; // 영구 획득한 아이콘 키(도감)
  catchmind: { points: number; solved: number; authored: number };
}

// 특정 계정의 공개 프로필을 조립한다. 없거나 비활성이면 null.
export async function buildPublicProfile(
  sb: SupabaseClient,
  targetId: string,
  viewerId: string | null
): Promise<PublicProfile | null> {
  const [tRes, gRes, agg, aRes, owned, cmPoints, cmSolved, cmAuthored] = await Promise.all([
    sb
      .from("ma_accounts")
      .select("id,name,solo,active,created_at,icon,title,bio")
      .eq("id", targetId)
      .maybeSingle(),
    sb.from("ma_games").select("*").eq("active", true).order("sort"),
    fetchScoreAgg(sb),
    sb.from("ma_accounts").select("id,solo").eq("active", true),
    fetchGrantedIcons(sb, targetId),
    sb.from("ma_cm_point_logs").select("amount").eq("user_id", targetId),
    sb.from("ma_cm_attempts").select("id", { count: "exact", head: true }).eq("user_id", targetId).eq("is_correct", true),
    sb.from("ma_cm_quizzes").select("id", { count: "exact", head: true }).eq("author_id", targetId).eq("is_deleted", false),
  ]);

  const t = tRes.data as
    | { id: string; name: string; solo: boolean; active: boolean; created_at: string; icon: string | null; title: string | null; bio: string | null }
    | null;
  if (!t || !t.active) return null;

  const games = (gRes.data ?? []) as Game[];
  const soloIds = new Set(((aRes.data ?? []) as { id: string; solo: boolean }[]).filter((a) => a.solo).map((a) => a.id));

  const aggByGame = new Map<string, ScoreAgg[]>();
  for (const r of agg) {
    const list = aggByGame.get(r.game_slug) ?? [];
    list.push(r);
    aggByGame.set(r.game_slug, list);
  }

  let champions = 0;
  const gamesOut: PublicProfileGame[] = games.map((g) => {
    const high = isHigh(g.scoring);
    const mine = (aggByGame.get(g.slug) ?? []).find((r) => r.account_id === targetId);
    const best = mine ? (high ? mine.max_all : mine.min_all) : null;

    // 순위(솔로 제외). 대상이 솔로면 순위표에 없어 rank=null.
    const rows = (aggByGame.get(g.slug) ?? [])
      .filter((r) => !soloIds.has(r.account_id))
      .map((r) => ({ id: r.account_id, best: high ? r.max_all : r.min_all }));
    rows.sort((a, b) => (a.best - b.best) * sortDir(g.scoring));
    let rank: number | null = null;
    let prev: number | null = null;
    let curRank = 0;
    rows.forEach((r, i) => {
      curRank = prev !== null && prev === r.best ? curRank : i + 1;
      prev = r.best;
      if (r.id === targetId) rank = curRank;
    });
    if (rank === 1) champions += 1;
    return { slug: g.slug, name: g.name, scoring: g.scoring, best, rank };
  });

  const totalPlays = agg.filter((r) => r.account_id === targetId).reduce((s, r) => s + r.plays, 0);
  const points = ((cmPoints.data ?? []) as { amount: number }[]).reduce((s, r) => s + r.amount, 0);

  return {
    id: t.id,
    name: t.name,
    icon: t.icon ?? null,
    title: t.title ?? null,
    bio: t.bio ?? null,
    createdAt: t.created_at,
    solo: t.solo,
    isMe: viewerId === t.id,
    summary: { champions, totalPlays, iconCount: owned.length },
    games: gamesOut,
    ownedIcons: owned,
    catchmind: { points, solved: cmSolved.count ?? 0, authored: cmAuthored.count ?? 0 },
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
