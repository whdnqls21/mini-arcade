"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

// 그리기 캔버스 — 획(stroke) 배열로 관리해 undo/전체지우기를 지원한다.
// 부모는 ref 로 toDataURL()/isEmpty() 를 호출해 제출 시 이미지를 얻는다.

export interface DrawCanvasHandle {
  toDataURL: () => string;
  isEmpty: () => boolean;
}

const SIZE = 320; // 논리 캔버스 크기
const BG = "#ffffff";
const COLORS = [
  "#111827", // 검정
  "#6b7280", // 회색
  "#ef4444", // 빨강
  "#f97316", // 주황
  "#f59e0b", // 호박
  "#facc15", // 노랑
  "#84cc16", // 연두
  "#22c55e", // 초록
  "#14b8a6", // 청록
  "#06b6d4", // 하늘
  "#3b82f6", // 파랑
  "#6366f1", // 남색
  "#a855f7", // 보라
  "#d946ef", // 자홍
  "#ec4899", // 분홍
  "#f9a8d4", // 연분홍
  "#78350f", // 갈색
  "#d2a679", // 살구
];
const WIDTHS = [3, 7, 14];

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export const DrawCanvas = forwardRef<DrawCanvasHandle>(function DrawCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const clearedRef = useRef<Stroke[] | null>(null); // 전체 지우기 직전 상태(되돌리기용)
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [eraser, setEraser] = useState(false);
  const [, force] = useState(0); // undo/clear 후 버튼 상태 갱신용

  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();
    for (const s of strokesRef.current) drawStroke(ctx, s);
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = SIZE * ratio;
    cv.height = SIZE * ratio;
    const ctx = cv.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);
    redraw();
  }, [redraw]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokesRef.current.length === 0,
    toDataURL: () => {
      // 논리 크기(320) 흰 배경에 다시 그려 내보낸다(고정 해상도).
      const out = document.createElement("canvas");
      out.width = SIZE;
      out.height = SIZE;
      const ctx = out.getContext("2d");
      if (ctx) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, SIZE, SIZE);
        for (const s of strokesRef.current) drawStroke(ctx, s);
      }
      const webp = out.toDataURL("image/webp", 0.8);
      return webp.startsWith("data:image/webp") ? webp : out.toDataURL("image/png");
    },
  }));

  const posOf = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    return { x: Math.max(0, Math.min(SIZE, x)), y: Math.max(0, Math.min(SIZE, y)) };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const stroke: Stroke = {
      color: eraser ? BG : color,
      width: eraser ? Math.max(width, 16) : width,
      points: [posOf(e)],
    };
    drawingRef.current = stroke;
    strokesRef.current.push(stroke);
    clearedRef.current = null; // 새로 그리기 시작하면 '전체 지우기 되돌리기'는 무효
    redraw();
  };

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current.points.push(posOf(e));
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawStroke(ctx, drawingRef.current);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = null;
    force((n) => n + 1);
  };

  const undo = () => {
    // 방금 전체 지우기를 했다면(획은 비었고 백업이 있음) 그 상태를 통째로 복구.
    if (strokesRef.current.length === 0 && clearedRef.current) {
      strokesRef.current = clearedRef.current;
      clearedRef.current = null;
    } else {
      strokesRef.current.pop();
    }
    redraw();
    force((n) => n + 1);
  };
  const clearAll = () => {
    if (strokesRef.current.length === 0) return;
    clearedRef.current = strokesRef.current; // 되돌리기로 복구할 수 있게 백업
    strokesRef.current = [];
    redraw();
    force((n) => n + 1);
  };

  const empty = strokesRef.current.length === 0;
  const canUndo = strokesRef.current.length > 0 || clearedRef.current != null;

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className="mx-auto w-full max-w-[20rem] touch-none rounded-xl border border-pitch-line bg-white"
        style={{ aspectRatio: "1 / 1" }}
      />

      {/* 색상 */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setEraser(false);
            }}
            aria-label={`색 ${c}`}
            className={`h-7 w-7 rounded-full border-2 transition-transform ${
              !eraser && color === c ? "scale-110 border-ink" : "border-pitch-line"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* 굵기 + 지우개 */}
      <div className="flex items-center justify-center gap-2">
        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            aria-label={`굵기 ${w}`}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
              width === w ? "border-grass bg-grass/15" : "border-pitch-line"
            }`}
          >
            <span className="rounded-full bg-ink" style={{ width: w + 2, height: w + 2 }} />
          </button>
        ))}
        <button
          onClick={() => setEraser((v) => !v)}
          className={`h-9 rounded-lg border px-3 text-sm ${
            eraser ? "border-grass bg-grass/15 text-grass" : "border-pitch-line text-ink-dim"
          }`}
        >
          지우개
        </button>
      </div>

      {/* 되돌리기 / 전체 지우기 */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="h-9 rounded-lg border border-pitch-line px-4 text-sm text-ink-dim disabled:opacity-40"
        >
          되돌리기
        </button>
        <button
          onClick={clearAll}
          disabled={empty}
          className="h-9 rounded-lg border border-pitch-line px-4 text-sm text-ink-dim disabled:opacity-40"
        >
          전체 지우기
        </button>
      </div>
    </div>
  );
});

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length === 0) return;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (s.points.length === 1) {
    const p = s.points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
  ctx.stroke();
}
