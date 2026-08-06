"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { sequence, tone } from "@/games/sound";

// 위치 기억 — 잠깐 켜진 칸들을 기억해 그대로 탭. 레벨마다 칸 수·격자가 커지고, 라이프 3개.
// 폭(span)이 아니라 '면적'이 커져서 점수가 넓게 퍼진다.
type Phase = "ready" | "show" | "input" | "done";
const LIVES = 3;

function config(level: number): { gridN: number; tiles: number } {
  const gridN = Math.min(7, 3 + Math.floor((level - 1) / 3)); // 3×3 → (L4)4×4 → (L7)5×5 …
  const tiles = Math.min(gridN * gridN - 2, level + 2); // L1=3칸부터
  return { gridN, tiles };
}

function pickTargets(gridN: number, tiles: number): Set<number> {
  const all = Array.from({ length: gridN * gridN }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return new Set(all.slice(0, tiles));
}

export default function VisualMemoryGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState(1);
  const [gridN, setGridN] = useState(3);
  const [targets, setTargets] = useState<Set<number>>(new Set());
  const [found, setFound] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  const [lives, setLives] = useState(LIVES);

  const livesRef = useRef(LIVES);
  const levelRef = useRef(1);
  const reported = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    timer.current = null;
    wrongTimer.current = null;
  };
  useEffect(() => () => clearTimers(), []);

  const startLevel = useCallback((lv: number) => {
    const { gridN: gn, tiles } = config(lv);
    levelRef.current = lv;
    setLevel(lv);
    setGridN(gn);
    setFound(new Set());
    setWrong(null);
    const t = pickTargets(gn, tiles);
    setTargets(t);
    setPhase("show");
    tone({ freq: 440, type: "sine", gain: 0.07, dur: 0.08 });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase("input"), 650 + tiles * 80);
  }, []);

  const start = useCallback(() => {
    reported.current = false;
    livesRef.current = LIVES;
    setLives(LIVES);
    startLevel(1);
  }, [startLevel]);

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    clearTimers();
    setPhase("done");
    tone({ freq: 120, type: "sawtooth", gain: 0.1, dur: 0.3 });
    onGameOver(levelRef.current - 1, { game: "visualmemory" }); // 클리어한 레벨 수
  }, [onGameOver]);

  function tap(i: number) {
    if (phase !== "input" || found.has(i)) return;
    if (targets.has(i)) {
      const nf = new Set(found).add(i);
      setFound(nf);
      tone({ freq: 620, type: "triangle", gain: 0.1, dur: 0.06 });
      if (nf.size === targets.size) {
        // 이번 레벨 클리어 → 다음.
        sequence([{ freq: 523, dur: 0.09, type: "triangle", gain: 0.14 }, { freq: 784, dur: 0.12, type: "triangle", gain: 0.15 }], 0.06);
        timer.current = setTimeout(() => startLevel(levelRef.current + 1), 480);
      }
    } else {
      // 오답 — 라이프 감소 + 빨간 표시. 0이면 종료, 남으면 패턴을 한 번 더 보여준다.
      tone({ freq: 160, type: "sawtooth", gain: 0.09, dur: 0.14 });
      setWrong(i);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrong((w) => (w === i ? null : w)), 260);
      livesRef.current -= 1;
      setLives(livesRef.current);
      if (livesRef.current <= 0) {
        finish();
      } else {
        // 다시 보기 — show 단계를 재사용(맞힌 칸은 그대로 유지).
        setPhase("show");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setPhase("input"), 500 + targets.size * 70);
      }
    }
  }

  const showing = phase === "show";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="레벨" value={String(level)} width="4rem" accent />
          <Stat label="베스트" value={bestScore != null ? String(bestScore) : "-"} width="4.5rem" />
        </div>
        <div className="flex items-center gap-1 text-lg" aria-label={`라이프 ${lives}`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} className={i < lives ? "" : "opacity-25 grayscale"}>
              💚
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <div
          className="grid touch-none select-none gap-1.5 rounded-xl bg-black/25 p-2"
          style={{
            aspectRatio: "1 / 1",
            gridTemplateColumns: `repeat(${gridN}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridN}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: gridN * gridN }, (_, i) => {
            const lit = showing && targets.has(i);
            const ok = found.has(i);
            const bad = wrong === i;
            return (
              <button
                key={i}
                onClick={() => tap(i)}
                disabled={phase !== "input"}
                aria-label="칸"
                className={`touch-none rounded-lg transition-colors duration-150 ${
                  bad
                    ? "bg-danger"
                    : ok
                      ? "bg-grass"
                      : lit
                        ? "bg-ink"
                        : "bg-black/40"
                }`}
              />
            );
          })}
        </div>

        {phase === "ready" && (
          <StartGate
            title="위치 기억"
            lines={["잠깐 켜지는 칸들을 기억해요.", "꺼지면 그 칸들을 모두 탭!", "틀리면 한 번 더 보여줘요. 실수 3번이면 끝."]}
            onStart={start}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">게임 끝!</p>
            <p className="text-sm text-ink-dim">
              <span className="tabular text-gold">{Math.max(0, level - 1)}</span>레벨 클리어
            </p>
            <RetryButton submitting={submitting} onRetry={start} />
          </div>
        )}
      </div>

      <p className="text-center text-xs text-ink-faint">
        {phase === "show" ? "잘 보세요…" : phase === "input" ? `켜졌던 ${targets.size}칸을 찾으세요 (${found.size}/${targets.size})` : ""}
      </p>
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
