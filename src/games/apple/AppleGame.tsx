"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { drawFruit } from "@/games/suika/render";
import {
  type Board,
  CELLS,
  clearRect,
  COLS,
  countMoves,
  isValid,
  newBoard,
  normalizeRect,
  type Rect,
  rectStats,
  ROWS,
  TARGET,
  TIME_LIMIT_MS,
} from "./logic";

const APPLE = 5; // 과일 그림표의 '사과' — 수박게임과 같은 그림을 쓴다
const CELL = 44; // 월드 좌표 한 칸
const W = COLS * CELL;
const H = ROWS * CELL;

interface Drag {
  from: { c: number; r: number };
  to: { c: number; r: number };
}

export default function AppleGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [board, setBoard] = useState<Board>(() => newBoard());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [leftMs, setLeftMs] = useState(TIME_LIMIT_MS);
  const endAtRef = useRef(0);
  const reported = useRef(false);

  const reset = useCallback(() => {
    setBoard(newBoard());
    setScore(0);
    setDrag(null);
    setOver(false);
    setStarted(false);
    setLeftMs(TIME_LIMIT_MS);
    reported.current = false;
  }, []);

  // 제한 시간이 있는 게임이라 판을 본 순간부터 재면 불공평하다. 시작을 누른 시점부터 잰다.
  const begin = useCallback(() => {
    endAtRef.current = performance.now() + TIME_LIMIT_MS;
    setLeftMs(TIME_LIMIT_MS);
    setStarted(true);
  }, []);

  // 남은 시간은 목표 시각과의 차이로 계산해 setInterval 누적 오차를 피한다.
  useEffect(() => {
    if (!started || over) return;
    const id = setInterval(() => {
      const left = Math.max(0, endAtRef.current - performance.now());
      setLeftMs(left);
      if (left <= 0) setOver(true);
    }, 100);
    return () => clearInterval(id);
  }, [started, over]);

  // 더 지울 수 있는 조합이 없으면 시간이 남아도 끝낸다.
  useEffect(() => {
    if (!started || over) return;
    if (countMoves(board) === 0) setOver(true);
  }, [started, board, over]);

  useEffect(() => {
    if (over && !reported.current) {
      reported.current = true;
      onGameOver(score, { game: "apple" });
    }
  }, [over, score, onGameOver]);

  // ── 그리기 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const scale = (rect.width * dpr) / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const sel = drag ? normalizeRect(drag.from, drag.to) : null;
    const stats = sel ? rectStats(board, sel) : null;
    const hit = stats?.sum === TARGET && stats.count > 0;

    // 선택 영역 — 합이 10이면 초록, 아니면 흐린 회색
    if (sel) {
      const x = sel.c0 * CELL;
      const y = sel.r0 * CELL;
      const w = (sel.c1 - sel.c0 + 1) * CELL;
      const h = (sel.r1 - sel.r0 + 1) * CELL;
      ctx.fillStyle = hit ? "rgba(77,224,192,0.18)" : "rgba(255,255,255,0.06)";
      ctx.strokeStyle = hit ? "#4de0c0" : "rgba(255,255,255,0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 8);
      ctx.fill();
      ctx.stroke();
    }

    // 사과 — 줄기가 칸 밖으로 새지 않게 반지름을 줄이고 살짝 아래로 놓는다
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board[r * COLS + c];
        if (v === 0) continue;
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2 + CELL * 0.06;
        drawFruit(ctx, APPLE, cx, cy, CELL * 0.36, 0, 1);

        ctx.font = `700 ${CELL * 0.42}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = CELL * 0.09;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.strokeText(String(v), cx, cy + CELL * 0.02);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(v), cx, cy + CELL * 0.02);
      }
    }

    // 드래그 중 현재 합
    if (sel && stats && stats.count > 0) {
      const cx = ((sel.c0 + sel.c1 + 1) / 2) * CELL;
      const top = sel.r0 * CELL;
      ctx.font = `700 ${CELL * 0.4}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const label = String(stats.sum);
      ctx.lineWidth = CELL * 0.1;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(label, cx, Math.max(CELL * 0.42, top - 3));
      ctx.fillStyle = hit ? "#4de0c0" : "#9db0c4";
      ctx.fillText(label, cx, Math.max(CELL * 0.42, top - 3));
    }
  }, [board, drag]);

  // ── 입력 ───────────────────────────────────────────────────────────
  const cellAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { c: 0, r: 0 };
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor(((clientX - rect.left) / rect.width) * COLS);
    const r = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
    return {
      c: Math.min(COLS - 1, Math.max(0, c)),
      r: Math.min(ROWS - 1, Math.max(0, r)),
    };
  }, []);

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!started || over) return;
    // 포인터 캡처는 부가 기능(캔버스 밖으로 나가도 드래그 유지)일 뿐이라
    // 실패해도 드래그 자체는 시작되어야 한다.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 무시
    }
    const cell = cellAt(e.clientX, e.clientY);
    setDrag({ from: cell, to: cell });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag || !started || over) return;
    setDrag({ from: drag.from, to: cellAt(e.clientX, e.clientY) });
  };

  const onUp = () => {
    if (!drag || !started || over) return;
    const rect: Rect = normalizeRect(drag.from, drag.to);
    setDrag(null);
    if (!isValid(board, rect)) return;
    const res = clearRect(board, rect);
    setBoard(res.board);
    setScore((s) => s + res.cleared);
  };

  const seconds = Math.ceil(leftMs / 1000);
  const ratio = leftMs / TIME_LIMIT_MS;
  const urgent = leftMs <= 15_000;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="지운 사과" value={score} />
          <Stat label="베스트" value={bestScore ?? 0} accent />
        </div>
        <button
          onClick={reset}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink"
        >
          새 게임
        </button>
      </div>

      {/* 남은 시간 */}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
          <div
            style={{ width: `${ratio * 100}%` }}
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
              urgent ? "bg-danger" : "bg-grass"
            }`}
          />
        </div>
        <span className={`tabular w-9 text-right text-sm ${urgent ? "text-danger" : "text-ink-dim"}`}>
          {seconds}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag(null)}
          style={{ aspectRatio: `${W} / ${H}` }}
          className="w-full touch-none select-none rounded-xl bg-black/25"
        />

        {!started && !over && (
          <StartGate
            title="사과게임"
            lines={["합이 10이 되게 사과를 묶어 지우세요.", "시작을 누르면 90초가 흐릅니다."]}
            onStart={begin}
          />
        )}

        {over && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/75">
            <p className="font-display text-2xl text-ink">
              {leftMs <= 0 ? "시간 종료" : "더 지울 수 없어요"}
            </p>
            <p className="text-sm text-ink-dim">
              사과 <span className="tabular text-gold">{score}</span>개 / {CELLS}개
            </p>
            <RetryButton submitting={submitting} onRetry={reset} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-1.5 text-center">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div className={`tabular font-display text-lg ${accent ? "text-gold" : "text-ink"}`}>{value}</div>
    </div>
  );
}
