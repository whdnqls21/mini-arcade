"use client";

import { useEffect, useRef } from "react";

import { drawFruit } from "@/games/suika/render";
import { faceOf } from "./tiles";

// 목록용 아이콘 — 짝이 맞는 패 두 장. 게임에서 실제로 보게 될 패를 그대로 쓴다.
export function MahjongIcon({ size = 44 }: { size?: number }) {
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

    const f = faceOf(8); // 수박
    const tw = size * 0.4;
    const ty = (size - tw) / 2;
    for (const tx of [size * 0.06, size * 0.54]) {
      ctx.fillStyle = f.bg;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, tw, size * 0.07);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
      drawFruit(ctx, f.fruit, tx + tw / 2, ty + tw / 2 + tw * 0.05, tw * 0.32, 0, 1);
    }
  }, [size]);

  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-black/35"
    >
      <canvas ref={ref} style={{ width: size, height: size }} role="img" aria-label="사천성" />
    </div>
  );
}
