"use client";

// 목록용 아이콘 — 공룡과 선인장. 게임에서 보게 될 실루엣을 그대로 쓴다.
export function DinoIcon({ size = 44 }: { size?: number }) {
  const u = size / 22; // 22단위 격자로 그린다

  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-black/35"
      role="img"
      aria-label="공룡 달리기"
    >
      <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
        {/* 지면 */}
        <rect x="1" y="17" width="20" height="0.8" fill="rgba(255,255,255,0.25)" />
        {/* 공룡 */}
        <g fill="#4de0c0">
          <rect x="3" y="9" width="3" height="2.5" />
          <rect x="5" y="8.5" width="6" height="5.5" rx="1" />
          <rect x="9" y="5.5" width="6" height="4.5" rx="1" />
          <rect x="14.5" y="8" width="1.6" height="1.5" />
          <rect x="6" y="13.5" width="1.8" height="3.5" />
          <rect x="9" y="13.5" width="1.8" height="2.5" />
        </g>
        <rect x="12.6" y="6.8" width="1" height="1" fill="#0a0f16" />
        {/* 선인장 */}
        <g fill="#3f9e7c">
          <rect x="17" y="10" width="2.6" height="7" rx="1" />
          <rect x="15.8" y="12" width="1.4" height="1.2" />
          <rect x="19.4" y="11.4" width="1.4" height="1.2" />
        </g>
      </svg>
    </div>
  );
}
