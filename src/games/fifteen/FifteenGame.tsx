"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { sequence, tone } from "@/games/sound";
import { SIZE, type Board, isSolved, neighbors, shuffle, solvedBoard } from "./logic";

// 4×4 숫자 슬라이드 퍼즐(15 퍼즐). 1~15 순서로 맞추면 끝 — 걸린 시간이 기록(짧을수록 상위).
type Phase = "ready" | "playing" | "done";

function fmt(ms: number): string {
  return `${(ms / 1000).toFixed(1)}초`;
}

export default function FifteenGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [board, setBoard] = useState<Board>(() => solvedBoard());
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const startRef = useRef(0);
  const reported = useRef(false);

  // 진행 중 경과 시간 표시.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    let b = shuffle(Math.random);
    if (isSolved(b)) b = shuffle(Math.random);
    setBoard(b);
    setMoves(0);
    setElapsed(0);
    reported.current = false;
    startRef.current = performance.now();
    setPhase("playing");
  }, []);

  const finish = useCallback(
    (ms: number) => {
      if (reported.current) return;
      reported.current = true;
      setElapsed(ms);
      setPhase("done");
      sequence(
        [
          { freq: 523, dur: 0.12, type: "triangle", gain: 0.16 },
          { freq: 659, dur: 0.12, type: "triangle", gain: 0.16 },
          { freq: 784, dur: 0.2, type: "triangle", gain: 0.18 },
        ],
        0.1
      );
      onGameOver(Math.round(ms), { game: "fifteen" });
    },
    [onGameOver]
  );

  function tap(i: number) {
    if (phase !== "playing") return;
    const blank = board.indexOf(0);
    if (!neighbors(blank).includes(i)) return;
    const next = board.slice();
    [next[blank], next[i]] = [next[i], next[blank]];
    setBoard(next);
    setMoves((m) => m + 1);
    tone({ freq: 300, type: "sine", gain: 0.08, dur: 0.05 });
    if (isSolved(next)) finish(performance.now() - startRef.current);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="시간" value={fmt(elapsed)} width="5rem" accent />
          <Stat label="이동" value={String(moves)} width="4rem" />
          <Stat label="베스트" value={bestScore != null ? fmt(bestScore) : "-"} width="5rem" />
        </div>
        <button
          onClick={() => setPhase("ready")}
          disabled={phase === "ready"}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-40"
        >
          새 게임
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <div
          className="grid touch-none select-none gap-1.5 rounded-xl bg-black/25 p-1.5"
          style={{
            aspectRatio: "1 / 1",
            gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
          }}
        >
          {board.map((n, i) =>
            n === 0 ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                onClick={() => tap(i)}
                disabled={phase !== "playing"}
                className="flex touch-none items-center justify-center rounded-lg bg-gradient-to-b from-grass/80 to-grass/60 font-display text-3xl text-pitch-base transition-transform active:scale-95 disabled:opacity-90"
              >
                {n}
              </button>
            )
          )}
        </div>

        {phase === "ready" && (
          <StartGate
            title="슬라이드 퍼즐"
            lines={["1~8을 순서대로 맞춰요.", "빈칸 옆 타일을 눌러 밀어요.", "다 맞추는 데 걸린 시간이 기록!"]}
            onStart={start}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">완성! 🎉</p>
            <p className="text-sm text-ink-dim">
              기록 <span className="tabular text-gold">{fmt(elapsed)}</span> · {moves}이동
            </p>
            <RetryButton submitting={submitting} onRetry={start} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, width, accent }: { label: string; value: string; width: string; accent?: boolean }) {
  return (
    <div style={{ width }} className="shrink-0 rounded-lg bg-black/20 px-2 py-1.5 text-center">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div className={`tabular whitespace-nowrap font-display text-base ${accent ? "text-gold" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
