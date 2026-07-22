"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { GAME_REGISTRY } from "@/games/registry";
import { formatScore } from "@/lib/format";
import type { GameCategory } from "@/games/types";

type CatKey = GameCategory | "all";

// 상단 분류 필터 칩(순서 고정).
const GAME_CATS: { key: CatKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "merge", label: "합치기" },
  { key: "clear", label: "시간클리어" },
  { key: "reaction", label: "반응" },
  { key: "match", label: "기억매칭" },
  { key: "focus", label: "집중" },
];

export default function GamesPage() {
  const { state } = useAppState();
  const [cat, setCat] = useState<CatKey>("all");
  if (!state) return null;
  const solo = state.session?.solo ?? false;

  const games =
    cat === "all"
      ? state.games
      : state.games.filter((g) => GAME_REGISTRY[g.slug]?.category === cat);

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-grass">게임</p>
        <h1 className="font-display text-2xl text-ink">{state.session?.name}님, 플레이!</h1>
      </div>

      {/* 분류 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {GAME_CATS.map((f) => (
          <button
            key={f.key}
            onClick={() => setCat(f.key)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              cat === f.key
                ? "bg-grass/15 text-grass"
                : "border border-pitch-line text-ink-faint hover:text-ink-dim"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {state.games.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-dim">아직 열린 게임이 없어요.</Card>
      ) : games.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-dim">이 분류에 게임이 없어요.</Card>
      ) : null}

      {games.map((g) => {
        const top = g.leaderboard[0];
        const Icon = GAME_REGISTRY[g.slug]?.Icon;
        return (
          <Link key={g.slug} href={`/games/${g.slug}`}>
            <Card className="flex flex-col gap-3 transition-colors hover:border-grass/40">
              <div className="flex items-start gap-3">
                {Icon && (
                  <span className="shrink-0">
                    <Icon size={44} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl text-ink">{g.name}</h2>
                  {g.description && (
                    <p className="mt-0.5 text-xs text-ink-faint">{g.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-lg bg-grass/15 px-3 py-1.5 text-sm font-medium text-grass">
                  플레이 →
                </span>
              </div>

              <div
                className={`flex items-center border-t border-pitch-line pt-3 text-xs ${
                  solo ? "justify-end" : "justify-between"
                }`}
              >
                {/* 솔로모드에서는 남의 1위 기록을 숨긴다. */}
                {!solo && (
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
                )}
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
