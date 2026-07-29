"use client";

import { useEffect, useState } from "react";

import { IconBadge } from "@/components/IconBadge";
import { Modal } from "@/components/Modal";
import { useAppState } from "@/components/StateProvider";
import { formatScore } from "@/lib/format";

// 시즌 종료 축하 — 가장 최근 종료된 시즌 결과(명예의 전당 최신)를 앱 열 때 딱 한 번 모달로.
// 사용자·시즌별 localStorage 플래그로 이미 본 시즌은 다시 뜨지 않는다.
export function SeasonEndCelebration() {
  const { state } = useAppState();
  const latest = state?.hall?.[0]; // 최신 종료 시즌
  const accountId = state?.session?.id ?? null;
  const [open, setOpen] = useState(false);

  const seasonId = latest?.seasonId ?? null;
  const hasResult = !!latest && (!!latest.mvp || latest.champions.length > 0);

  useEffect(() => {
    if (!hasResult || !seasonId) return;
    const key = `ma_season_celebrated:${accountId ?? "guest"}:${seasonId}`;
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(key);
    } catch {
      seen = null;
    }
    if (!seen) {
      setOpen(true);
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // 저장 실패해도 모달은 뜬다(다음에 또 뜰 뿐)
      }
    }
  }, [hasResult, seasonId, accountId]);

  if (!open || !latest) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={`🎉 시즌 ${latest.num} 종료!`}>
      <div className="flex flex-col gap-4">
        {latest.name && <p className="text-center text-sm text-gold">“{latest.name}”</p>}

        {/* MVP */}
        {latest.mvp && (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-gold/30 bg-gold/10 py-4">
            <span className="text-3xl" aria-hidden>
              🏆
            </span>
            <p className="text-xs font-medium text-gold">시즌 MVP</p>
            <p className="flex items-center gap-1.5 font-display text-lg text-ink">
              <IconBadge iconKey={latest.mvp.icon} />
              {latest.mvp.memberName}
            </p>
            {latest.mvp.points != null && (
              <p className="text-xs text-ink-dim">
                {latest.mvp.points}점{latest.mvp.medals ? ` · 🥇${latest.mvp.medals}` : ""}
              </p>
            )}
          </div>
        )}

        {/* 종목별 1등 */}
        {latest.champions.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-ink-faint">종목별 1등</p>
            {latest.champions.map((c, i) => (
              <div key={`${c.gameSlug}-${i}`} className="flex items-center gap-1.5 text-sm">
                <span className="w-20 shrink-0 truncate text-ink-faint">{c.gameName ?? c.gameSlug}</span>
                <IconBadge iconKey={c.icon} />
                <span className="truncate text-ink">{c.memberName}</span>
                {c.score != null && c.scoring && (
                  <span className="ml-auto tabular text-gold">
                    {formatScore(c.scoring, c.score, c.gameSlug ?? "")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-ink-faint">
          명예의 전당에 영구 기록됐어요. 새 시즌도 기대해요!
        </p>
        <button
          onClick={() => setOpen(false)}
          className="rounded-xl bg-grass py-2.5 font-display text-pitch-base"
        >
          확인
        </button>
      </div>
    </Modal>
  );
}
