// 색 다른 타일 찾기 아이콘 — 같은 색 4칸 중 한 칸만 다른 색.
export function OddColorIcon({ size = 40 }: { size?: number }) {
  const gap = size * 0.1;
  const cell = (size - gap) / 2;
  const r = size * 0.09;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => {
        const x = (i % 2) * (cell + gap);
        const y = Math.floor(i / 2) * (cell + gap);
        return (
          <rect key={i} x={x} y={y} width={cell} height={cell} rx={r} fill={i === 3 ? "#8fe0b0" : "#46a758"} />
        );
      })}
    </svg>
  );
}
