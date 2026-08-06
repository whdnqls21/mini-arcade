"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { tone } from "@/games/sound";

// 숫자 기억 — 잠깐 보인 숫자를 그대로 입력. 맞히면 한 자리 늘어난다. 마지막으로 맞힌 자릿수가 점수.
type Phase = "ready" | "show" | "input" | "done";
const START_LEVEL = 3;

function genNumber(len: number): string {
  let s = String(1 + Math.floor(Math.random() * 9)); // 첫 자리 1~9
  for (let i = 1; i < len; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

export default function NumberMemoryGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState(START_LEVEL);
  const [num, setNum] = useState("");
  const [revealIdx, setRevealIdx] = useState(-1); // show 단계에서 지금 보이는 자리(-1=빈 순간)
  const [entry, setEntry] = useState("");
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);

  const scoreRef = useRef(0);
  const numRef = useRef("");
  const reported = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => clearTimer(), []);

  // 한 자리씩 순차로 보여준다(다시 훑어보기 불가 → 자릿수 변별력↑). 자릿수가 늘수록 살짝 빨라진다.
  const revealStep = useCallback((n: string, idx: number, lv: number) => {
    if (idx >= n.length) {
      setRevealIdx(-1);
      setPhase("input");
      return;
    }
    setRevealIdx(idx);
    tone({ freq: 500, type: "sine", gain: 0.06, dur: 0.05 });
    const onMs = Math.max(340, 560 - lv * 15);
    timer.current = setTimeout(() => {
      setRevealIdx(-1); // 자리 사이 빈 순간(같은 숫자 연속도 구분)
      timer.current = setTimeout(() => revealStep(n, idx + 1, lv), 130);
    }, onMs);
  }, []);

  const showRound = useCallback(
    (lv: number) => {
      const n = genNumber(lv);
      numRef.current = n;
      setNum(n);
      setEntry("");
      setLevel(lv);
      setRevealIdx(-1);
      setPhase("show");
      clearTimer();
      timer.current = setTimeout(() => revealStep(n, 0, lv), 350);
    },
    [revealStep]
  );

  const start = useCallback(() => {
    reported.current = false;
    scoreRef.current = 0;
    setScore(0);
    setAnswer(null);
    showRound(START_LEVEL);
  }, [showRound]);

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    clearTimer();
    setAnswer(numRef.current);
    setPhase("done");
    tone({ freq: 120, type: "sawtooth", gain: 0.1, dur: 0.3 });
    onGameOver(scoreRef.current, { game: "numbermemory" });
  }, [onGameOver]);

  const submit = useCallback(
    (value: string) => {
      if (value === numRef.current) {
        scoreRef.current = value.length;
        setScore(value.length);
        tone({ freq: 680, type: "triangle", gain: 0.12, dur: 0.12 });
        clearTimer();
        timer.current = setTimeout(() => showRound(value.length + 1), 350);
      } else {
        finish();
      }
    },
    [showRound, finish]
  );

  const pressDigit = (d: string) => {
    if (phase !== "input" || entry.length >= level) return;
    const next = entry + d;
    setEntry(next);
    tone({ freq: 520, type: "sine", gain: 0.05, dur: 0.04 });
    if (next.length === level) {
      clearTimer();
      timer.current = setTimeout(() => submit(next), 160);
    }
  };
  const backspace = () => {
    if (phase === "input") setEntry((e) => e.slice(0, -1));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="자릿수" value={String(level)} width="4.5rem" accent />
          <Stat label="베스트" value={bestScore != null ? String(bestScore) : "-"} width="4.5rem" />
        </div>
        <span className="text-xs text-ink-faint">
          {phase === "show" ? "외우세요…" : phase === "input" ? "입력!" : ""}
        </span>
      </div>

      <div className="relative flex min-h-[7rem] items-center justify-center rounded-2xl bg-black/25 p-4">
        {phase === "show" ? (
          <div className="flex flex-col items-center gap-2">
            <p className="font-display text-5xl text-ink">{revealIdx >= 0 ? num[revealIdx] : " "}</p>
            <div className="flex gap-1">
              {Array.from({ length: level }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i < revealIdx ? "bg-grass" : i === revealIdx ? "bg-gold" : "bg-pitch-line"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : phase === "input" ? (
          <div className="flex gap-1.5">
            {Array.from({ length: level }, (_, i) => (
              <span
                key={i}
                className={`flex h-11 w-8 items-center justify-center rounded-lg border font-display text-2xl ${
                  entry[i] ? "border-grass/50 text-ink" : "border-pitch-line text-ink-faint"
                }`}
              >
                {entry[i] ?? ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-display text-2xl tracking-[0.2em] text-ink-faint">? ? ?</p>
        )}

        {phase === "ready" && (
          <StartGate
            title="숫자 기억"
            lines={["숫자가 한 자리씩 스쳐 지나가요.", "순서대로 외웠다가 입력!", "맞힐수록 한 자리씩 늘어나요."]}
            onStart={start}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/85">
            <p className="font-display text-xl text-ink">아쉬워요!</p>
            <p className="text-xs text-ink-dim">
              정답 <span className="tabular text-gold">{answer}</span>
            </p>
            <p className="text-sm text-ink-dim">
              점수 <span className="tabular text-gold">{score}</span>자리
            </p>
            <RetryButton submitting={submitting} onRetry={start} />
          </div>
        )}
      </div>

      {/* 숫자 키패드 */}
      <div className="grid grid-cols-3 gap-1.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => pressDigit(d)} disabled={phase !== "input"}>
            {d}
          </Key>
        ))}
        <Key onClick={backspace} disabled={phase !== "input" || entry.length === 0}>
          ⌫
        </Key>
        <Key onClick={() => pressDigit("0")} disabled={phase !== "input"}>
          0
        </Key>
        <span />
      </div>
    </div>
  );
}

function Key({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="touch-none rounded-xl border border-pitch-line bg-pitch-card py-3.5 font-display text-xl text-ink transition-colors hover:border-grass/40 active:scale-95 disabled:opacity-40"
    >
      {children}
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
