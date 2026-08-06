// 숫자 기억 아이콘 — 기억할 숫자.
export function NumberMemoryIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="#161b22" />
      <text x="20" y="27" textAnchor="middle" fontSize="17" fontWeight="700" fill="#f5c518" letterSpacing="1">
        3·8
      </text>
    </svg>
  );
}
