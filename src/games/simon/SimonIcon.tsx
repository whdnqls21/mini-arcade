// 사이먼 아이콘 — 4색 패드.
export function SimonIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="#161b22" />
      <rect x="8" y="8" width="10" height="10" rx="2.5" fill="#38e07b" />
      <rect x="22" y="8" width="10" height="10" rx="2.5" fill="#ff6b6b" />
      <rect x="8" y="22" width="10" height="10" rx="2.5" fill="#ffd23f" />
      <rect x="22" y="22" width="10" height="10" rx="2.5" fill="#54a0ff" />
    </svg>
  );
}
