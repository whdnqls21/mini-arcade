"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { sequence, tick, tone } from "@/games/sound";

// 스트룹 — 글자의 '뜻'이 아니라 '색'을 빠르게 고른다. 30초 안에 맞힌 개수가 점수.
const DURATION_MS = 30_000;

const COLORS: { name: string; hex: string }[] = [
  { name: "빨강", hex: "#e5484d" },
  { name: "파랑", hex: "#4287f5" },
  { name: "초록", hex: "#46a758" },
  { name: "노랑", hex: "#f5c518" },
  { name: "보라", hex: "#a259e6" },
];

type Phase = "ready" | "playing" | "done";

interface Prompt {
  wordIdx: number; // 글자(뜻)
  inkIdx: number; // 글자 색(정답)
  options: number[]; // 보기 색 인덱스(정답 포함, 섞임)
}

function pick(n: number, exclude: number[] = []): number {
  let v = Math.floor(Math.random() * n);
  while (exclude.includes(v)) v = Math.floor(Math.random() * n);
  return v;
}

function makePrompt(): Prompt {
  const wordIdx = pick(COLORS.length);
  // 60% 는 뜻과 색을 다르게(스트룹 효과), 40% 는 같게.
  const inkIdx = Math.random() < 0.6 ? pick(COLORS.length, [wordIdx]) : wordIdx;
  const others: number[] = [];
  while (others.length < 3) {
    const v = pick(COLORS.length, [inkIdx, ...others]);
    others.push(v);
  }
  const options = [inkIdx, ...others];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { wordIdx, inkIdx, options };
}

export default function StroopGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION_MS);
  const [prompt, setPrompt] = useState<Prompt>(() => makePrompt());
  const [wrong, setWrong] = useState<number | null>(null);

  const endRef = useRef(0);
  const scoreRef = useRef(0);
  const reported = useRef(false);
  const lastTick = useRef(0);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    setLeft(0);
    setPhase("done");
    sequence(
      [
        { freq: 523, dur: 0.12, type: "triangle", gain: 0.16 },
        { freq: 659, dur: 0.12, type: "triangle", gain: 0.16 },
        { freq: 784, dur: 0.18, type: "triangle", gain: 0.18 },
      ],
      0.1
    );
    onGameOver(scoreRef.current, { game: "stroop" });
  }, [onGameOver]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const rem = Math.max(0, endRef.current - performance.now());
      setLeft(rem);
      const sec = Math.ceil(rem / 1000);
      if (sec <= 5 && sec > 0 && sec !== lastTick.current) {
        lastTick.current = sec;
        tick(sec === 1);
      }
      if (rem <= 0) finish();
    }, 100);
    return () => clearInterval(id);
  }, [phase, finish]);

  useEffect(
    () => () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    },
    []
  );

  const start = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    setPrompt(makePrompt());
    setWrong(null);
    setLeft(DURATION_MS);
    reported.current = false;
    lastTick.current = 0;
    endRef.current = performance.now() + DURATION_MS;
    setPhase("playing");
  }, []);

  function answer(idx: number) {
    if (phase !== "playing") return;
    if (idx === prompt.inkIdx) {
      tone({ freq: 660, type: "triangle", gain: 0.14, dur: 0.08 });
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setPrompt(makePrompt());
    } else {
      tone({ freq: 150, type: "sawtooth", gain: 0.08, dur: 0.12 });
      endRef.current -= 1500; // 1.5초 감점
      setWrong(idx);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => {
        setWrong(null);
        setPrompt(makePrompt());
      }, 250);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="시간" value={`${Math.ceil(left / 1000)}초`} width="4.5rem" />
          <Stat label="점수" value={String(score)} width="4rem" accent />
          <Stat label="베스트" value={bestScore != null ? String(bestScore) : "-"} width="4.5rem" />
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
        <div className="flex flex-col gap-4 rounded-xl bg-black/25 p-4">
          <p className="text-center text-xs text-ink-faint">글자의 <b className="text-ink">색</b>을 고르세요</p>
          <div className="flex h-24 items-center justify-center">
            <span className="font-display text-5xl" style={{ color: COLORS[prompt.inkIdx].hex }}>
              {COLORS[prompt.wordIdx].name}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {prompt.options.map((c, i) => (
              <button
                key={`${c}-${i}`}
                onClick={() => answer(c)}
                disabled={phase !== "playing"}
                className={`touch-none rounded-xl py-3 font-display text-lg text-white transition-transform active:scale-95 ${
                  wrong === c ? "ring-2 ring-danger" : ""
                }`}
                style={{ backgroundColor: COLORS[c].hex }}
              >
                {COLORS[c].name}
              </button>
            ))}
          </div>
        </div>

        {phase === "ready" && (
          <StartGate
            title="스트룹"
            lines={["글자의 뜻이 아니라 '색'을 고르세요!", "예: 파란 글씨의 '빨강' → 파랑", "30초 안에 최대한 많이."]}
            onStart={start}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">시간 종료!</p>
            <p className="text-sm text-ink-dim">
              점수 <span className="tabular text-gold">{score}</span>
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
