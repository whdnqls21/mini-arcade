"use client";

import Link from "next/link";

import { Card } from "@/components/Card";
import { IconBadge } from "@/components/IconBadge";
import { TitleTag } from "@/components/TitleTag";
import type { MvpRaceRow, SeasonView } from "@/lib/state";

// 진행 중 시즌의 실시간 MVP 레이스(F1 종합 순위). 시즌 없거나 기록 없으면 렌더 안 함.
export function SeasonMvpRace({
  season,
  race,
  meId,
}: {
  season: SeasonView | null;
  race: MvpRaceRow[];
  meId?: string;
}) {
  if (!season || race.length === 0) return null;

  return (
    <Card className="flex flex-col gap-2 border-gold/30 bg-gold/5">
      <div className="flex items-center gap-2">
        <span aria-hidden>🏁</span>
        <h2 className="font-display text-lg text-ink">MVP 레이스</h2>
        <span className="ml-auto text-xs text-ink-faint">
          시즌 {season.num}
          {season.name ? ` · ${season.name}` : ""}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-faint">
        시즌 종목 F1 포인트 합산 · 1등 10 · 2등 6 · 3등 4 · 4등 3 · 5등 2 · 나머지 1
      </p>
      <ul className="flex flex-col gap-1.5">
        {race.map((r) => (
          <li
            key={r.accountId}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
              r.accountId === meId ? "bg-grass/10" : ""
            }`}
          >
            <span className="w-6 shrink-0 text-center text-xs tabular text-ink-faint">{medal(r.rank)}</span>
            <Link
              href={`/u/${r.accountId}`}
              className="flex min-w-0 flex-1 items-center gap-1 text-ink hover:text-grass"
            >
              <IconBadge iconKey={r.icon} />
              <span className="truncate">{r.name}</span>
              <TitleTag titleKey={r.title} />
              {r.accountId === meId && <span className="text-[10px] text-grass">나</span>}
            </Link>
            {r.medals > 0 && <span className="text-[11px] text-ink-faint">🥇{r.medals}</span>}
            <span className="tabular text-gold">{r.points}점</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}
