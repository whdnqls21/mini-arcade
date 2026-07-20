"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GamePlayProps } from "@/games/types";
import { canMove, type Dir, type Grid, move, newGame, spawn } from "./logic";

const TILE_BG: Record<number, string> = {
  2: "#1e2a38",
  4: "#233346",
  8: "#2f6f5e",
  16: "#2f8a6e",
  32: "#33a37c",
  64: "#37c08c",
  128: "#c9a227",
  256: "#d4ac2a",
  512: "#e0b62e",
  1024: "#eebf31",
  2048: "#f4c64e",
};
const tileBg = (v: number) => TILE_BG[v] ?? "#f26d5b";
const tileColor = (v: number) => (v <= 4 ? "#9db0c4" : v >= 128 ? "#0d1117" : "#eaf1f7");
const fontSize = (v: number) => (v >= 1024 ? "1.1rem" : v >= 128 ? "1.35rem" : "1.6rem");

export default function Game2048({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [grid, setGrid] = useState<Grid>(() => newGame());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const reported = useRef(false);

  const reset = useCallback(() => {
    setGrid(newGame());
    setScore(0);
    setOver(false);
    reported.current = false;
  }, []);

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      setGrid((g) => {
        const { grid: moved, gained, moved: didMove } = move(g, dir);
        if (!didMove) return g;
        const next = spawn(moved);
        setScore((s) => s + gained);
        if (!canMove(next)) setOver(true);
        return next;
      });
    },
    [over]
  );

  // 게임 오버 시 점수 1회 보고
  useEffect(() => {
    if (over && !reported.current) {
      reported.current = true;
      onGameOver(score, { game: "2048" });
    }
  }, [over, score, onGameOver]);

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  // 스와이프
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Stat label="점수" value={score} />
          <Stat label="베스트" value={bestScore ?? 0} accent />
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink"
        >
          새 게임
        </button>
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative mx-auto w-full max-w-[22rem] touch-none select-none rounded-xl bg-black/30 p-2"
      >
        <div className="grid grid-cols-4 gap-2">
          {grid.flatMap((row, i) =>
            row.map((v, j) => (
              <div
                key={`${i}-${j}`}
                className="flex aspect-square items-center justify-center rounded-lg font-display"
                style={{
                  background: v === 0 ? "rgba(255,255,255,0.04)" : tileBg(v),
                  color: v === 0 ? "transparent" : tileColor(v),
                  fontSize: fontSize(v),
                }}
              >
                {v !== 0 ? v : ""}
              </div>
            ))
          )}
        </div>

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/70">
            <p className="font-display text-2xl text-ink">게임 오버</p>
            <p className="text-sm text-ink-dim">
              점수 <span className="tabular text-gold">{score}</span>
              {submitting && " · 기록 저장 중…"}
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

      <p className="text-center text-[11px] text-ink-faint">
        방향키 또는 스와이프로 타일을 밀어 합치세요. 게임이 끝나면 점수가 기록됩니다.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-1.5 text-center">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div className={`tabular font-display text-lg ${accent ? "text-gold" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
