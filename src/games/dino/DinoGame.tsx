"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import {
  type DinoState,
  H,
  jump,
  newState,
  scoreOf,
  step,
  W,
} from "./logic";
import { drawScene } from "./render";

const DT = 1 / 60; // 물리 고정 스텝(초)

export default function DinoGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<DinoState>(newState());
  const runningRef = useRef(false);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [dead, setDead] = useState(false);
  const reported = useRef(false);

  const begin = useCallback(() => {
    stateRef.current = newState();
    runningRef.current = true;
    reported.current = false;
    setScore(0);
    setDead(false);
    setStarted(true);
  }, []);

  const reset = useCallback(() => {
    runningRef.current = false;
    stateRef.current = newState();
    setScore(0);
    setDead(false);
    setStarted(false);
    reported.current = false;
  }, []);

  const doJump = useCallback(() => {
    if (!runningRef.current) return;
    jump(stateRef.current);
  }, []);

  useEffect(() => {
    if (dead && !reported.current) {
      reported.current = true;
      onGameOver(score, { game: "dino" });
    }
  }, [dead, score, onGameOver]);

  // 키보드 — 스페이스/위쪽 화살표
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!runningRef.current && !dead) begin();
        else doJump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doJump, begin, dead]);

  // ── 물리 + 렌더 루프 ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const loop = (now: number) => {
      // 탭이 백그라운드였다 돌아오면 delta 가 커진다 — 한 번에 몰아 계산하지 않도록 자른다.
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;

      const s = stateRef.current;
      if (runningRef.current && !s.dead) {
        acc += delta;
        let guard = 0;
        while (acc >= DT && guard++ < 6) {
          step(s, DT);
          acc -= DT;
        }
        setScore(scoreOf(s));
        if (s.dead) {
          runningRef.current = false;
          setDead(true);
        }
      }

      drawScene(ctx, canvas, s, runningRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="점수" value={score} width="5rem" />
          <Stat label="베스트" value={bestScore ?? 0} width="5rem" accent />
        </div>
        <button
          onClick={reset}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink"
        >
          새 게임
        </button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={doJump}
          style={{ aspectRatio: `${W} / ${H}` }}
          className="w-full touch-none select-none rounded-xl bg-black/25"
        />

        {!started && !dead && (
          <StartGate
            title="크롬 다이노"
            lines={["장애물을 뛰어넘어 최대한 멀리 가세요.", "화면을 탭하거나 스페이스로 점프합니다."]}
            onStart={begin}
          />
        )}

        {dead && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">부딪혔다!</p>
            <p className="text-sm text-ink-dim">
              점수 <span className="tabular text-gold">{score}</span>
            </p>
            <RetryButton submitting={submitting} onRetry={begin} />
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-ink-faint">
        달릴수록 빨라집니다. 속도가 붙으면 높은 장애물과 무리가 나옵니다.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  width,
  accent,
}: {
  label: string;
  value: number;
  width: string;
  accent?: boolean;
}) {
  return (
    <div style={{ width }} className="shrink-0 rounded-lg bg-black/20 px-2 py-1.5 text-center">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div
        className={`tabular whitespace-nowrap font-display text-lg ${accent ? "text-gold" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}
