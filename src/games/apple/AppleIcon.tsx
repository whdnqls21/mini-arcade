"use client";

import { useEffect, useRef } from "react";

import { drawFruit } from "@/games/suika/render";

// 목록용 아이콘 — 합이 10이 되는 사과 네 개. 게임의 규칙 자체를 그림으로 보여준다.
const CELLS = [3, 7, 6, 4];

export function AppleIcon({ size = 44 }: { size?: number }) {
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

    const half = size / 2;
    CELLS.forEach((v, i) => {
      const cx = (i % 2) * half + half / 2;
      const cy = Math.floor(i / 2) * half + half / 2 + size * 0.03;
      drawFruit(ctx, 5, cx, cy, half * 0.36, 0, 1);
      ctx.font = `700 ${size * 0.17}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = size * 0.04;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText(String(v), cx, cy);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(v), cx, cy);
    });
  }, [size]);

  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-black/35"
    >
      <canvas ref={ref} style={{ width: size, height: size }} role="img" aria-label="사과게임" />
    </div>
  );
}
