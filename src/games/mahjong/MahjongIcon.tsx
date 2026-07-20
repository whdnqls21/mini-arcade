// 목록용 아이콘 — 짝이 맞는 패 두 장. 게임에서 실제로 보게 될 패를 그대로 쓴다.

import { faceOf, TILE_BG, TILE_EDGE } from "./tiles";

export function MahjongIcon({ size = 44 }: { size?: number }) {
  const f = faceOf(1); // 一萬
  const tw = size * 0.3;

  return (
    <div
      style={{ width: size, height: size, gap: size * 0.08 }}
      className="flex items-center justify-center rounded-xl bg-black/35"
      role="img"
      aria-label="사천성"
    >
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: tw,
            height: tw * 1.33,
            background: TILE_BG,
            borderColor: TILE_EDGE,
            borderRadius: size * 0.06,
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.16)",
          }}
          className="flex flex-col items-center justify-center border leading-none"
        >
          <span className="font-display" style={{ color: f.color, fontSize: size * 0.19 }}>
            {f.num}
          </span>
          <span style={{ color: f.color, fontSize: size * 0.13, opacity: 0.85 }}>{f.mark}</span>
        </span>
      ))}
    </div>
  );
}
