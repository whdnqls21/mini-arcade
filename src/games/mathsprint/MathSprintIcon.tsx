// 암산 스프린트 아이콘 — 연산 기호.
export function MathSprintIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="#161b22" />
      <text x="20" y="27" textAnchor="middle" fontSize="19" fontWeight="700" fill="#f5c518">
        ＋×
      </text>
    </svg>
  );
}
