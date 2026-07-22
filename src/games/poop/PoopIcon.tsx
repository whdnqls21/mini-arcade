"use client";

// 목록용 아이콘 — 떨어지는 똥과 아래에서 피하는 졸라맨.
export function PoopIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="overflow-hidden rounded-xl border border-pitch-line bg-gradient-to-b from-[#0f1720] to-[#05090d]"
      role="img"
      aria-label="똥 피하기"
    >
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        {/* 똥 */}
        <g>
          <ellipse cx="17" cy="17" rx="8" ry="5" fill="#6f4a28" />
          <ellipse cx="17" cy="12.5" rx="5.6" ry="4" fill="#805632" />
          <ellipse cx="17" cy="8.5" rx="3.2" ry="3" fill="#8f6038" />
          <circle cx="14.6" cy="15" r="1.4" fill="#fff" />
          <circle cx="19.4" cy="15" r="1.4" fill="#fff" />
          <circle cx="14.6" cy="15.2" r="0.7" fill="#1a1310" />
          <circle cx="19.4" cy="15.2" r="0.7" fill="#1a1310" />
        </g>
        {/* 졸라맨 (오른쪽 아래에서 피함) */}
        <g stroke="#e8edf2" strokeWidth="2" strokeLinecap="round" fill="none">
          <circle cx="33" cy="30" r="3.2" fill="#e8edf2" stroke="none" />
          <line x1="33" y1="33.5" x2="33" y2="40" />
          <line x1="33" y1="35" x2="29" y2="32" />
          <line x1="33" y1="35" x2="37" y2="32" />
          <line x1="33" y1="40" x2="29.5" y2="44" />
          <line x1="33" y1="40" x2="36.5" y2="44" />
        </g>
        <line x1="4" y1="45" x2="44" y2="45" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
