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

// 체리에서 수박까지 — 아이콘 크기를 실제 반지름 비율에 맞춰 커지게 해서
// "합칠수록 커진다"를 글로 설명하지 않고 보여준다.
export function FruitChain() {
  const min = FRUITS[0].radius;
  const max = FRUITS[FRUITS.length - 1].radius;
  const sizeOf = (r: number) => 22 + ((r - min) / (max - min)) * 22;

  return (
    <div className="-mx-1 flex items-end gap-0.5 overflow-x-auto px-1 pb-1">
      {FRUITS.map((f, i) => (
        <div key={f.name} className="flex shrink-0 items-end gap-0.5">
          {i > 0 && <span className="pb-2 text-[9px] text-ink-faint">›</span>}
          <div className="flex flex-col items-center gap-0.5">
            <FruitIcon index={i} size={sizeOf(f.radius)} />
            <span className="whitespace-nowrap text-[9px] text-ink-faint">{f.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
