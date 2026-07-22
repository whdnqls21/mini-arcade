"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import { thud } from "@/games/sound";
import type { GamePlayProps } from "@/games/types";
import { H, newState, type PoopState, scoreOf, setDir, step, W } from "./logic";
import { drawScene } from "./render";

const DT = 1 / 60; // 물리 고정 스텝(초)

export default function PoopGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<PoopState>(newState());
  const runningRef = useRef(false);
  const held = useRef({ left: false, right: false });
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [dead, setDead] = useState(false);
  const reported = useRef(false);

  const applyDir = useCallback(() => {
    const d = (held.current.right ? 1 : 0) - (held.current.left ? 1 : 0);
    setDir(stateRef.current, d as -1 | 0 | 1);
  }, []);

  const begin = useCallback(() => {
    stateRef.current = newState();
    held.current = { left: false, right: false };
    runningRef.current = true;
    reported.current = false;
    setScore(0);
    setDead(false);
    setStarted(true);
  }, []);

  const reset = useCallback(() => {
    runningRef.current = false;
    stateRef.current = newState();
    held.current = { left: false, right: false };
    setScore(0);
    setDead(false);
    setStarted(false);
    reported.current = false;
  }, []);

  const press = useCallback(
    (side: "left" | "right", on: boolean) => {
      held.current[side] = on;
      applyDir();
    },
    [applyDir]
  );

  useEffect(() => {
    if (dead && !reported.current) {
      reported.current = true;
      onGameOver(score, { game: "poop" });
    }
  }, [dead, score, onGameOver]);

  // 키보드 — 좌우 화살표로도 이동(누르는 동안).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        press("left", true);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        press("right", true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft") press("left", false);
      else if (e.code === "ArrowRight") press("right", false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [press]);

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
          thud(0.26, 0.32);
        }
      }

      drawScene(ctx, canvas, s);
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
          <Stat label="버틴 시간" value={`${(score / 1000).toFixed(2)}초`} width="6rem" />
          <Stat
            label="베스트"
            value={bestScore != null ? `${(bestScore / 1000).toFixed(2)}초` : "-"}
            width="6rem"
            accent
          />
        </div>
        <button
          onClick={reset}
          disabled={!started}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-40"
        >
          새 게임
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <canvas
          ref={canvasRef}
          style={{ aspectRatio: `${W} / ${H}` }}
          className="w-full touch-none select-none rounded-xl bg-black/25"
        />

        {!started && !dead && (
          <StartGate
            title="똥 피하기"
            lines={["위에서 떨어지는 똥을 피하세요!", "아래 ◀ ▶ 버튼으로 좌우 이동.", "오래 버틸수록 고득점."]}
            onStart={begin}
          />
        )}

        {dead && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">똥 맞았다! 💩</p>
            <p className="text-sm text-ink-dim">
              버틴 시간 <span className="tabular text-gold">{(score / 1000).toFixed(2)}초</span>
            </p>
            <RetryButton submitting={submitting} onRetry={begin} />
          </div>
        )}
      </div>

      {/* 조작 — 누르는 동안 그 방향으로 이동. */}
      <div className="flex gap-2">
        <MoveButton label="왼쪽" icon="◀" onPress={() => press("left", true)} onRelease={() => press("left", false)} />
        <MoveButton label="오른쪽" icon="▶" onPress={() => press("right", true)} onRelease={() => press("right", false)} />
      </div>
    </div>
  );
}

function MoveButton({
  label,
  icon,
  onPress,
  onRelease,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  onRelease: () => void;
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
      className="flex flex-1 touch-none select-none items-center justify-center gap-2 rounded-xl border border-pitch-line bg-black/25 py-3.5 font-display text-lg text-ink-dim transition-colors active:border-grass/50 active:bg-grass/10 active:text-grass"
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
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
