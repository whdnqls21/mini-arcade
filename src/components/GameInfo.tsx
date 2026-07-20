"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import type { GameInfo } from "@/games/types";

// 플레이 화면 상단 버튼 → 모달. 규칙은 한 번 읽으면 되는 정보라
// 화면에 늘 펼쳐두기보다 필요할 때 꺼내 보는 쪽이 맞다.
export function GameInfoButton({ info }: { info: GameInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full border border-pitch-line bg-black/20 px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-grass/40 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-grass"
      >
        게임 방법
      </button>
      {/* 어느 게임인지는 화면 맥락으로 이미 드러나므로 제목에 게임 이름을 넣지 않는다.
          ("수박게임 게임 방법"처럼 겹치기도 한다.) */}
      <Modal open={open} onClose={() => setOpen(false)} title="게임 방법">
        <GameInfoContent info={info} />
      </Modal>
    </>
  );
}

// 라벨 + 설명을 나란히 두는 정의형 배치. 번호를 매기지 않는 이유는
// 순서가 정보가 아니기 때문 — 목표·조작·점수·종료는 순서가 아니라 종류다.
export function GameInfoContent({ info }: { info: GameInfo }) {
  const Visual = info.Visual;

  return (
    <div className="flex flex-col gap-3">
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
    </div>
  );
}
