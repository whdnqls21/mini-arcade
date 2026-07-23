"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { ProfileSettings } from "@/components/ProfileSettings";
import { SoloModeToggle } from "@/components/SoloModeToggle";
import { useAppState } from "@/components/StateProvider";
import { postJSON } from "@/lib/client-api";
import { formatScore } from "@/lib/format";

export default function MePage() {
  const { state, refresh } = useAppState();
  const [busy, setBusy] = useState(false);
  if (!state?.session) return null;
  const me = state.session;

  // 솔로모드면 솔로에서 세운 기록만(mySoloBest), 아니면 전체 베스트(myBest). 순위는 비솔로일 때만.
  const myRanks = state.games
    .map((g) => {
      const best = me.solo ? g.mySoloBest : g.myBest;
      if (best == null) return null;
      const row = me.solo ? undefined : g.leaderboard.find((r) => r.accountId === me.id);
      return { game: g, rank: row?.rank ?? null, best };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-grass">내정보</p>
        <h1 className="font-display text-2xl text-ink">{me.name}</h1>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg text-ink">
          내 기록
          {me.solo && <span className="ml-2 text-xs font-normal text-grass">솔로모드 기록만</span>}
        </h2>
        {myRanks.length === 0 ? (
          <p className="text-sm text-ink-dim">
            {me.solo
              ? "아직 솔로모드로 세운 기록이 없어요. 게임을 플레이해보세요!"
              : "아직 기록이 없어요. 게임을 플레이해보세요!"}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myRanks.map(({ game, rank, best }) => (
              <li
                key={game.slug}
                className="flex items-center justify-between rounded-lg bg-black/15 px-3 py-2 text-sm"
              >
                <span className="font-display text-ink">{game.name}</span>
                <span className="text-ink-dim">
                  <span className="tabular text-gold">{formatScore(game.scoring, best, game.slug)}</span>{" "}
                  {rank != null && <span className="text-xs text-ink-faint">({rank}위)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SoloModeToggle solo={me.solo} onChanged={refresh} />

      <ProfileSettings currentName={me.name} onChanged={refresh} />

      <button
        onClick={async () => {
          setBusy(true);
          try {
            await postJSON("/api/auth/logout", {});
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="rounded-xl border border-pitch-line py-3 text-sm text-ink-dim hover:text-ink disabled:opacity-40"
      >
        로그아웃
      </button>
    </div>
  );
}
