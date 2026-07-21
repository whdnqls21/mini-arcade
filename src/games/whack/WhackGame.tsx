"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import { BadMoleIcon, MoleIcon } from "@/games/whack/MoleArt";
import type { GamePlayProps } from "@/games/types";
import { semitone, sequence, thud, tone } from "@/games/sound";

const COLS = 4;
const ROWS = 5;
const HOLES = COLS * ROWS; // 20구멍
const GAME_MS = 30000; // 30초 승부
const VARIANTS = 3; // 좋은 두더지 털색 변주 수(MoleArt 의 FUR 길이)

type Kind = "good" | "bad";
interface Mole {
  id: number;
  kind: Kind;
  variant: number; // 좋은 두더지 털색 선택용
  expire: number; // performance.now() 기준, 이 시각 넘으면 사라짐
}

type Phase = "ready" | "playing" | "done";

export default function WhackGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [moles, setMoles] = useState<(Mole | null)[]>(() => Array(HOLES).fill(null));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [remain, setRemain] = useState(GAME_MS);
  const [flash, setFlash] = useState<number | null>(null); // 나쁜 두더지 눌렀을 때 붉은 표시

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
      // 난이도 곡선: 후반일수록 짧게 보이고(반응 속도), 여러 개가 동시에(주의 분산) 뜬다.
      const life = 900 - 430 * r; // 등장 유지 시간(ms): 900 → 470
      const badP = 0.2 + 0.16 * r; // 나쁜 두더지 비율: 0.20 → 0.36
      const targetActive = 2 + Math.round(r * 4); // 동시 등장 목표: 2 → 6 (20구멍이라 조금 넉넉히)
      const spawnGate = 0.5 + 0.5 * r; // 목표까지 채우는 속도(초반은 천천히): 0.5 → 1.0

      const next = molesRef.current.map((m) => (m && now >= m.expire ? null : m));
      const empties: number[] = [];
      let active = 0;
      next.forEach((m, i) => {
        if (m) active++;
        else empties.push(i);
      });

      // 목표 동시 등장 수까지 채우되, 한 틱에 최대 2개만 — 한꺼번에 우르르 뜨지 않게.
      let toSpawn = Math.min(targetActive - active, empties.length, 2);
      while (toSpawn > 0 && Math.random() < spawnGate) {
        const idx = Math.floor(Math.random() * empties.length);
        const i = empties.splice(idx, 1)[0];
        const kind: Kind = Math.random() < badP ? "bad" : "good";
        idRef.current += 1;
        next[i] = {
          id: idRef.current,
          kind,
          variant: Math.floor(Math.random() * VARIANTS),
          expire: now + life,
        };
        toSpawn--;
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

    if (m.kind === "good") {
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
              aria-label={m ? (m.kind === "bad" ? "나쁜 두더지" : "두더지") : "빈 구멍"}
              className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-pitch-line bg-gradient-to-b from-[#0f1720] to-[#05090d] active:scale-95"
            >
              {/* 구멍 안쪽 그림자 */}
              <span className="pointer-events-none absolute inset-x-2 bottom-1 h-3 rounded-full bg-black/40 blur-[2px]" />
              {m && (
                <span
                  key={m.id}
                  className="pointer-events-none relative aspect-square w-[82%]"
                  style={{ animation: "whack-pop 150ms ease-out" }}
                >
                  {m.kind === "good" ? (
                    <MoleIcon variant={m.variant} size="100%" />
                  ) : (
                    <BadMoleIcon size="100%" />
                  )}
                </span>
              )}
              {flash === i && <span className="absolute inset-0 rounded-2xl bg-danger/40" />}
            </button>
          ))}
        </div>

        {phase === "ready" && (
          <StartGate
            title="두더지 잡기"
            lines={["두더지가 튀어나오면 재빨리 탭!", "빨간 눈 나쁜 두더지는 누르면 감점.", "제한 시간 30초."]}
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
