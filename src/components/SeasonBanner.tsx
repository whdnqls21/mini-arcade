"use client";

import type { SeasonView } from "@/lib/state";

// 현재 시즌 안내 배너 — 시즌명 + D-day + 이번 시즌 종목.
// 시즌이 없으면(오프시즌·미도입) 아무것도 렌더하지 않는다.
export function SeasonBanner({
  season,
  gameNameBySlug,
}: {
  season: SeasonView | null;
  gameNameBySlug: Map<string, string>;
}) {
  if (!season) return null;
  const names = season.games.map((s) => gameNameBySlug.get(s) ?? s);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden>🏆</span>
        <span className="font-display text-sm text-gold">
          시즌 {season.num}
          {season.name ? ` · ${season.name}` : ""}
        </span>
        <span className="ml-auto tabular text-xs text-gold/80">{dday(season.endsAt)}</span>
      </div>
      {names.length > 0 && (
        <p className="text-[11px] leading-relaxed text-ink-dim">
          이번 종목 <span className="text-ink">{names.join(" · ")}</span>
        </p>
      )}
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
