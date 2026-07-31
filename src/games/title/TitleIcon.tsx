"use client";

// 목록용 아이콘 — 사진 + 제목표(사진에 이름표를 붙인다).
export function TitleIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl border border-pitch-line bg-gradient-to-b from-[#141c26] to-[#080c11]"
      role="img"
      aria-label="제목 학원"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" aria-hidden>
        {/* 사진 프레임 */}
        <rect x="4" y="4" width="24" height="18" rx="3" fill="#101820" stroke="#39414b" strokeWidth="1.2" />
        {/* 산·해 (사진 속 풍경) */}
        <circle cx="11" cy="10" r="2.4" fill="#f4c64e" />
        <path d="M5 20l6-7 4 4 3-3 5 6z" fill="#4de0c0" />
        {/* 제목 이름표 */}
        <rect x="7" y="23" width="18" height="6" rx="2" fill="#f4c64e" stroke="#080c11" strokeWidth="1" />
        <path d="M10 26h5M18 26h4" stroke="#080c11" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
