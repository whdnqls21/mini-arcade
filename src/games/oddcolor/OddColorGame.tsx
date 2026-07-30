"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { sequence, tick, tone } from "@/games/sound";

// 같은 색 격자에서 살짝 다른 한 칸을 찾아 탭. 맞힐수록 격자가 커지고 색 차이가 미묘해진다.
// 30초 안에 맞힌 개수가 점수(높을수록 상위).
const DURATION_MS = 45_000;

type Phase = "ready" | "playing" | "done";

function sizeForRound(r: number): number {
  if (r < 3) return 2;
  if (r < 8) return 3;
  if (r < 14) return 4;
  if (r < 21) return 5;
  return 6;
}

interface Puzzle {
  n: number;
  odd: number;
  base: string;
  oddColor: string;
}

function makePuzzle(round: number): Puzzle {
  const n = sizeForRound(round);
  const count = n * n;
  const odd = Math.floor(Math.random() * count);
  const hue = Math.floor(Math.random() * 360);
  const sat = 55 + Math.floor(Math.random() * 15);
  const light = 48 + Math.floor(Math.random() * 14);
  // 밝기 차이는 '보이긴 하되 집중해야' 하는 수준으로 유지(28% → 7%). 변별력은 격자 크기·스캔 속도에서.
  const delta = Math.max(7, 28 - round * 1.1);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const oddLight = Math.min(92, Math.max(8, light + dir * delta));
  return {
    n,
    odd,
    base: `hsl(${hue} ${sat}% ${light}%)`,
    oddColor: `hsl(${hue} ${sat}% ${oddLight}%)`,
  };
}

export default function OddColorGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION_MS);
  const [puz, setPuz] = useState<Puzzle>(() => makePuzzle(0));
  const [wrong, setWrong] = useState<number | null>(null);

  const endRef = useRef(0);
  const roundRef = useRef(0);
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
    onGameOver(scoreRef.current, { game: "oddcolor" });
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
    roundRef.current = 0;
    setScore(0);
    setPuz(makePuzzle(0));
    setWrong(null);
    setLeft(DURATION_MS);
    reported.current = false;
    lastTick.current = 0;
    endRef.current = performance.now() + DURATION_MS;
    setPhase("playing");
  }, []);

  function tap(i: number) {
    if (phase !== "playing") return;
    if (i === puz.odd) {
      tone({ freq: 660, type: "triangle", gain: 0.14, dur: 0.08 });
      scoreRef.current += 1;
      setScore(scoreRef.current);
      roundRef.current += 1;
      setPuz(makePuzzle(roundRef.current));
    } else {
      // 오답 — 1.5초 감점 + 빨간 표시.
      tone({ freq: 150, type: "sawtooth", gain: 0.08, dur: 0.12 });
      endRef.current -= 1500;
      setWrong(i);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrong((w) => (w === i ? null : w)), 250);
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
        <div
          className={`grid touch-none select-none rounded-xl bg-black/25 ${
            puz.n >= 5 ? "gap-1.5 p-2" : "gap-2 p-3"
          }`}
          style={{
            aspectRatio: "1 / 1",
            gridTemplateColumns: `repeat(${puz.n}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${puz.n}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: puz.n * puz.n }, (_, i) => (
            <button
              key={i}
              onClick={() => tap(i)}
              disabled={phase !== "playing"}
              aria-label="타일"
              className={`touch-none rounded-lg transition-transform active:scale-95 ${
                wrong === i ? "ring-2 ring-danger" : ""
              }`}
              style={{ backgroundColor: i === puz.odd ? puz.oddColor : puz.base }}
            />
          ))}
        </div>

        {phase === "ready" && (
          <StartGate
            title="Kuku Kube"
            lines={["살짝 색이 다른 한 칸을 탭!", "맞힐수록 칸이 늘고 색 차이가 미묘해져요.", "45초 안에 최대한 많이."]}
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
