"use client";

import Link from "next/link";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { formatScore } from "@/lib/format";

export default function RankPage() {
  const { state } = useAppState();
  if (!state) return null;
  const meId = state.session?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-grass">순위</p>
        <h1 className="font-display text-2xl text-ink">게임별 리더보드</h1>
      </div>

      {state.games.map((g) => (
        <Card key={g.slug} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">{g.name}</h2>
            <Link href={`/games/${g.slug}`} className="text-xs text-grass">
              플레이 →
            </Link>
          </div>
          {g.leaderboard.length === 0 ? (
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
                  <span className="flex-1 text-ink">
                    {r.name}
                    {r.accountId === meId && <span className="ml-1 text-[10px] text-grass">나</span>}
                  </span>
                  <span className="tabular text-gold">{formatScore(g.scoring, r.best)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
