"use client";

import { BrainMark } from "@/components/BrainMark";
import { FruitIcon } from "@/games/suika/FruitIcon";

// 목록용 아이콘 — 뒤집힌 카드(과일)와 덮인 카드(뇌) 두 장.
export function MemoryIcon({ size = 44 }: { size?: number }) {
  const w = size * 0.42;
  return (
    <div
      style={{ width: size, height: size, gap: size * 0.08 }}
      className="flex items-center justify-center rounded-xl bg-black/35"
      role="img"
      aria-label="카드 짝맞추기"
    >
      <span
        style={{ width: w, height: w * 1.2 }}
        className="flex items-center justify-center rounded border border-pitch-line bg-black/30"
      >
        <FruitIcon index={10} size={w * 0.8} />
      </span>
      <span
        style={{ width: w, height: w * 1.2 }}
        className="flex items-center justify-center rounded border border-pitch-line bg-gradient-to-br from-[#1a2530] to-[#0e151d]"
      >
        <BrainMark size={w * 0.55} />
      </span>
    </div>
  );
}
