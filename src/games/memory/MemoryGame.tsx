"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BrainMark } from "@/components/BrainMark";
import { RetryButton } from "@/games/shared";
import { FruitIcon } from "@/games/suika/FruitIcon";
import type { GamePlayProps } from "@/games/types";
import { semitone, thud, tone } from "@/games/sound";

const COLS = 4;
const ROWS = 5;
const PAIRS = (COLS * ROWS) / 2; // 10쌍
// 서로 색이 잘 구분되는 과일 10종(체리·포도·한라봉·배·복숭아·파인애플·멜론·수박 등).
const FRUIT_SET = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10];
const FLIP_BACK_MS = 800; // 짝이 아닐 때 다시 덮기까지

interface CardT {
  key: number;
  fruit: number;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newDeck(): CardT[] {
  const cards: CardT[] = [];
  FRUIT_SET.slice(0, PAIRS).forEach((fruit, i) => {
    cards.push({ key: i * 2, fruit });
    cards.push({ key: i * 2 + 1, fruit });
  });
  return shuffle(cards);
}

export default function MemoryGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [deck, setDeck] = useState<CardT[]>(() => newDeck());
  const [flipped, setFlipped] = useState<number[]>([]); // 뒤집힌(아직 안 맞은) 카드 인덱스
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const reported = useRef(false);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 빠르게 두 장을 연속으로 누르면 tap 이 아직 반영 안 된 state 를 읽어 첫 장이 사라진다.
  // ref 를 동기 원본으로 두고 화면엔 state 로 미러링한다.
  const flippedRef = useRef<number[]>([]);
  const matchedRef = useRef<Set<number>>(new Set());

  const commitFlipped = useCallback((v: number[]) => {
    flippedRef.current = v;
    setFlipped(v);
  }, []);
  const commitMatched = useCallback((v: Set<number>) => {
    matchedRef.current = v;
    setMatched(v);
  }, []);

  const reset = useCallback(() => {
    if (flipTimer.current) clearTimeout(flipTimer.current);
    setDeck(newDeck());
    commitFlipped([]);
    commitMatched(new Set());
    setStarted(false);
    setDone(false);
    setElapsed(0);
    reported.current = false;
  }, [commitFlipped, commitMatched]);

  // 첫 뒤집기부터 시간을 잰다(카드는 다 덮여 있어 미리 봐도 이득이 없으니 시작 버튼은 없다).
  useEffect(() => {
    if (!started || done) return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [started, done]);

  useEffect(() => {
    return () => {
      if (flipTimer.current) clearTimeout(flipTimer.current);
    };
  }, []);

  function tap(i: number) {
    if (done) return;
    if (matchedRef.current.has(i)) return;

    // 틀린 두 장이 떠 있는 상태(자동 복귀 대기 중)에서 새 카드를 누르면 즉시 덮고 새로 시작한다.
    // 800ms 를 기다리며 탭이 먹히는 답답함을 없앤다 — 빠르게 칠수록 체감이 크다.
    if (flippedRef.current.length >= 2) {
      if (flipTimer.current) clearTimeout(flipTimer.current);
      commitFlipped([]);
    }

    if (flippedRef.current.includes(i)) return; // 이미 뒤집힌 첫 장을 또 누르면 무시

    if (!started) {
      startRef.current = performance.now();
      setStarted(true);
    }

    const next = [...flippedRef.current, i];
    commitFlipped(next);
    tone({ freq: 520, type: "sine", gain: 0.08, dur: 0.08 });

    if (next.length < 2) return;

    // 두 장째 — 짝 판정
    const [a, b] = next;
    if (deck[a].fruit === deck[b].fruit) {
      const nm = new Set(matchedRef.current);
      nm.add(a);
      nm.add(b);
      commitMatched(nm);
      commitFlipped([]);
      tone({ freq: semitone(660, nm.size), type: "triangle", gain: 0.14, dur: 0.14 });
      if (nm.size === deck.length) finish();
    } else {
      // 틀림 — 잠깐 보여주고 자동으로 덮는다(그 전에 새 카드를 누르면 위에서 즉시 덮음).
      flipTimer.current = setTimeout(() => {
        commitFlipped([]);
      }, FLIP_BACK_MS);
    }
  }

  function finish() {
    const ms = Math.round(performance.now() - startRef.current);
    setElapsed(ms);
    setDone(true);
    if (!reported.current) {
      reported.current = true;
      thud(0.12, 0.18);
      onGameOver(ms, { game: "memory" });
    }
  }

  const matchedPairs = matched.size / 2;

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
          <Stat label="맞춘 짝" value={`${matchedPairs}/${PAIRS}`} width="4.5rem" />
        </div>
        <button
          onClick={reset}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink"
        >
          새 게임
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <div
          className="grid gap-2 rounded-xl bg-black/25 p-2"
          style={{
            aspectRatio: "320 / 440",
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
        >
          {deck.map((card, i) => {
            const isMatched = matched.has(i);
            const faceUp = isMatched || flipped.includes(i);
            return (
              <button
                key={card.key}
                onClick={() => tap(i)}
                disabled={done}
                aria-label={faceUp ? "뒤집힌 카드" : "덮인 카드"}
                className={`relative flex items-center justify-center overflow-hidden rounded-lg border transition-colors ${
                  isMatched
                    ? "border-grass/50 bg-grass/10"
                    : faceUp
                      ? "border-pitch-line bg-black/30"
                      : "border-pitch-line bg-gradient-to-br from-[#1a2530] to-[#0e151d] active:scale-95"
                }`}
              >
                {faceUp ? (
                  <span className={isMatched ? "opacity-60" : ""}>
                    <FruitIcon index={card.fruit} size={44} />
                  </span>
                ) : (
                  <span className="opacity-40">
                    <BrainMark size={24} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {done && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">완료!</p>
            <p className="text-sm text-ink-dim">
              기록 <span className="tabular text-gold">{(elapsed / 1000).toFixed(2)}초</span>
            </p>
            <RetryButton submitting={submitting} onRetry={reset} />
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
