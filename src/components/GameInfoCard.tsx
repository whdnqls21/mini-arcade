"use client";

import { Card } from "@/components/Card";
import type { GameInfo } from "@/games/types";

// 라벨 + 설명을 나란히 두는 정의형 배치. 번호를 매기지 않는 이유는
// 순서가 정보가 아니기 때문 — 목표·조작·점수·종료는 순서가 아니라 종류다.
export function GameInfoCard({ info }: { info: GameInfo }) {
  const Visual = info.Visual;

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-xs uppercase tracking-[0.2em] text-grass">게임 방법</p>

      <dl className="flex flex-col gap-2">
        {info.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[3.2rem_1fr] gap-3">
            <dt className="pt-px text-xs text-ink-faint">{r.label}</dt>
            <dd className="text-sm leading-relaxed text-ink-dim">{r.text}</dd>
          </div>
        ))}
      </dl>

      {Visual && (
        <div className="border-t border-pitch-line pt-3">
          <Visual />
        </div>
      )}

      {info.tip && (
        <p className="rounded-xl bg-gold/10 px-3 py-2 text-xs leading-relaxed text-gold">
          {info.tip}
        </p>
      )}
    </Card>
  );
}
