"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GamePlayProps } from "@/games/types";
import { drawFruit } from "@/games/suika/render";
import {
  type Board,
  type Cell,
  COLS,
  cellOf,
  findAnyMove,
  findPath,
  indexOf,
  newBoard,
  remaining,
  reshuffle,
  ROWS,
} from "./logic";
import { RetryButton, StartGate } from "@/games/shared";
import { faceOf, TILE_EDGE } from "./tiles";

const CELL = 40; // 월드 좌표 한 칸
const W = COLS * CELL;
const H = ROWS * CELL;
const CLEAR_DELAY_MS = 240; // 연결선을 보여주는 시간

export default function MahjongGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [board, setBoard] = useState<Board>(() => newBoard());
  const [picked, setPicked] = useState<Cell | null>(null);
  // 리렌더 전에 두 번째 탭이 들어와도 첫 선택을 놓치지 않도록 동기 사본을 둔다.
  const pickedRef = useRef<Cell | null>(null);
  const [path, setPath] = useState<{ x: number; y: number }[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const startRef = useRef(0);
  const reported = useRef(false);
  const locked = useRef(false);

  const left = remaining(board);
  const stuck = useMemo(
    () => started && !done && left > 0 && !findAnyMove(board),
    [board, started, done, left]
  );

  const pick = useCallback((cell: Cell | null) => {
    pickedRef.current = cell;
    setPicked(cell);
  }, []);

  // 시간 기록 게임이라 판을 본 순간부터 재면 불공평하다. 시작을 누른 시점부터 잰다.
  const begin = useCallback(() => {
    startRef.current = performance.now();
    setElapsed(0);
    setStarted(true);
  }, []);

  const reset = useCallback(() => {
    setBoard(newBoard());
    pick(null);
    setPath(null);
    setDone(false);
    setStarted(false);
    setElapsed(0);
    reported.current = false;
    locked.current = false;
  }, [pick]);

  // 경과 시간 — 시작 시각과의 차이로 계산해 누적 오차를 없앤다.
  useEffect(() => {
    if (!started || done) return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [started, done]);

  // 다 지우면 그때의 경과 시간이 곧 기록. 완주하지 못하면 기록하지 않는다.
  useEffect(() => {
    if (!started || left !== 0 || reported.current) return;
    reported.current = true;
    const ms = Math.round(performance.now() - startRef.current);
    setElapsed(ms);
    setDone(true);
    onGameOver(ms, { game: "mahjong" });
  }, [started, left, onGameOver]);

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

    for (let i = 0; i < COLS * ROWS; i++) {
      const v = board[i];
      if (!v) continue;
      const { c, r } = cellOf(i);
      const f = faceOf(v);
      const x = c * CELL;
      const y = r * CELL;
      const isPicked = pickedRef.current?.c === c && pickedRef.current?.r === r;

      // 과일 색이 비슷해도 구분되도록 얼굴마다 바탕색을 다르게 준다.
      ctx.fillStyle = f.bg;
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3, 6);
      ctx.fill();
      ctx.strokeStyle = isPicked ? "#4de0c0" : TILE_EDGE;
      ctx.lineWidth = isPicked ? 2.5 : 1;
      ctx.stroke();

      drawFruit(ctx, f.fruit, x + CELL / 2, y + CELL / 2 + CELL * 0.05, CELL * 0.32, 0, 1);
    }
  }, [board, picked]);

  // ── 입력 ───────────────────────────────────────────────────────────
  function tap(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!started || done || locked.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    if (!board[indexOf(c, r)]) return;

    const here: Cell = { c, r };
    const prev = pickedRef.current;
    if (!prev) {
      pick(here);
      return;
    }
    if (prev.c === c && prev.r === r) {
      pick(null);
      return;
    }

    const found = findPath(board, prev, here);
    if (!found) {
      // 짝이 안 맞으면 방금 누른 타일로 선택을 옮긴다(다시 누르는 수고를 덜어준다).
      pick(here);
      return;
    }

    locked.current = true;
    setPath(found);
    const a = prev;
    pick(null);
    setTimeout(() => {
      setBoard((cur) => {
        const next = cur.slice();
        next[indexOf(a.c, a.r)] = 0;
        next[indexOf(c, r)] = 0;
        return next;
      });
      setPath(null);
      locked.current = false;
    }, CLEAR_DELAY_MS);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="경과" value={`${(elapsed / 1000).toFixed(1)}초`} />
          <Stat
            label="베스트"
            value={bestScore != null ? `${(bestScore / 1000).toFixed(2)}초` : "-"}
            accent
          />
          <Stat label="남은 패" value={`${left}`} />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setBoard((cur) => reshuffle(cur));
              pick(null);
            }}
            disabled={!started || done || left === 0}
            className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-40 ${
              stuck
                ? "border-gold/60 bg-gold/15 text-gold"
                : "border-pitch-line bg-black/20 text-ink-dim hover:text-ink"
            }`}
          >
            섞기
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink"
          >
            새 게임
          </button>
        </div>
      </div>

      {stuck && (
        <p className="rounded-lg bg-gold/10 px-3 py-2 text-center text-xs text-gold">
          더 이을 수 있는 짝이 없어요. 섞기를 누르세요. (시간은 계속 흘러갑니다)
        </p>
      )}

      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={tap}
          style={{ aspectRatio: `${W} / ${H}` }}
          className="w-full touch-none select-none rounded-xl bg-black/25"
        />

        {/* 연결선 — 판 바깥으로 돌아가는 경로도 보여야 해서 넘침을 허용한다 */}
        {path && (
          <svg
            viewBox={`0 0 ${COLS} ${ROWS}`}
            preserveAspectRatio="none"
            style={{ overflow: "visible" }}
            className="pointer-events-none absolute inset-0 z-10"
          >
            <polyline
              points={path.map((p) => `${p.x - 0.5},${p.y - 0.5}`).join(" ")}
              fill="none"
              stroke="#4de0c0"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {!started && !done && (
          <StartGate
            title="사천성"
            lines={["같은 과일 두 장을 이어 모두 지우세요.", "시작을 누르면 시간이 흐릅니다."]}
            onStart={begin}
          />
        )}

        {done && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">완주!</p>
            <p className="text-sm text-ink-dim">
              기록 <span className="tabular text-gold">{(elapsed / 1000).toFixed(2)}초</span>
            </p>
            <RetryButton submitting={submitting} onRetry={reset} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-black/20 px-2.5 py-1.5 text-center">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div className={`tabular font-display text-base ${accent ? "text-gold" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
