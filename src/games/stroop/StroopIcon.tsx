// 스트룹 아이콘 — '뜻'과 다른 색으로 칠해진 글자.
export function StroopIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="#161b22" />
      <text x="20" y="28" textAnchor="middle" fontSize="22" fontWeight="700" fill="#4287f5">
        색
      </text>
    </svg>
  );
}
