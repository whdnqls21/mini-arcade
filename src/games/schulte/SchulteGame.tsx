"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { semitone, sequence, tone } from "@/games/sound";

const COLS = 5;
const ROWS = 5;
const GRID = COLS * ROWS; // 한 번에 보이는 25칸
const MAX = 50; // 1~50
const GOOD_FLASH_MS = 200; // 정답 초록 팝
const WRONG_FLASH_MS = 300; // 오답 빨강 흔들림

// 처음엔 1~25 를 섞어 깐다. 낮은 수를 누르면 그 칸에 "아직 안 나온 큰 수(26~50)"가 랜덤으로
// 하나 등장해 25칸이 계속 유지되고, 후반(26~50)을 누르면 칸이 비면서 1→50 까지 진행한다.
// (25개를 다 누르는 동안 26~50 이 모두 올라오므로, 등장 순서는 아무래도 상관없다.)
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const initialCells = () => shuffle(Array.from({ length: GRID }, (_, i) => i + 1));
const highPool = () => shuffle(Array.from({ length: MAX - GRID }, (_, i) => GRID + 1 + i)); // 26~50 섞어서

type Cell = number | null; // null = 빈 칸
type Phase = "ready" | "playing" | "done";

export default function SchulteGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [cells, setCells] = useState<Cell[]>(() => initialCells());
  const [next, setNext] = useState(1); // 다음에 눌러야 할 숫자 (1~50)
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState<{ i: number; ok: boolean } | null>(null); // 탭 피드백(초록=정답, 빨강=오답)

  const startRef = useRef(0);
  const reported = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poolRef = useRef<number[]>([]); // 아직 안 나온 큰 수(26~50), 누를 때마다 랜덤으로 하나씩 등장

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  function doFlash(i: number, ok: boolean) {
    setFlash({ i, ok });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(
      () => setFlash((f) => (f && f.i === i ? null : f)),
      ok ? GOOD_FLASH_MS : WRONG_FLASH_MS
    );
  }

  // 시작할 때 새로 섞는다 — 시작 전 배치를 미리 외우거나 '새 게임'으로 쉬운 판을 고르는 걸 막는다.
  const start = useCallback(() => {
    setCells(initialCells());
    poolRef.current = highPool();
    setNext(1);
    setFlash(null);
    setElapsed(0);
    reported.current = false;
    startRef.current = performance.now();
    setPhase("playing");
  }, []);

  const toReady = useCallback(() => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setPhase("ready");
    setNext(1);
    setFlash(null);
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
      // 이 칸에 아직 안 나온 큰 수를 랜덤으로 하나 띄운다(다 나왔으면 빈 칸).
      const replacement = poolRef.current.length ? (poolRef.current.pop() as number) : null;
      setCells((prev) => {
        const nx = prev.slice();
        nx[i] = replacement;
        return nx;
      });
      doFlash(i, true); // 정답 — 초록 팝
      if (next >= MAX) finish();
      else setNext(next + 1);
    } else {
      // 순서가 아닌 숫자 — 오답(감점 없음).
      tone({ freq: 150, type: "sawtooth", gain: 0.08, dur: 0.1 });
      doFlash(i, false); // 오답 — 빨강 흔들림
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <style>{`@keyframes s-pop{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1)}}@keyframes s-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}60%{transform:translateX(3px)}80%{transform:translateX(-2px)}}`}</style>

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
            const fl = flash && flash.i === i ? flash : null;
            return (
              <button
                key={i}
                onClick={() => tap(i)}
                disabled={phase !== "playing" || empty}
                style={fl ? { animation: fl.ok ? "s-pop 200ms ease-out" : "s-shake 300ms ease-in-out" } : undefined}
                className={`flex touch-none items-center justify-center rounded-lg border font-display text-2xl tabular transition-colors ${
                  empty
                    ? "border-pitch-line/30 bg-black/10 text-transparent"
                    : fl?.ok
                      ? "border-grass bg-grass/25 text-grass"
                      : fl && !fl.ok
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
            lines={["1부터 50까지 순서대로 빠르게 탭!", "누른 칸엔 새로운 숫자가 나타납니다.", "시작을 누르면 시간이 흐릅니다."]}
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
