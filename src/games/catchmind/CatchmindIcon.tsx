"use client";

// 목록용 아이콘 — 연필과 그림(그리고 맞히기).
export function CatchmindIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl border border-pitch-line bg-gradient-to-b from-[#141c26] to-[#080c11]"
      role="img"
      aria-label="캐치마인드"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" aria-hidden>
        {/* 캔버스 */}
        <rect x="4" y="6" width="24" height="18" rx="3" fill="#101820" stroke="#39414b" strokeWidth="1.2" />
        {/* 그려진 곡선 */}
        <path d="M8 18c2-5 5-5 7-2s5 2 7-3" fill="none" stroke="#4de0c0" strokeWidth="2" strokeLinecap="round" />
        {/* 연필 */}
        <path d="M20 25l6-6 3 3-6 6-3 1z" fill="#f4c64e" stroke="#080c11" strokeWidth="1" strokeLinejoin="round" />
        <path d="M25 20l2 2" stroke="#080c11" strokeWidth="1" />
      </svg>
    </div>
  );
}
