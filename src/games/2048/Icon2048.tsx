// 목록용 아이콘 — 실제 타일 배색을 그대로 쓴 축소판 판때기.
// 게임을 상징하는 이모지 대신, 그 게임에서 실제로 보게 될 것을 보여준다.

import { tileBg, tileColor } from "./tiles";

const CELLS = [2, 4, 8, 2048];

export function Icon2048({ size = 44 }: { size?: number }) {
  const gap = size * 0.07;
  return (
    <div
      role="img"
      aria-label="2048"
      style={{ width: size, height: size, padding: gap, gap }}
      className="grid grid-cols-2 grid-rows-2 rounded-xl bg-black/35"
    >
      {CELLS.map((v) => (
        <span
          key={v}
          style={{
            background: tileBg(v),
            color: tileColor(v),
            fontSize: size * (v >= 1000 ? 0.16 : 0.22),
            borderRadius: size * 0.09,
          }}
          className="tabular flex items-center justify-center font-display leading-none"
        >
          {v}
        </span>
      ))}
    </div>
  );
}
