import "server-only";

import type { Scoring } from "./types";

import type { SupabaseClient } from "@supabase/supabase-js";

// 시즌 한 개. games 는 이번 시즌 로테이션 종목 slug 목록.
export interface Season {
  id: string;
  num: number;
  name: string | null;
  games: string[];
  starts_at: string;
  ends_at: string;
  status: "active" | "closed";
  closed_at: string | null;
}

// status='active' 인 시즌 행을 가져온다(하나만 존재하도록 DB 부분 유니크 인덱스로 강제).
// runningOnly=true 면 '시작 시각이 이미 지난'(진행 중) 것만 — 시작일이 미래인 '예정' 시즌은 제외한다.
// 테이블이 아직 없으면(마이그레이션 전) null → 시즌제 미적용(전 게임 올타임)으로 조용히 폴백.
async function fetchActiveRow(sb: SupabaseClient, runningOnly: boolean): Promise<Season | null> {
  let q = sb
    .from("ma_seasons")
    .select("id,num,name,games,starts_at,ends_at,status,closed_at")
    .eq("status", "active");
  if (runningOnly) q = q.lte("starts_at", new Date().toISOString());
  const { data, error } = await q.order("num", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  const s = data as Season;
  return { ...s, games: s.games ?? [] };
}

// 현재 '진행 중'인 시즌(status active + 시작 시각 도래). 유저 화면·기록 부착용.
// 시작 일시가 미래인 '예정' 시즌은 아직 진행 중이 아니므로 null(오프시즌 취급).
// NOTE: 종료일(ends_at)이 지나도 자동 종료하지 않는다 — 관리자가 '지금 종료'를 누를 때까지 유지.
export function fetchActiveSeason(sb: SupabaseClient): Promise<Season | null> {
  return fetchActiveRow(sb, true);
}

// status='active' 인 시즌(시작 전 '예정' 포함). 관리자 종료/취소·중복 검사용.
export function fetchScheduledOrActiveSeason(sb: SupabaseClient): Promise<Season | null> {
  return fetchActiveRow(sb, false);
}

// ── 시즌 종료 스냅샷(F1 MVP + 종목별 1등) ────────────────────────────
// F1식 순위 점수: 1등 10 / 2등 6 / 3등 4 / 4등 3 / 5등 2 / 나머지 1.
export const F1_POINTS = [10, 6, 4, 3, 2];
const f1 = (rank: number) => F1_POINTS[rank - 1] ?? 1;

const isHighScoring = (s: Scoring) => s === "high" || s === "htime";

// ma_season_results 에 넣을 한 행(스냅샷). 이름·게임명·정렬방식은 종료 시점 값으로 박는다.
export interface SeasonResultRow {
  season_id: string;
  num: number;
  name: string | null;
  category: "mvp" | "champion";
  game_slug: string | null;
  game_name: string | null;
  scoring: Scoring | null;
  account_id: string | null;
  member_name: string;
  icon: string | null;
  score: number | null;
  points: number | null;
  medals: number | null;
}

export interface SeasonSnapshot {
  rows: SeasonResultRow[];
  mvpAccountId: string | null;
}

interface SAgg {
  game_slug: string;
  account_id: string;
  max_all: number;
  min_all: number;
}

// 시즌 범위 (게임×계정) 베스트. 뷰가 없으면 ma_scores 를 season_id 로 필터해 집계(폴백).
async function seasonBest(sb: SupabaseClient, seasonId: string): Promise<SAgg[]> {
  const v = await sb
    .from("ma_scores_agg_season")
    .select("game_slug,account_id,max_all,min_all")
    .eq("season_id", seasonId);
  if (!v.error && v.data) return v.data as SAgg[];

  const { data } = await sb
    .from("ma_scores")
    .select("account_id,game_slug,score")
    .eq("season_id", seasonId);
  const m = new Map<string, SAgg>();
  for (const s of (data ?? []) as { account_id: string; game_slug: string; score: number }[]) {
    const k = `${s.game_slug}|${s.account_id}`;
    let r = m.get(k);
    if (!r) {
      r = { game_slug: s.game_slug, account_id: s.account_id, max_all: s.score, min_all: s.score };
      m.set(k, r);
    }
    r.max_all = Math.max(r.max_all, s.score);
    r.min_all = Math.min(r.min_all, s.score);
  }
  return [...m.values()];
}

// 종료 시점 스냅샷을 계산한다(저장은 호출부에서). 솔로·비활성 계정은 순위에서 제외.
export async function computeSeasonSnapshot(sb: SupabaseClient, season: Season): Promise<SeasonSnapshot> {
  const games = season.games;
  if (games.length === 0) return { rows: [], mvpAccountId: null };

  const [gRes, aRes, agg] = await Promise.all([
    sb.from("ma_games").select("slug,name,scoring").in("slug", games),
    sb.from("ma_accounts").select("id,name,icon,solo,active"),
    seasonBest(sb, season.id),
  ]);

  const gameMeta = new Map(
    ((gRes.data ?? []) as { slug: string; name: string; scoring: Scoring }[]).map((g) => [g.slug, g])
  );
  const acct = new Map(
    ((aRes.data ?? []) as { id: string; name: string; icon: string | null; solo: boolean; active: boolean }[]).map(
      (a) => [a.id, a]
    )
  );

  const bestByGame = new Map<string, SAgg[]>();
  for (const r of agg) {
    const list = bestByGame.get(r.game_slug) ?? [];
    list.push(r);
    bestByGame.set(r.game_slug, list);
  }

  const points = new Map<string, { points: number; medals: number }>();
  const rows: SeasonResultRow[] = [];

  for (const slug of games) {
    const meta = gameMeta.get(slug);
    const scoring: Scoring = meta?.scoring ?? "high";
    const high = isHighScoring(scoring);

    // 순위표 대상: 이 시즌에 기록이 있고, 활성·비솔로 계정만.
    const ranked = (bestByGame.get(slug) ?? [])
      .filter((r) => {
        const a = acct.get(r.account_id);
        return a && a.active && !a.solo;
      })
      .map((r) => ({ id: r.account_id, best: high ? r.max_all : r.min_all }));
    ranked.sort((a, b) => (a.best - b.best) * (high ? -1 : 1));

    let rank = 0;
    let prev: number | null = null;
    ranked.forEach((r, i) => {
      rank = prev !== null && prev === r.best ? rank : i + 1;
      prev = r.best;

      const cur = points.get(r.id) ?? { points: 0, medals: 0 };
      cur.points += f1(rank);
      if (rank === 1) cur.medals += 1;
      points.set(r.id, cur);

      if (rank === 1) {
        const a = acct.get(r.id)!;
        rows.push({
          season_id: season.id,
          num: season.num,
          name: season.name,
          category: "champion",
          game_slug: slug,
          game_name: meta?.name ?? slug,
          scoring,
          account_id: r.id,
          member_name: a.name,
          icon: a.icon ?? null,
          score: r.best,
          points: null,
          medals: null,
        });
      }
    });
  }

  // MVP — F1 총점 최고. 동점이면 1등 개수(medals) 우선.
  let mvpAccountId: string | null = null;
  const standings = [...points.entries()].map(([id, v]) => ({ id, ...v }));
  standings.sort((a, b) => b.points - a.points || b.medals - a.medals);
  if (standings.length > 0) {
    const top = standings[0];
    const a = acct.get(top.id);
    if (a) {
      mvpAccountId = top.id;
      rows.unshift({
        season_id: season.id,
        num: season.num,
        name: season.name,
        category: "mvp",
        game_slug: null,
        game_name: null,
        scoring: null,
        account_id: top.id,
        member_name: a.name,
        icon: a.icon ?? null,
        score: null,
        points: top.points,
        medals: top.medals,
      });
    }
  }

  return { rows, mvpAccountId };
}
