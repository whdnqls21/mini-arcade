"use client";

import { useEffect, useRef } from "react";

import { DINO_MINT, DINO_SPRITE, drawDinoSprite } from "./render";

// 목록용 아이콘 — 본편과 같은 도트를 쓴다.
export function DinoIcon({ size = 44 }: { size?: number }) {
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

    // 도트 한 칸 크기를 아이콘에 맞춰 정수로 잡아야 흐려지지 않는다.
    const px = Math.max(1, Math.floor((size * 0.7) / DINO_SPRITE.length));
    const w = DINO_SPRITE[0].length * px;
    const h = DINO_SPRITE.length * px;
    const x = Math.round((size - w) / 2);
    const y = Math.round((size - h) / 2) - px;

    drawDinoSprite(ctx, x, y, px, DINO_MINT);

    // 지면
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x - px, y + h, w + px * 2, Math.max(1, Math.round(px / 2)));
  }, [size]);

  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-black/35"
    >
      <canvas ref={ref} style={{ width: size, height: size }} role="img" aria-label="크롬 다이노" />
    </div>
  );
}
