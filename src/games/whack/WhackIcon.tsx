"use client";

import { MoleIcon } from "@/games/whack/MoleArt";

// 목록용 아이콘 — 구멍에서 두더지가 튀어나온 모습.
export function WhackIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex items-end justify-center overflow-hidden rounded-xl border border-pitch-line bg-gradient-to-b from-[#0f1720] to-[#05090d]"
      role="img"
      aria-label="두더지 잡기"
    >
      <span className="pointer-events-none absolute inset-x-1.5 bottom-1 h-2 rounded-full bg-black/40 blur-[1px]" />
      <span className="relative">
        <MoleIcon size={size * 0.78} />
      </span>
    </div>
  );
}
