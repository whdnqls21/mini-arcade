"use client";

// 두더지 아트 — 에셋 없이 인라인 SVG. 구멍에서 빼꼼 올라온 모습(아래는 앞발로 테두리를 잡음).
// 좋은 두더지와 나쁜 두더지는 40px 에서도 한눈에 구분되도록 색/표정을 크게 다르게 둔다.
//  - 좋은 두더지: 따뜻한 갈색, 동그란 눈, 분홍 코, 수염 (순한 인상)
//  - 나쁜 두더지: 어두운 회보라, 빨간 눈, 화난 V자 눈썹, 찡그린 입 (경계색)

// 좋은 두더지 털색 몇 가지 — 판이 심심하지 않게 약간의 변주.
const FUR = [
  { body: "#9b6b45", face: "#b48861" },
  { body: "#8a6144", face: "#a67c58" },
  { body: "#a5754a", face: "#bd9166" },
];

export function MoleIcon({ size = 40, variant = 0 }: { size?: number | string; variant?: number }) {
  const c = FUR[variant % FUR.length];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* 앞발 */}
      <g fill={c.body}>
        <ellipse cx="12" cy="43" rx="5" ry="4" />
        <ellipse cx="36" cy="43" rx="5" ry="4" />
      </g>
      <g stroke="#f0d8c8" strokeWidth="1" strokeLinecap="round">
        <line x1="10" y1="44" x2="9" y2="46" />
        <line x1="12" y1="44.5" x2="12" y2="46.5" />
        <line x1="14" y1="44" x2="15" y2="46" />
        <line x1="34" y1="44" x2="33" y2="46" />
        <line x1="36" y1="44.5" x2="36" y2="46.5" />
        <line x1="38" y1="44" x2="39" y2="46" />
      </g>
      {/* 머리·몸통 */}
      <ellipse cx="24" cy="25" rx="16" ry="17" fill={c.body} />
      <ellipse cx="24" cy="29" rx="11" ry="10.5" fill={c.face} />
      {/* 눈 */}
      <circle cx="18" cy="22" r="2.6" fill="#2a1d14" />
      <circle cx="30" cy="22" r="2.6" fill="#2a1d14" />
      <circle cx="18.9" cy="21.2" r="0.8" fill="#fff" />
      <circle cx="30.9" cy="21.2" r="0.8" fill="#fff" />
      {/* 코·주둥이 */}
      <ellipse cx="24" cy="31" rx="7.5" ry="6" fill="#eaa8a8" />
      <ellipse cx="24" cy="28.2" rx="3" ry="2.2" fill="#3a2a2a" />
      <path d="M24 30 Q21.5 33 19.5 32" stroke="#3a2a2a" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M24 30 Q26.5 33 28.5 32" stroke="#3a2a2a" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* 수염 */}
      <g stroke="#5a4030" strokeWidth="0.8" opacity="0.55" strokeLinecap="round">
        <line x1="16" y1="30" x2="7" y2="29" />
        <line x1="16" y1="32" x2="7" y2="34" />
        <line x1="32" y1="30" x2="41" y2="29" />
        <line x1="32" y1="32" x2="41" y2="34" />
      </g>
    </svg>
  );
}

export function BadMoleIcon({ size = 40 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* 앞발 + 날카로운 발톱 */}
      <g fill="#463f50">
        <ellipse cx="12" cy="43" rx="5" ry="4" />
        <ellipse cx="36" cy="43" rx="5" ry="4" />
      </g>
      <g stroke="#dcd4dc" strokeWidth="1.2" strokeLinecap="round">
        <line x1="9.5" y1="43.5" x2="8" y2="46.5" />
        <line x1="12" y1="44" x2="12" y2="47" />
        <line x1="14.5" y1="43.5" x2="16" y2="46.5" />
        <line x1="33.5" y1="43.5" x2="32" y2="46.5" />
        <line x1="36" y1="44" x2="36" y2="47" />
        <line x1="38.5" y1="43.5" x2="40" y2="46.5" />
      </g>
      {/* 머리·몸통 (어두운 회보라) */}
      <ellipse cx="24" cy="25" rx="16" ry="17" fill="#514857" />
      <ellipse cx="24" cy="29" rx="11" ry="10.5" fill="#635869" />
      {/* 화난 눈썹 */}
      <g stroke="#211c26" strokeWidth="2.6" strokeLinecap="round">
        <line x1="13" y1="17.5" x2="21" y2="21.5" />
        <line x1="35" y1="17.5" x2="27" y2="21.5" />
      </g>
      {/* 빨간 눈 */}
      <circle cx="18" cy="24" r="2.9" fill="#ff4d4d" />
      <circle cx="30" cy="24" r="2.9" fill="#ff4d4d" />
      <circle cx="18" cy="24" r="1.1" fill="#6e0000" />
      <circle cx="30" cy="24" r="1.1" fill="#6e0000" />
      {/* 코·주둥이 */}
      <ellipse cx="24" cy="32" rx="7" ry="5.5" fill="#8a7d92" />
      <ellipse cx="24" cy="29.5" rx="3" ry="2.2" fill="#181219" />
      {/* 찡그린 입 + 이빨 */}
      <path d="M19 36 Q24 32.5 29 36" stroke="#181219" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M21.5 34.6 l1.3 1.8 l1.3 -1.8 Z" fill="#fff" opacity="0.9" />
      <path d="M25.5 34.6 l1.3 1.8 l1.3 -1.8 Z" fill="#fff" opacity="0.9" />
    </svg>
  );
}
