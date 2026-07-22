"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { semitone, sequence, tone } from "@/games/sound";

const COLS = 5;
const ROWS = 5;
const GRID = COLS * ROWS; // 한 번에 보이는 25칸
const MAX = 50; // 1~50
const WRONG_FLASH_MS = 260;

// 처음엔 1~25 를 섞어 깐다. 낮은 수를 누르면 그 칸이 +25 숫자로 바뀌어(≤50) 25칸이 계속 유지되고,
// 후반(26~50)을 누르면 칸이 비면서 1→50 까지 진행한다.
function shuffled(): number[] {
  const arr = Array.from({ length: GRID }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Cell = number | null; // null = 빈 칸
type Phase = "ready" | "playing" | "done";

export default function SchulteGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [cells, setCells] = useState<Cell[]>(() => shuffled());
  const [next, setNext] = useState(1); // 다음에 눌러야 할 숫자 (1~50)
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null); // 잘못 누른 칸(잠깐 빨갛게)

  const startRef = useRef(0);
  const reported = useRef(false);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    };
  }, []);

  // 시작할 때 새로 섞는다 — 시작 전 배치를 미리 외우거나 '새 게임'으로 쉬운 판을 고르는 걸 막는다.
  const start = useCallback(() => {
    setCells(shuffled());
    setNext(1);
    setWrong(null);
    setElapsed(0);
    reported.current = false;
    startRef.current = performance.now();
    setPhase("playing");
  }, []);

  const toReady = useCallback(() => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    setPhase("ready");
    setNext(1);
    setWrong(null);
    setElapsed(0);
    reported.current = true; // 진행 중 리셋 시 기록 중복 방지
  }, []);

  function finish() {
    if (reported.current) return;
    reported.current = true;
    const ms = Math.round(performance.now() - startRef.current);
    setElapsed(ms);
    setPhase("done");
    sequence([
      { freq: 523, dur: 0.12, type: "triangle", gain: 0.16 },
      { freq: 659, dur: 0.12, type: "triangle", gain: 0.16 },
      { freq: 784, dur: 0.14, type: "triangle", gain: 0.16 },
      { freq: 1047, dur: 0.22, type: "triangle", gain: 0.18 },
    ], 0.1);
    onGameOver(ms, { game: "schulte" });
  }

  function tap(i: number) {
    if (phase !== "playing") return;
    const v = cells[i];
    if (v == null) return; // 빈 칸

    if (v === next) {
      tone({ freq: semitone(440, Math.min(next, 24)), type: "triangle", gain: 0.13, dur: 0.09 });
      // 이 칸을 +25 숫자로 교체(≤50), 넘으면 빈 칸으로.
      const replacement = next + GRID <= MAX ? next + GRID : null;
      setCells((prev) => {
        const nx = prev.slice();
        nx[i] = replacement;
        return nx;
      });
      if (next >= MAX) finish();
      else setNext(next + 1);
    } else {
      // 순서가 아닌 숫자 — 잠깐 빨갛게(감점 없음).
      tone({ freq: 150, type: "sawtooth", gain: 0.08, dur: 0.1 });
      setWrong(i);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrong((w) => (w === i ? null : w)), WRONG_FLASH_MS);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="경과" value={`${(elapsed / 1000).toFixed(1)}초`} width="5rem" />
          <Stat
            label="베스트"
            value={bestScore != null ? `${(bestScore / 1000).toFixed(2)}초` : "-"}
            width="6rem"
            accent
          />
          <Stat label="다음" value={next <= MAX ? String(next) : "✓"} width="4rem" />
        </div>
        <button
          onClick={toReady}
          disabled={phase === "ready"}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-40"
        >
          새 게임
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <div
          className="grid touch-none select-none gap-2 rounded-xl bg-black/25 p-2"
          style={{
            aspectRatio: "1 / 1",
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((v, i) => {
            const empty = v == null;
            const isWrong = wrong === i;
            return (
              <button
                key={i}
                onClick={() => tap(i)}
                disabled={phase !== "playing" || empty}
                className={`flex touch-none items-center justify-center rounded-lg border font-display text-2xl tabular transition-colors ${
                  empty
                    ? "border-pitch-line/30 bg-black/10 text-transparent"
                    : isWrong
                      ? "border-danger bg-danger/25 text-ink"
                      : "border-pitch-line bg-black/30 text-ink active:scale-95"
                }`}
              >
                {v ?? ""}
              </button>
            );
          })}
        </div>

        {/* 시작 전엔 판을 가려 미리 외우기·리롤을 막는다. */}
        {phase === "ready" && <div className="absolute inset-0 z-10 rounded-xl bg-pitch-base" />}

        {phase === "ready" && (
          <StartGate
            title="1 to 50"
            lines={["1부터 50까지 순서대로 빠르게 탭!", "누른 칸은 25 큰 숫자로 바뀝니다.", "시작을 누르면 시간이 흐릅니다."]}
            onStart={start}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">완료!</p>
            <p className="text-sm text-ink-dim">
              기록 <span className="tabular text-gold">{(elapsed / 1000).toFixed(2)}초</span>
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
