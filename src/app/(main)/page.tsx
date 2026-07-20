"use client";

import Link from "next/link";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { formatScore } from "@/lib/format";

export default function GamesPage() {
  const { state } = useAppState();
  if (!state) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-grass">게임</p>
        <h1 className="font-display text-2xl text-ink">{state.session?.name}님, 플레이!</h1>
      </div>

      {state.games.length === 0 && (
        <Card className="py-10 text-center text-sm text-ink-dim">아직 열린 게임이 없어요.</Card>
      )}

      {state.games.map((g) => {
        const top = g.leaderboard[0];
        return (
          <Link key={g.slug} href={`/games/${g.slug}`}>
            <Card className="flex flex-col gap-3 transition-colors hover:border-grass/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-ink">{g.name}</h2>
                  {g.description && (
                    <p className="mt-0.5 text-xs text-ink-faint">{g.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-lg bg-grass/15 px-3 py-1.5 text-sm font-medium text-grass">
                  플레이 →
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-pitch-line pt-3 text-xs">
                <span className="text-ink-dim">
                  🏆 1위{" "}
                  {top ? (
                    <>
                      <b className="text-ink">{top.name}</b>{" "}
                      <span className="tabular text-gold">{formatScore(g.scoring, top.best)}</span>
                    </>
                  ) : (
                    <span className="text-ink-faint">아직 없음</span>
                  )}
                </span>
                <span className="text-ink-dim">
                  내 기록{" "}
                  <span className="tabular text-grass">
                    {g.myBest != null ? formatScore(g.scoring, g.myBest) : "-"}
                  </span>
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
