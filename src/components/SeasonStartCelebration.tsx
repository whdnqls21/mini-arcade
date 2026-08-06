"use client";

import { useEffect, useState } from "react";

import { IconBadge } from "@/components/IconBadge";
import { Modal } from "@/components/Modal";
import { useAppState } from "@/components/StateProvider";
import { ddayLabel } from "@/lib/format";

// 시즌 시작 축하 — 새 활성 시즌이 열리면 앱 열 때 딱 한 번 모달(종목·기간 + 지난 MVP 도전).
// 사용자·시즌별 localStorage 플래그로 한 번만 노출. 종료 축하와 겹치지 않게 순서를 양보한다.
export function SeasonStartCelebration() {
  const { state } = useAppState();
  const season = state?.season ?? null;
  const accountId = state?.session?.id ?? null;
  const [open, setOpen] = useState(false);

  const seasonId = season?.id ?? null;

  // 최근 종료 시즌의 '종료 축하'가 아직 안 떴다면(볼 게 있는데) 이번엔 시작 축하를 미룬다
  // → 종료 → (다음 열기) → 시작 순으로 하나씩 뜨게.
  const pendingEnd = (() => {
    const latest = state?.hall?.[0];
    if (!latest || !(latest.mvp || latest.champions.length > 0)) return false;
    try {
      return !window.localStorage.getItem(`ma_season_celebrated:${accountId ?? "guest"}:${latest.seasonId}`);
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!seasonId || pendingEnd) return;
    const key = `ma_season_started:${accountId ?? "guest"}:${seasonId}`;
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
  }, [seasonId, pendingEnd, accountId]);

  if (!open || !season) return null;

  const nameBySlug = new Map((state?.games ?? []).map((g) => [g.slug, g.name]));
  const games = season.games.map((s) => nameBySlug.get(s) ?? s);
  const lastMvp = state?.hall?.[0]?.mvp ?? null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={`🚩 시즌 ${season.num} 시작!`}>
      <div className="flex flex-col gap-4">
        {season.name && <p className="text-center text-sm text-gold">“{season.name}”</p>}

        <div className="flex items-center justify-center gap-2 text-xs text-ink-dim">
          <span>{fmtRange(season.startsAt, season.endsAt)}</span>
          <span className="tabular text-gold">{dday(season.endsAt)}</span>
        </div>

        {/* 이번 시즌 종목 */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-ink-faint">이번 시즌 종목</p>
          <div className="flex flex-wrap gap-1.5">
            {games.map((g, i) => (
              <span key={`${g}-${i}`} className="rounded-full bg-black/25 px-2.5 py-1 text-xs text-ink">
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* 지난 시즌 MVP 도전 */}
        {lastMvp && (
          <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-sm">
            <span aria-hidden>👑</span>
            <span className="text-ink-dim">
              지난 시즌 MVP{" "}
              <span className="inline-flex items-center gap-1 align-middle">
                <IconBadge iconKey={lastMvp.icon} />
                <b className="text-ink">{lastMvp.memberName}</b>
              </span>
              , 이번엔 왕관의 주인이 바뀔까요?
            </span>
          </div>
        )}

        <p className="text-center text-xs text-ink-faint">
          시즌 종목에서 F1 포인트를 모아 MVP에 도전하세요!
        </p>
        <button
          onClick={() => setOpen(false)}
          className="rounded-xl bg-grass py-2.5 font-display text-pitch-base"
        >
          시작하기
        </button>
      </div>
    </Modal>
  );
}

function fmtRange(startIso: string, endIso: string): string {
  return `${fmt(startIso)} ~ ${fmt(endIso)}`;
}
function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}. ${d.getDate()}.`;
}
function dday(endIso: string): string {
  return ddayLabel(endIso);
}
