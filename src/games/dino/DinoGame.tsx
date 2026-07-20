"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import { thud, tone } from "@/games/sound";
import type { GamePlayProps } from "@/games/types";
import { type DinoState, H, jump, newState, scoreOf, setSlide, step, W } from "./logic";
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
    if (jump(stateRef.current)) {
      tone({ freq: 380, type: "square", gain: 0.1, dur: 0.12, glideTo: 620 });
    }
  }, []);

  const slide = useCallback((on: boolean) => {
    if (!runningRef.current) return;
    setSlide(stateRef.current, on);
  }, []);

  useEffect(() => {
    if (dead && !reported.current) {
      reported.current = true;
      onGameOver(score, { game: "dino" });
    }
  }, [dead, score, onGameOver]);

  // 키보드 — 위/스페이스 점프, 아래 슬라이드(누르는 동안)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!runningRef.current && !dead) begin();
        else doJump();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        slide(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") slide(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [doJump, slide, begin, dead]);

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
      if (rect.width === 0) return;
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
          thud(0.24, 0.3);
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
          style={{ aspectRatio: `${W} / ${H}` }}
          className="w-full touch-none select-none rounded-xl bg-black/25"
        />

        {!started && !dead && (
          <StartGate
            title="크롬 다이노"
            lines={["장애물은 점프로 넘고, 붉은 바는 슬라이드로 지나세요.", "아래 왼쪽 슬라이드 · 오른쪽 점프."]}
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

      {/* 조작 버튼 — 왼쪽 슬라이드(누르는 동안), 오른쪽 점프. */}
      <div className="flex gap-2">
        <CommandButton
          label="슬라이드"
          icon="▼"
          onPress={() => slide(true)}
          onRelease={() => slide(false)}
        />
        <CommandButton label="점프" icon="▲" onPress={doJump} />
      </div>
    </div>
  );
}

// 점프는 누르는 순간 한 번, 슬라이드는 누르는 동안 유지 → onPress/onRelease 로 나눈다.
function CommandButton({
  label,
  icon,
  onPress,
  onRelease,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  onRelease?: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      onContextMenu={(e) => e.preventDefault()}
      className="flex flex-1 select-none items-center justify-center gap-2 rounded-xl border border-pitch-line bg-black/25 py-3.5 font-display text-lg text-ink-dim transition-colors active:border-grass/50 active:bg-grass/10 active:text-grass"
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
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
