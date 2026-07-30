"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { sequence, tick, tone } from "@/games/sound";

// 암산 스프린트 — 60초 안에 사칙연산을 최대한 많이. 맞힌 개수가 점수(높을수록 상위).
// 점수가 오를수록 숫자가 커진다(4지선다).
const DURATION_MS = 45_000;

type Phase = "ready" | "playing" | "done";

interface Problem {
  text: string;
  answer: number;
  options: number[];
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const shuffle = <T,>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const OPS3 = ["+", "-", "×"] as const;

// 곱셈(×)·나눗셈(÷) 을 덧/뺄셈보다 먼저 계산한다(연산자 우선순위).
function evalExpr(nums: number[], ops: string[]): number {
  const n = [...nums];
  const o = [...ops];
  for (let i = 0; i < o.length; ) {
    if (o[i] === "×" || o[i] === "÷") {
      const v = o[i] === "×" ? n[i] * n[i + 1] : n[i] / n[i + 1];
      n.splice(i, 2, v);
      o.splice(i, 1);
    } else {
      i++;
    }
  }
  let acc = n[0];
  for (let i = 0; i < o.length; i++) acc = o[i] === "+" ? acc + n[i + 1] : acc - n[i + 1];
  return acc;
}

function makeProblem(level: number): Problem {
  // 레벨 3부터 3항이 섞여 나온다(확률이 레벨에 따라 오름).
  const wantThree = level >= 3 && Math.random() < Math.min(0.6, 0.15 + level * 0.05);

  let text = "";
  let answer = 0;

  if (wantThree) {
    // 3항 — +,-,× 만 사용(÷ 는 정수 보장이 어려워 2항에서만). ×가 먼저 계산된다.
    for (let t = 0; t < 30; t++) {
      const nums = [randInt(2, 9 + level), randInt(2, 9), randInt(2, 9)];
      const ops = [OPS3[Math.floor(Math.random() * 3)], OPS3[Math.floor(Math.random() * 3)]];
      const ans = evalExpr(nums, ops);
      if (Number.isInteger(ans) && ans >= 0 && ans <= 999) {
        text = `${nums[0]} ${ops[0]} ${nums[1]} ${ops[1]} ${nums[2]}`;
        answer = ans;
        break;
      }
    }
  }

  if (!text) {
    // 2항 — 레벨 2부터 ÷(나눗셈, 정수 결과) 도 등장.
    const pool = level >= 2 ? (["+", "-", "×", "÷"] as const) : (["+", "-", "×"] as const);
    const op = pool[Math.floor(Math.random() * pool.length)];
    let a: number, b: number;
    if (op === "+") {
      a = randInt(2, 12 + level * 6);
      b = randInt(2, 12 + level * 6);
      answer = a + b;
    } else if (op === "-") {
      a = randInt(3, 14 + level * 6);
      b = randInt(1, a);
      answer = a - b;
    } else if (op === "×") {
      a = randInt(2, 6 + level);
      b = randInt(2, 9);
      answer = a * b;
    } else {
      // ÷ — 정수 결과가 나오게 a = b×몫 으로 만든다.
      b = randInt(2, 9);
      const q = randInt(2, 6 + level);
      a = b * q;
      answer = q;
    }
    text = `${a} ${op} ${b}`;
  }

  // 보기 5개 — 정답 + 근처 오답 4개(중복·음수 배제).
  const set = new Set<number>([answer]);
  const offsets = shuffle([1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10]);
  let oi = 0;
  while (set.size < 5 && oi < offsets.length) {
    const cand = answer + offsets[oi++];
    if (cand >= 0 && !set.has(cand)) set.add(cand);
  }
  let up = answer + 1;
  while (set.size < 5) {
    if (!set.has(up)) set.add(up);
    up++;
  }
  return { text, answer, options: shuffle([...set]) };
}

export default function MathSprintGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION_MS);
  const [prob, setProb] = useState<Problem>(() => makeProblem(0));
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
    onGameOver(scoreRef.current, { game: "mathsprint" });
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
    setProb(makeProblem(0));
    setWrong(null);
    setLeft(DURATION_MS);
    reported.current = false;
    lastTick.current = 0;
    endRef.current = performance.now() + DURATION_MS;
    setPhase("playing");
  }, []);

  function answer(v: number) {
    if (phase !== "playing") return;
    if (v === prob.answer) {
      tone({ freq: 660, type: "triangle", gain: 0.14, dur: 0.08 });
      scoreRef.current += 1;
      setScore(scoreRef.current);
      // 3문제마다 난이도 한 단계 — 잘하는 사람일수록 더 큰 수를 만나 기록이 벌어진다.
      setProb(makeProblem(Math.floor(scoreRef.current / 3)));
    } else {
      tone({ freq: 150, type: "sawtooth", gain: 0.08, dur: 0.12 });
      endRef.current -= 2000; // 2초 감점
      setWrong(v);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrong((w) => (w === v ? null : w)), 250);
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
          <div className="flex h-24 items-center justify-center">
            <span className="tabular font-display text-3xl text-ink">{prob.text} = ?</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {prob.options.map((v, i) => {
              const lastOdd = i === prob.options.length - 1 && prob.options.length % 2 === 1;
              return (
                <button
                  key={`${v}-${i}`}
                  onClick={() => answer(v)}
                  disabled={phase !== "playing"}
                  className={`tabular touch-none rounded-xl border border-pitch-line bg-black/30 py-3.5 font-display text-2xl text-ink transition-transform active:scale-95 ${
                    lastOdd ? "col-span-2" : ""
                  } ${wrong === v ? "border-danger ring-2 ring-danger" : ""}`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>

        {phase === "ready" && (
          <StartGate
            title="암산 스프린트"
            lines={["사칙연산을 빠르게 풀어요!", "정답을 4개 중에서 탭.", "60초 안에 최대한 많이."]}
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
