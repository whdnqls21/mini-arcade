"use client";

// 목록용 아이콘 — 빨강→초록 신호. 초록이 켜진 순간을 표현.
export function GreenlightIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl border border-pitch-line bg-gradient-to-b from-[#0f1720] to-[#05090d]"
      role="img"
      aria-label="그린라이트"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" aria-hidden>
        {/* 신호등 몸체 */}
        <rect x="9" y="2" width="14" height="28" rx="6" fill="#1a222c" stroke="#39414b" strokeWidth="1.2" />
        {/* 빨강(꺼짐) */}
        <circle cx="16" cy="10" r="4" fill="#ff6b6b" opacity="0.28" />
        {/* 초록(켜짐 — 빛남) */}
        <circle cx="16" cy="22" r="5" fill="#4de0c0" />
        <circle cx="16" cy="22" r="5" fill="#4de0c0" opacity="0.35">
          <animate attributeName="r" values="5;7;5" dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="1.4s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
