"use client";

// 목록용 아이콘 — 숫자 격자에서 '1'이 강조된 모습.
export function SchulteIcon({ size = 44 }: { size?: number }) {
  const nums = [3, 1, 5, 8, 2, 6, 4, 9, 7]; // 3×3 미니 그리드
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.2 }}
      className="grid grid-cols-3 gap-0.5 rounded-lg bg-black/35 p-1"
      role="img"
      aria-label="1 to 30"
    >
      {nums.map((n, i) => (
        <span
          key={i}
          className={`flex items-center justify-center rounded-[2px] font-display leading-none ${
            n === 1 ? "bg-grass/30 text-grass" : "bg-white/5 text-ink-dim"
          }`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}
