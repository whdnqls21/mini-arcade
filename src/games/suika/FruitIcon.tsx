"use client";

import { useEffect, useRef } from "react";

import { FRUITS } from "./fruits";
import { drawFruit } from "./render";

// 게임 안과 똑같은 그리기 함수를 써서 설명 카드와 실제 화면이 어긋나지 않게 한다.
export function FruitIcon({ index, size }: { index: number; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // 꼭지가 위로 튀어나오므로 중심을 약간 아래로 두고 반지름에 여유를 준다.
    drawFruit(ctx, index, size / 2, size * 0.56, size * 0.4, 0, 1);
  }, [index, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      role="img"
      aria-label={FRUITS[index].name}
    />
  );
}

// 목록용 아이콘 — 이 게임의 목적지인 수박을 그대로 보여준다.
export function SuikaIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-black/35"
    >
      <FruitIcon index={FRUITS.length - 1} size={size * 0.92} />
    </div>
  );
}

// 체리에서 수박까지 — 아이콘 크기를 실제 반지름 비율에 맞춰 커지게 해서
// "합칠수록 커진다"를 글로 설명하지 않고 보여준다.
//
// compact 는 게임 중에 판 아래 늘 띄워두는 용도다. 이름을 빼고 크기를 줄여
// 한 줄에 들어가게 하고, 지금 떨어뜨릴 과일을 표시해 "내가 어디쯤인지" 보이게 한다.
export function FruitChain({
  compact = false,
  highlight,
}: {
  compact?: boolean;
  highlight?: number;
} = {}) {
  const min = FRUITS[0].radius;
  const max = FRUITS[FRUITS.length - 1].radius;
  const lo = compact ? 15 : 22;
  const span = compact ? 12 : 22;
  const sizeOf = (r: number) => lo + ((r - min) / (max - min)) * span;

  return (
    <div
      className={`flex items-end overflow-x-auto ${compact ? "gap-0 px-0.5" : "-mx-1 gap-0.5 px-1 pb-1"}`}
    >
      {FRUITS.map((f, i) => (
        <div key={f.name} className="flex shrink-0 items-end gap-0.5">
          {i > 0 && (
            <span className={`text-[9px] text-ink-faint ${compact ? "pb-1.5" : "pb-2"}`}>›</span>
          )}
          <div
            className={`flex flex-col items-center gap-0.5 ${
              highlight === i ? "rounded-md bg-grass/15 ring-1 ring-grass/50" : ""
            }`}
          >
            <FruitIcon index={i} size={sizeOf(f.radius)} />
            {!compact && (
              <span className="whitespace-nowrap text-[9px] text-ink-faint">{f.name}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
