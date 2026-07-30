"use client";

import Link from "next/link";

import { Card } from "@/components/Card";
import { HallOfFame } from "@/components/HallOfFame";
import { IconBadge } from "@/components/IconBadge";
import { SeasonMvpRace } from "@/components/SeasonMvpRace";
import { TitleTag } from "@/components/TitleTag";
import { useAppState } from "@/components/StateProvider";
import { formatScore } from "@/lib/format";
import type { GameView } from "@/lib/state";

export default function RankPage() {
  const { state } = useAppState();
  if (!state) return null;
  const meId = state.session?.id;
  const solo = state.session?.solo ?? false;

  // 진행 중 시즌이면 시즌 종목/자유 종목으로 나눠 보여준다.
  const hasSeason = !!state.season;
  const seasonGames = state.games.filter((g) => g.inSeason);
  const freeGames = state.games.filter((g) => !g.inSeason);

  const renderBoard = (g: GameView) => (
    <Card key={g.slug} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">{g.name}</h2>
        <Link href={`/games/${g.slug}`} className="text-xs text-grass">
          플레이 →
        </Link>
      </div>
      {solo ? (
        // 솔로모드 — 남의 기록은 숨기고 내 기록만.
        g.myBest == null ? (
          <p className="text-sm text-ink-dim">아직 기록이 없어요</p>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-grass/10 px-2.5 py-1.5 text-sm">
            <span className="flex-1 text-ink">
              내 기록<span className="ml-1 text-[10px] text-grass">나</span>
            </span>
            <span className="tabular text-gold">{formatScore(g.scoring, g.myBest, g.slug)}</span>
          </div>
        )
      ) : g.leaderboard.length === 0 ? (
        <p className="text-sm text-ink-dim">기록 없음</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {g.leaderboard.slice(0, 5).map((r) => (
            <li
              key={r.accountId}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                r.accountId === meId ? "bg-grass/10" : ""
              }`}
            >
              <span className="w-5 text-center text-xs text-ink-faint">{r.rank}</span>
              <Link
                href={`/u/${r.accountId}`}
                className="flex min-w-0 flex-1 items-center gap-1 text-ink hover:text-grass"
              >
                <IconBadge iconKey={r.icon} />
                <span className="truncate">{r.name}</span>
                <TitleTag titleKey={r.title} />
                {r.accountId === meId && <span className="text-[10px] text-grass">나</span>}
              </Link>
              <span className="tabular text-gold">{formatScore(g.scoring, r.best, g.slug)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-grass">순위</p>
        <h1 className="font-display text-2xl text-ink">게임별 리더보드</h1>
      </div>

      {state.session?.solo && (
        <Card className="border-grass/30 bg-grass/5">
          <p className="text-sm leading-relaxed text-ink-dim">
            <span className="text-grass">솔로모드</span>라 내 기록은 순위에 올라가지 않아요. 편하게
            즐기세요. <span className="text-ink-faint">(내정보에서 끌 수 있어요.)</span>
          </p>
        </Card>
      )}

      {hasSeason ? (
        <>
          <div className="pt-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm text-gold">
                🏆 시즌 {state.season?.num}
                {state.season?.name ? ` · ${state.season.name}` : ""}
              </h2>
              {state.season && (
                <span className="ml-auto tabular text-xs text-gold/80">{dday(state.season.endsAt)}</span>
              )}
            </div>
            <p className="text-[11px] text-ink-faint">이번 시즌 범위 순위 · MVP 레이스</p>
          </div>
          <SeasonMvpRace season={state.season} race={state.mvpRace} meId={meId} />
          {seasonGames.map(renderBoard)}

          {freeGames.length > 0 && (
            <>
              <div className="pt-1">
                <h2 className="font-display text-sm text-ink-dim">자유 종목</h2>
                <p className="text-[11px] text-ink-faint">올타임 순위(시즌 점수 미반영)예요.</p>
              </div>
              {freeGames.map(renderBoard)}
            </>
          )}
        </>
      ) : (
        state.games.map(renderBoard)
      )}

      {/* 명예의 전당 — 종료된 시즌 아카이브(맨 아래) */}
      <HallOfFame hall={state.hall} />
    </div>
  );
}

function dday(endIso: string): string {
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return "";
  const diff = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return "D-day";
  return "마감 임박";
}
