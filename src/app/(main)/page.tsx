"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { GAME_REGISTRY } from "@/games/registry";
import { formatScore } from "@/lib/format";
import type { GameTag } from "@/games/types";

// 태그 한글 라벨 + 필터 칩 순서. 여러 개를 켜면 그 태그를 모두 가진 게임만 보인다(AND).
const TAG_LABEL: Record<GameTag, string> = {
  reflex: "순발력",
  memory: "기억력",
  focus: "집중력",
  calc: "계산",
  strategy: "전략",
};
const TAG_ORDER: GameTag[] = ["reflex", "memory", "focus", "calc", "strategy"];

export default function GamesPage() {
  const { state } = useAppState();
  const [sel, setSel] = useState<Set<GameTag>>(new Set());
  if (!state) return null;
  const solo = state.session?.solo ?? false;

  const toggle = (t: GameTag) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const games =
    sel.size === 0
      ? state.games
      : state.games.filter((g) => {
          const tags = GAME_REGISTRY[g.slug]?.tags ?? [];
          return [...sel].every((t) => tags.includes(t));
        });

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-grass">게임</p>
        <h1 className="font-display text-2xl text-ink">{state.session?.name}님, 플레이!</h1>
      </div>

      {/* 태그 필터 — 여러 개 선택 시 모두 만족하는 게임만(AND) */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSel(new Set())}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            sel.size === 0
              ? "bg-grass/15 text-grass"
              : "border border-pitch-line text-ink-faint hover:text-ink-dim"
          }`}
        >
          전체
        </button>
        {TAG_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => toggle(t)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              sel.has(t)
                ? "bg-grass/15 text-grass"
                : "border border-pitch-line text-ink-faint hover:text-ink-dim"
            }`}
          >
            #{TAG_LABEL[t]}
          </button>
        ))}
      </div>

      {state.games.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-dim">아직 열린 게임이 없어요.</Card>
      ) : games.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-dim">
          선택한 태그를 모두 가진 게임이 없어요.
        </Card>
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
                  {/* 제목 + 태그를 한 줄에 */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <h2 className="font-display text-xl text-ink">{g.name}</h2>
                    {(GAME_REGISTRY[g.slug]?.tags ?? []).map((t) => (
                      <span key={t} className="text-[11px] font-medium text-grass/70">
                        #{TAG_LABEL[t]}
                      </span>
                    ))}
                  </div>
                  {g.description && (
                    <p className="mt-0.5 text-xs text-ink-faint">{g.description}</p>
                  )}
                </div>
                <span className="flex shrink-0 items-center justify-center self-stretch rounded-lg bg-grass/15 px-4 text-sm font-medium text-grass">
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
                        <span className="tabular text-gold">{formatScore(g.scoring, top.best, g.slug)}</span>
                      </>
                    ) : (
                      <span className="text-ink-faint">아직 없음</span>
                    )}
                  </span>
                )}
                <span className="text-ink-dim">
                  내 기록{" "}
                  <span className="tabular text-grass">
                    {g.myBest != null ? formatScore(g.scoring, g.myBest, g.slug) : "-"}
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
