"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { sequence, tone } from "@/games/sound";

// 사이먼 — 점점 길어지는 색·소리 순서를 그대로 따라 누르기. 도달한 라운드(순서 길이)가 점수.
type Phase = "ready" | "showing" | "input" | "done";

const PADS = [
  { on: "#38e07b", off: "#123a22", freq: 415 },
  { on: "#ff6b6b", off: "#3a1717", freq: 311 },
  { on: "#ffd23f", off: "#3a3110", freq: 247 },
  { on: "#54a0ff", off: "#132a3a", freq: 208 },
];

export default function SimonGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const inputIdx = useRef(0);
  const scoreRef = useRef(0);
  const reported = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const flash = useCallback((pad: number, dur: number) => {
    setLit(pad);
    tone({ freq: PADS[pad].freq, type: "sine", gain: 0.14, dur: (dur / 1000) * 0.9 });
    timers.current.push(setTimeout(() => setLit((c) => (c === pad ? null : c)), dur));
  }, []);

  const playSeq = useCallback(
    (s: number[]) => {
      setPhase("showing");
      clearTimers();
      const dur = Math.max(200, 440 - s.length * 14);
      const gap = dur + 110;
      s.forEach((pad, i) => {
        timers.current.push(setTimeout(() => flash(pad, dur), i * gap + 350));
      });
      timers.current.push(
        setTimeout(() => {
          inputIdx.current = 0;
          setPhase("input");
        }, s.length * gap + 350)
      );
    },
    [flash]
  );

  const start = useCallback(() => {
    reported.current = false;
    scoreRef.current = 0;
    setScore(0);
    const first = [Math.floor(Math.random() * 4)];
    setSeq(first);
    playSeq(first);
  }, [playSeq]);

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    clearTimers();
    setLit(null);
    setPhase("done");
    tone({ freq: 120, type: "sawtooth", gain: 0.1, dur: 0.32 });
    onGameOver(scoreRef.current, { game: "simon" });
  }, [onGameOver]);

  function tap(pad: number) {
    if (phase !== "input") return;
    flash(pad, 200);
    if (pad === seq[inputIdx.current]) {
      inputIdx.current += 1;
      if (inputIdx.current === seq.length) {
        // 이번 순서 통과 → 점수 = 순서 길이, 한 칸 늘려 다음 라운드.
        scoreRef.current = seq.length;
        setScore(seq.length);
        tone({ freq: 660, type: "triangle", gain: 0.12, dur: 0.12 });
        const next = [...seq, Math.floor(Math.random() * 4)];
        timers.current.push(
          setTimeout(() => {
            setSeq(next);
            playSeq(next);
          }, 620)
        );
      }
    } else {
      finish();
    }
  }

  const showing = phase === "showing";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="라운드" value={String(score)} width="4.5rem" accent />
          <Stat label="베스트" value={bestScore != null ? String(bestScore) : "-"} width="4.5rem" />
        </div>
        <span className="text-xs text-ink-faint">
          {phase === "showing" ? "잘 보세요…" : phase === "input" ? "따라 누르세요!" : ""}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[20rem]">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/25 p-2 touch-none select-none" style={{ aspectRatio: "1 / 1" }}>
          {PADS.map((p, i) => (
            <button
              key={i}
              onClick={() => tap(i)}
              disabled={phase !== "input"}
              aria-label={`패드 ${i + 1}`}
              className="touch-none rounded-xl transition-all duration-100 active:scale-95"
              style={{ backgroundColor: lit === i ? p.on : p.off, boxShadow: lit === i ? `0 0 24px ${p.on}` : "none" }}
            />
          ))}
        </div>

        {phase === "ready" && (
          <StartGate
            title="사이먼"
            lines={["색이 반짝이는 순서를 기억해요.", "그대로 따라 누르면 다음 라운드!", "순서가 점점 길어져요."]}
            onStart={start}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/80">
            <p className="font-display text-2xl text-ink">삐— 틀렸어요</p>
            <p className="text-sm text-ink-dim">
              라운드 <span className="tabular text-gold">{score}</span>
            </p>
            <RetryButton submitting={submitting} onRetry={start} />
          </div>
        )}

        {showing && <div className="pointer-events-none absolute inset-0" />}
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
