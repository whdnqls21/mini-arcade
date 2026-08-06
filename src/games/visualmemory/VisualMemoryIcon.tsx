// 플래시 메모리 아이콘 — 격자에서 켜진 칸.
export function VisualMemoryIcon({ size = 40 }: { size?: number }) {
  const cells = [
    [8, 8, false], [19, 8, true], [30, 8, false],
    [8, 19, true], [19, 19, false], [30, 19, true],
    [8, 30, false], [19, 30, false], [30, 30, true],
  ] as const;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="#161b22" />
      {cells.map(([x, y, on], i) => (
        <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="7" rx="1.8" fill={on ? "#f5c518" : "#2a323d"} />
      ))}
    </svg>
  );
}
