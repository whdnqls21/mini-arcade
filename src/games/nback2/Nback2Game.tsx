"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { sequence, tone } from "@/games/sound";

// 2-back — 가운데 그림이 '두 개 전' 그림과 같으면 '일치'. 찍기 방지: 헛누름은 감점.
// 점수 = 잡은 일치 ×10 − 헛누름 ×5, 0 미만은 0.
type Phase = "ready" | "playing" | "done";

const SYMBOLS = ["🍎", "🍋", "🍇", "🥝", "🍑", "🫐"];
const TRIALS = 30;
const SHOW_MS = 1400; // 그림 보이는 시간
const TRIAL_MS = 2000; // 한 판(그림 + 빈 순간)
const TARGET_PROB = 0.32;
const HIT_PTS = 10;
const FA_PTS = 5;

function genSeq(): number[] {
  const s: number[] = [];
  for (let i = 0; i < TRIALS; i++) {
    if (i >= 2 && Math.random() < TARGET_PROB) {
      s.push(s[i - 2]); // 2-back 일치(정답 대상)
    } else {
      let v = Math.floor(Math.random() * SYMBOLS.length);
      while (i >= 2 && v === s[i - 2]) v = Math.floor(Math.random() * SYMBOLS.length);
      s.push(v);
    }
  }
  return s;
}

export default function Nback2Game({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [current, setCurrent] = useState<number | null>(null);
  const [blank, setBlank] = useState(false);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<"hit" | "fa" | null>(null);
  const [result, setResult] = useState<{ hits: number; targets: number; fa: number; score: number } | null>(null);

  const seqRef = useRef<number[]>([]);
  const idxRef = useRef(0);
  const pressedRef = useRef(false);
  const hitsRef = useRef(0);
  const faRef = useRef(0);
  const reported = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const finishGame = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    clearTimers();
    const targets = seqRef.current.filter((v, i) => i >= 2 && v === seqRef.current[i - 2]).length;
    const score = Math.max(0, hitsRef.current * HIT_PTS - faRef.current * FA_PTS);
    setResult({ hits: hitsRef.current, targets, fa: faRef.current, score });
    setPhase("done");
    sequence(
      [
        { freq: 523, dur: 0.1, type: "triangle", gain: 0.15 },
        { freq: 784, dur: 0.14, type: "triangle", gain: 0.16 },
      ],
      0.08
    );
    onGameOver(score, { game: "nback2" });
  }, [onGameOver]);

  const runTrial = useCallback(
    (i: number) => {
      if (i >= TRIALS) {
        finishGame();
        return;
      }
      idxRef.current = i;
      pressedRef.current = false;
      setIdx(i);
      setCurrent(seqRef.current[i]);
      setBlank(false);
      timers.current.push(setTimeout(() => setBlank(true), SHOW_MS));
      timers.current.push(
        setTimeout(() => {
          runTrial(i + 1);
        }, TRIAL_MS)
      );
    },
    [finishGame]
  );

  const start = useCallback(() => {
    reported.current = false;
    hitsRef.current = 0;
    faRef.current = 0;
    seqRef.current = genSeq();
    setResult(null);
    setFeedback(null);
    setPhase("playing");
    runTrial(0);
  }, [runTrial]);

  const press = () => {
    if (phase !== "playing" || pressedRef.current) return;
    pressedRef.current = true;
    const i = idxRef.current;
    const isTarget = i >= 2 && seqRef.current[i] === seqRef.current[i - 2];
    if (isTarget) {
      hitsRef.current += 1;
      setFeedback("hit");
      tone({ freq: 660, type: "triangle", gain: 0.12, dur: 0.1 });
    } else {
      faRef.current += 1;
      setFeedback("fa");
      tone({ freq: 160, type: "sawtooth", gain: 0.09, dur: 0.14 });
    }
    timers.current.push(setTimeout(() => setFeedback(null), 320));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Stat label="진행" value={phase === "playing" ? `${idx + 1}/${TRIALS}` : "-"} width="5rem" accent />
        <Stat label="베스트" value={bestScore != null ? String(bestScore) : "-"} width="4.5rem" />
        <span className="ml-auto text-xs text-ink-faint">두 개 전과 같으면 일치!</span>
      </div>

      <div className="relative mx-auto flex aspect-square w-full max-w-[22rem] items-center justify-center rounded-2xl bg-black/25">
        <span className="select-none text-7xl">{phase === "playing" && !blank && current != null ? SYMBOLS[current] : ""}</span>

        {phase === "ready" && (
          <StartGate
            title="2-백"
            lines={["그림이 하나씩 나와요.", "지금 그림이 '두 개 전'과 같으면 일치 버튼!", "헛누르면 감점 — 확실할 때만."]}
            onStart={start}
          />
        )}

        {phase === "done" && result && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/85">
            <p className="font-display text-2xl text-ink">끝!</p>
            <p className="text-sm text-ink-dim">
              점수 <span className="tabular text-gold">{result.score}</span>
            </p>
            <p className="text-xs text-ink-faint">
              잡은 일치 {result.hits}/{result.targets} · 헛누름 {result.fa}
            </p>
            <RetryButton submitting={submitting} onRetry={start} />
          </div>
        )}
      </div>

      <button
        onClick={press}
        disabled={phase !== "playing"}
        className={`touch-none rounded-2xl py-5 font-display text-xl transition-colors active:scale-95 disabled:opacity-40 ${
          feedback === "hit"
            ? "bg-grass text-pitch-base"
            : feedback === "fa"
              ? "bg-danger text-ink"
              : "bg-pitch-card text-ink border border-pitch-line hover:border-grass/40"
        }`}
      >
        일치 ✋
      </button>
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
