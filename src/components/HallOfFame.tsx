"use client";

import Link from "next/link";

import { Card } from "@/components/Card";
import { IconBadge } from "@/components/IconBadge";
import { formatScore } from "@/lib/format";
import type { HallEntry } from "@/lib/state";

// 명예의 전당 — 종료된 시즌의 MVP + 종목별 1등(스냅샷). 없으면 렌더 안 함.
export function HallOfFame({ hall }: { hall: HallEntry[] }) {
  if (hall.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 border-gold/30 bg-gold/5">
      <div className="flex items-center gap-2">
        <span aria-hidden>🏛️</span>
        <h2 className="font-display text-lg text-ink">명예의 전당</h2>
        <span className="text-xs text-ink-faint">역대 시즌</span>
      </div>

      {hall.map((s) => (
        <div key={s.seasonId} className="flex flex-col gap-2 rounded-xl border border-pitch-line bg-black/10 p-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-ink">시즌 {s.num}</span>
            {s.name && <span className="text-sm text-gold">{s.name}</span>}
            {s.endedAt && <span className="ml-auto text-[11px] text-ink-faint">{fmt(s.endedAt)} 종료</span>}
          </div>

          {/* MVP */}
          {s.mvp ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-gold/10 px-2.5 py-1.5 text-sm">
              <span aria-hidden>🏆</span>
              <span className="text-[11px] font-medium text-gold">MVP</span>
              <NameLink accountId={s.mvp.accountId} name={s.mvp.memberName} icon={s.mvp.icon} />
              {s.mvp.points != null && (
                <span className="ml-auto tabular text-xs text-ink-dim">
                  {s.mvp.points}점
                  {s.mvp.medals ? ` · 🥇${s.mvp.medals}` : ""}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-faint">기록이 없어 MVP가 없는 시즌</p>
          )}

          {/* 종목별 1등 */}
          {s.champions.length > 0 && (
            <div className="flex flex-col gap-1">
              {s.champions.map((c, i) => (
                <div key={`${c.gameSlug}-${i}`} className="flex items-center gap-1.5 text-xs">
                  <span className="w-20 shrink-0 truncate text-ink-faint">{c.gameName ?? c.gameSlug}</span>
                  <NameLink accountId={c.accountId} name={c.memberName} icon={c.icon} />
                  {c.score != null && c.scoring && (
                    <span className="ml-auto tabular text-gold">
                      {formatScore(c.scoring, c.score, c.gameSlug ?? "")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

// 이름 + 아이콘. 계정이 남아 있으면 프로필로 링크, 아니면(탈퇴) 텍스트만.
function NameLink({ accountId, name, icon }: { accountId: string | null; name: string; icon: string | null }) {
  const inner = (
    <span className="flex min-w-0 items-center gap-1">
      <IconBadge iconKey={icon} />
      <span className="truncate text-ink">{name}</span>
    </span>
  );
  if (!accountId) return inner;
  return (
    <Link href={`/u/${accountId}`} className="min-w-0 hover:text-grass">
      {inner}
    </Link>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
