// 15 퍼즐 아이콘 — 슬라이드 타일.
export function FifteenIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="#161b22" />
      <rect x="8" y="8" width="10" height="10" rx="2" fill="#38e07b" opacity="0.85" />
      <rect x="22" y="8" width="10" height="10" rx="2" fill="#38e07b" opacity="0.6" />
      <rect x="8" y="22" width="10" height="10" rx="2" fill="#38e07b" opacity="0.6" />
      <text x="13" y="16.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#0b1f14">1</text>
      <text x="27" y="16.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#0b1f14">2</text>
      <text x="13" y="30.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#0b1f14">3</text>
    </svg>
  );
}
