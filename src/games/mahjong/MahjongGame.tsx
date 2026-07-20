"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GamePlayProps } from "@/games/types";
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
import { faceOf, TILE_BG, TILE_EDGE } from "./tiles";

const CLEAR_DELAY_MS = 240; // 연결선을 보여주는 시간

export default function MahjongGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [board, setBoard] = useState<Board>(() => newBoard());
  const [picked, setPicked] = useState<Cell | null>(null);
  // 리렌더 전에 두 번째 탭이 들어와도 첫 선택을 놓치지 않도록 동기 사본을 둔다.
  const pickedRef = useRef<Cell | null>(null);
  const [path, setPath] = useState<{ x: number; y: number }[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(0);
  const reported = useRef(false);
  const locked = useRef(false);

  const left = remaining(board);
  const stuck = useMemo(() => !done && left > 0 && !findAnyMove(board), [board, done, left]);

  // 선택을 바꾸는 유일한 통로 — ref 와 state 를 함께 갱신한다.
  const pick = useCallback((cell: Cell | null) => {
    pickedRef.current = cell;
    setPicked(cell);
  }, []);

  const reset = useCallback(() => {
    setBoard(newBoard());
    pick(null);
    setPath(null);
    setDone(false);
    setElapsed(0);
    startRef.current = performance.now();
    reported.current = false;
    locked.current = false;
  }, [pick]);

  useEffect(() => {
    startRef.current = performance.now();
  }, []);

  // 경과 시간 — 시작 시각과의 차이로 계산해 누적 오차를 없앤다.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [done]);

  // 다 지우면 그때의 경과 시간이 곧 기록. 완주하지 못하면 기록하지 않는다.
  useEffect(() => {
    if (left === 0 && !reported.current) {
      reported.current = true;
      const ms = Math.round(performance.now() - startRef.current);
      setElapsed(ms);
      setDone(true);
      onGameOver(ms, { game: "mahjong" });
    }
  }, [left, onGameOver]);

  function tap(c: number, r: number) {
    if (done || locked.current) return;
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

  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="경과" value={`${seconds}초`} />
          <Stat label="베스트" value={bestScore != null ? `${(bestScore / 1000).toFixed(2)}초` : "-"} accent />
          <Stat label="남은 패" value={`${left}`} />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setBoard((cur) => reshuffle(cur));
              pick(null);
            }}
            disabled={done || left === 0}
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
        <div
          className="grid gap-[2px] rounded-xl bg-black/25 p-1.5"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: COLS * ROWS }, (_, i) => {
            const { c, r } = cellOf(i);
            const v = board[i];
            const isPicked = picked?.c === c && picked?.r === r;
            return (
              <Tile key={i} value={v} picked={isPicked} onTap={() => tap(c, r)} />
            );
          })}
        </div>

        {/* 연결선 — 판 바깥으로 돌아가는 경로도 보여야 해서 넘침을 허용한다 */}
        {path && (
          <svg
            viewBox={`0 0 ${COLS} ${ROWS}`}
            preserveAspectRatio="none"
            style={{ overflow: "visible" }}
            className="pointer-events-none absolute inset-1.5 z-10"
          >
            <polyline
              points={path.map((p) => `${p.x - 0.5},${p.y - 0.5}`).join(" ")}
              fill="none"
              stroke="#4de0c0"
              strokeWidth="0.09"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {done && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">완주!</p>
            <p className="text-sm text-ink-dim">
              기록 <span className="tabular text-gold">{(elapsed / 1000).toFixed(2)}초</span>
              {submitting && " · 저장 중…"}
            </p>
            <button
              onClick={reset}
              className="rounded-xl bg-grass px-5 py-2.5 font-display text-pitch-base"
            >
              다시 하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({
  value,
  picked,
  onTap,
}: {
  value: number;
  picked: boolean;
  onTap: () => void;
}) {
  if (!value) return <span className="aspect-[3/4]" />;
  const f = faceOf(value);
  return (
    <button
      onClick={onTap}
      style={{
        background: TILE_BG,
        borderColor: picked ? "#4de0c0" : TILE_EDGE,
        boxShadow: picked ? "0 0 0 2px #4de0c0" : "inset 0 -2px 0 rgba(0,0,0,0.16)",
      }}
      className="flex aspect-[3/4] flex-col items-center justify-center rounded border leading-none transition-transform active:scale-95"
    >
      <span
        className="tabular font-display"
        style={{ color: f.color, fontSize: "min(3.6vw, 1rem)" }}
      >
        {f.num}
      </span>
      <span style={{ color: f.color, fontSize: "min(2.6vw, 0.7rem)", opacity: 0.85 }}>
        {f.mark}
      </span>
    </button>
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
