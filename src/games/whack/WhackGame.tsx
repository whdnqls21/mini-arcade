"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import { FruitIcon } from "@/games/suika/FruitIcon";
import type { GamePlayProps } from "@/games/types";
import { semitone, sequence, thud, tone } from "@/games/sound";

const COLS = 3;
const ROWS = 4;
const HOLES = COLS * ROWS; // 12구멍
const GAME_MS = 30000; // 30초 승부
// 구멍에서 튀어나올 과일들 — 크기 40에서 서로 잘 구분되는 것만.
const FRUIT_POOL = [0, 2, 4, 6, 8, 10];

type Kind = "fruit" | "bomb";
interface Mole {
  id: number;
  kind: Kind;
  fruit: number;
  expire: number; // performance.now() 기준, 이 시각 넘으면 사라짐
}

type Phase = "ready" | "playing" | "done";

export default function WhackGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [moles, setMoles] = useState<(Mole | null)[]>(() => Array(HOLES).fill(null));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [remain, setRemain] = useState(GAME_MS);
  const [flash, setFlash] = useState<number | null>(null); // 폭탄 눌렀을 때 붉은 표시

  const molesRef = useRef<(Mole | null)[]>(Array(HOLES).fill(null));
  const scoreRef = useRef(0);
  const startRef = useRef(0);
  const idRef = useRef(0);
  const reported = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // moles 는 setInterval 콜백에서도 최신값이 필요해 ref 를 원본으로 두고 화면엔 미러링한다.
  const commitMoles = useCallback((next: (Mole | null)[]) => {
    molesRef.current = next;
    setMoles(next);
  }, []);

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    setPhase("done");
    setRemain(0);
    sequence([
      { freq: 523, dur: 0.12, type: "triangle", gain: 0.16 },
      { freq: 659, dur: 0.12, type: "triangle", gain: 0.16 },
      { freq: 784, dur: 0.18, type: "triangle", gain: 0.16 },
    ]);
    onGameOver(scoreRef.current, { game: "whack" });
  }, [onGameOver]);

  const start = useCallback(() => {
    commitMoles(Array(HOLES).fill(null));
    scoreRef.current = 0;
    setScore(0);
    idRef.current = 0;
    reported.current = false;
    startRef.current = performance.now();
    setRemain(GAME_MS);
    setPhase("playing");
  }, [commitMoles]);

  const toReady = useCallback(() => {
    commitMoles(Array(HOLES).fill(null));
    reported.current = true; // 진행 중 리셋 시 기록 중복 방지
    setPhase("ready");
    setRemain(GAME_MS);
  }, [commitMoles]);

  // 게임 루프 — 만료된 두더지 정리 + 확률적으로 새 두더지 등장. 시간이 갈수록 빨라진다.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startRef.current;
      if (elapsed >= GAME_MS) {
        finish();
        return;
      }
      setRemain(GAME_MS - elapsed);
      const r = elapsed / GAME_MS; // 0 → 1
      const life = 1150 - 520 * r; // 등장 유지 시간(ms): 후반일수록 짧게
      const spawnP = 0.18 + 0.32 * r; // 틱마다 등장 확률
      const bombP = 0.18 + 0.14 * r; // 폭탄 비율

      const next = molesRef.current.map((m) => (m && now >= m.expire ? null : m));
      const empties: number[] = [];
      next.forEach((m, i) => {
        if (!m) empties.push(i);
      });
      if (empties.length && Math.random() < spawnP) {
        const i = empties[Math.floor(Math.random() * empties.length)];
        const kind: Kind = Math.random() < bombP ? "bomb" : "fruit";
        idRef.current += 1;
        next[i] = {
          id: idRef.current,
          kind,
          fruit: FRUIT_POOL[Math.floor(Math.random() * FRUIT_POOL.length)],
          expire: now + life,
        };
      }
      commitMoles(next);
    }, 100);
    return () => clearInterval(id);
  }, [phase, finish, commitMoles]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  function tap(i: number) {
    if (phase !== "playing") return;
    const m = molesRef.current[i];
    if (!m) return;
    const next = [...molesRef.current];
    next[i] = null;
    commitMoles(next);

    if (m.kind === "fruit") {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      tone({ freq: semitone(660, Math.min(scoreRef.current, 12)), type: "triangle", gain: 0.14, dur: 0.1 });
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 2);
      setScore(scoreRef.current);
      thud(0.22, 0.18);
      setFlash(i);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash((f) => (f === i ? null : f)), 220);
    }
  }

  const remainSec = Math.ceil(remain / 1000);

  return (
    <div className="flex flex-col gap-3">
      <style>{`@keyframes whack-pop{0%{transform:scale(.35);opacity:0}55%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}`}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="점수" value={String(score)} width="4.5rem" />
          <Stat label="베스트" value={bestScore != null ? String(bestScore) : "-"} width="4.5rem" accent />
          <Stat label="남은 시간" value={`${remainSec}초`} width="5rem" />
        </div>
        <button
          onClick={toReady}
          disabled={phase === "ready"}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-40"
        >
          새 게임
        </button>
      </div>

      {/* 남은 시간 게이지 */}
      <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-grass transition-[width] duration-100 ease-linear"
          style={{ width: `${(remain / GAME_MS) * 100}%` }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <div
          className="grid gap-2 rounded-xl bg-black/25 p-3"
          style={{
            aspectRatio: "320 / 440",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          }}
        >
          {moles.map((m, i) => (
            <button
              key={i}
              onClick={() => tap(i)}
              data-kind={m ? m.kind : "empty"}
              aria-label={m ? (m.kind === "bomb" ? "폭탄" : "과일") : "빈 구멍"}
              className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-pitch-line bg-gradient-to-b from-[#0f1720] to-[#05090d] active:scale-95"
            >
              {/* 구멍 안쪽 그림자 */}
              <span className="pointer-events-none absolute inset-x-2 bottom-1 h-3 rounded-full bg-black/40 blur-[2px]" />
              {m && (
                <span
                  key={m.id}
                  className="relative"
                  style={{ animation: "whack-pop 150ms ease-out" }}
                >
                  {m.kind === "fruit" ? <FruitIcon index={m.fruit} size={40} /> : <BombIcon size={40} />}
                </span>
              )}
              {flash === i && <span className="absolute inset-0 rounded-2xl bg-danger/40" />}
            </button>
          ))}
        </div>

        {phase === "ready" && (
          <StartGate
            title="두더지 잡기"
            lines={["과일이 튀어나오면 재빨리 탭!", "폭탄을 누르면 점수가 깎여요.", "제한 시간 30초."]}
            onStart={start}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
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

// 폭탄 — 에셋 없이 인라인 SVG 로. 둥근 몸체 + 도화선 + 불꽃.
function BombIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="21" cy="31" r="13" fill="#12161b" stroke="#39414b" strokeWidth="1.5" />
      <circle cx="16" cy="26" r="3" fill="#525b66" opacity="0.7" />
      <rect x="25.5" y="14" width="5" height="6" rx="1.5" transform="rotate(28 28 17)" fill="#2a2f36" />
      <path d="M30 14 q5 -5 8 -1" stroke="#d08a2a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <g>
        <circle cx="39" cy="11" r="2.4" fill="#ffcf4d" />
        <path
          d="M39 6.5 L40 9.5 L43 10 L40 11 L39 14 L38 11 L35 10 L38 9.5 Z"
          fill="#ff8a1f"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}
