// 2-Back 아이콘 — 흐름 속의 '두 칸 전' 되짚기.
export function Nback2Icon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="#161b22" />
      <circle cx="11" cy="20" r="3.4" fill="#f5c518" />
      <circle cx="20" cy="20" r="3.4" fill="#2a323d" />
      <circle cx="29" cy="20" r="3.4" fill="#f5c518" />
      <path d="M29 14.5 Q20 7 11 14.5" fill="none" stroke="#38e07b" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12.4 13.2 L11 14.8 L13 15.4" fill="none" stroke="#38e07b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
