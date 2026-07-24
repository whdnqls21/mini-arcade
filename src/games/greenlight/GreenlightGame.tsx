"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton, StartGate } from "@/games/shared";
import { sequence, thud, tone } from "@/games/sound";
import type { GamePlayProps } from "@/games/types";

const ROUNDS = 5;
const WAIT_MIN = 800; // 초록까지 최소 대기(ms)
const WAIT_MAX = 5000; // 최대 대기(ms) — 폭이 넓어야 타이밍을 못 외운다
// 사람의 반응 하한(ms). 이보다 빠르면 '반응'이 아니라 예측/연타 → 성급 처리.
const MIN_REACTION = 100;
// 성급(빨강에 탭 or 하한 미만)할 때마다 합계에 붙는 페널티(ms).
// 연타로 재시도해도 이득이 없게 만든다.
const FALSE_START_PENALTY = 300;

// 라운드 진행 상태.
//  ready   : 시작 전(StartGate)
//  waiting : 빨강 — 초록을 기다리는 중(누르면 성급)
//  go      : 초록 — 지금 탭!
//  early   : 성급한 탭 → 그 라운드 재시작 안내
//  result  : 방금 라운드 반응 시간 잠깐 표시 후 다음 라운드로
//  done    : 5라운드 완료
type Phase = "ready" | "waiting" | "go" | "early" | "result" | "done";

export default function GreenlightGame({ onGameOver, bestScore, submitting }: GamePlayProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState(0); // 완료한 라운드 수
  const [times, setTimes] = useState<number[]>([]); // 라운드별 반응 시간(ms)
  const [last, setLast] = useState<number | null>(null); // 방금 라운드 반응 시간
  const [penalty, setPenalty] = useState(0); // 누적 성급 페널티(ms) — 표시용

  const goAtRef = useRef(0); // 초록으로 바뀐 시각
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reported = useRef(false);
  const timesRef = useRef<number[]>([]); // 라운드 기록 동기 원본(연타·StrictMode 안전)
  const penaltyRef = useRef(0); // 누적 페널티 동기 원본(합계 계산용)

  const clearWait = () => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    waitTimer.current = null;
  };

  // 한 라운드 시작 — 빨강으로 두고 랜덤 시간 뒤 초록으로.
  const startRound = useCallback(() => {
    clearWait();
    setLast(null);
    setPhase("waiting");
    const wait = WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
    waitTimer.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase("go");
      tone({ freq: 660, type: "sine", gain: 0.12, dur: 0.08 });
    }, wait);
  }, []);

  const begin = useCallback(() => {
    timesRef.current = [];
    penaltyRef.current = 0;
    setTimes([]);
    setPenalty(0);
    setRound(0);
    setLast(null);
    reported.current = false;
    startRound();
  }, [startRound]);

  const reset = useCallback(() => {
    clearWait();
    timesRef.current = [];
    penaltyRef.current = 0;
    setPhase("ready");
    setTimes([]);
    setPenalty(0);
    setRound(0);
    setLast(null);
    reported.current = true; // 진행 중 리셋 시 기록 중복 방지
  }, []);

  // 성급(빨강에 탭 or 하한 미만) — 페널티 누적 후 이 라운드 재시도 안내.
  const falseStart = useCallback(() => {
    clearWait();
    thud(0.18, 0.16);
    penaltyRef.current += FALSE_START_PENALTY;
    setPenalty(penaltyRef.current);
    setPhase("early");
  }, []);

  useEffect(() => {
    return () => clearWait();
  }, []);

  // 화면 탭 — 상태에 따라 다르게 처리.
  const tap = useCallback(() => {
    if (phase === "waiting") {
      // 초록 전에 눌렀다 → 성급(페널티 누적 + 재시도).
      falseStart();
      return;
    }
    if (phase === "go") {
      const rt = Math.round(performance.now() - goAtRef.current);
      // 사람 반응 하한보다 빠르면 예측/연타 → 기록 무효, 성급 처리.
      if (rt < MIN_REACTION) {
        falseStart();
        return;
      }
      const next = [...timesRef.current, rt];
      timesRef.current = next;
      setTimes(next);
      setLast(rt);
      setRound(next.length);
      tone({ freq: 880, type: "triangle", gain: 0.14, dur: 0.1 });

      if (next.length >= ROUNDS) {
        // 합계 = 반응 시간 합 + 누적 페널티.
        const total = next.reduce((a, b) => a + b, 0) + penaltyRef.current;
        setPhase("done");
        if (!reported.current) {
          reported.current = true;
          sequence([
            { freq: 523, dur: 0.12, type: "triangle", gain: 0.16 },
            { freq: 784, dur: 0.16, type: "triangle", gain: 0.16 },
          ]);
          onGameOver(total, { game: "greenlight", rounds: next, penaltyMs: penaltyRef.current });
        }
      } else {
        // 다음 라운드로 — 잠깐 결과를 보여준 뒤 자동 진행(result 이펙트).
        setPhase("result");
      }
    }
  }, [phase, falseStart, onGameOver]);

  // 결과(방금 라운드) 잠깐 보여주고 다음 라운드 자동 시작.
  useEffect(() => {
    if (phase !== "result") return;
    const id = setTimeout(() => startRound(), 800);
    return () => clearTimeout(id);
  }, [phase, startRound]);

  const total = times.reduce((a, b) => a + b, 0) + penalty; // 합계엔 페널티 포함

  // 화면 색/문구
  const panel = (() => {
    switch (phase) {
      case "waiting":
        return { bg: "bg-danger", title: "기다려…", sub: "초록으로 바뀌면 탭!" };
      case "go":
        return { bg: "bg-grass", title: "탭!", sub: "지금!" };
      case "early":
        return { bg: "bg-danger/80", title: "너무 빨라요!", sub: "초록으로 바뀐 뒤에 누르세요" };
      case "result":
        return { bg: "bg-grass/30", title: last != null ? `${last}ms` : "", sub: `${round}/${ROUNDS}` };
      default:
        return { bg: "bg-black/25", title: "", sub: "" };
    }
  })();

  const showTapArea = phase === "waiting" || phase === "go" || phase === "result";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="라운드" value={`${Math.min(round + (phase === "go" || phase === "waiting" ? 1 : 0), ROUNDS)}/${ROUNDS}`} width="4.5rem" />
          <Stat label="합계" value={`${(total / 1000).toFixed(3)}초`} width="5rem" />
          <Stat
            label="베스트"
            value={bestScore != null ? `${(bestScore / 1000).toFixed(3)}초` : "-"}
            width="6rem"
            accent
          />
        </div>
        <button
          onClick={reset}
          disabled={phase === "ready"}
          className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-40"
        >
          새 게임
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <button
          type="button"
          onClick={tap}
          disabled={!showTapArea}
          aria-label="반응 탭 영역"
          className={`flex w-full touch-none select-none flex-col items-center justify-center gap-2 rounded-xl transition-colors ${panel.bg} ${
            showTapArea ? "active:opacity-90" : "cursor-default"
          }`}
          style={{ aspectRatio: "320 / 440" }}
        >
          <span className="font-display text-3xl text-pitch-base">{panel.title}</span>
          {panel.sub && (
            <span className="text-sm font-medium text-pitch-base/80">{panel.sub}</span>
          )}
        </button>

        {/* 성급한 탭 안내 — 페널티 + 다시 하기 */}
        {phase === "early" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/70">
            <p className="font-display text-2xl text-ink">너무 빨라요! 😵</p>
            <p className="text-sm text-ink-dim">초록으로 바뀐 뒤에 누르세요.</p>
            <p className="text-xs text-danger">
              성급 페널티 +{(FALSE_START_PENALTY / 1000).toFixed(1)}초 (누적 {(penalty / 1000).toFixed(1)}초)
            </p>
            <button
              onClick={startRound}
              className="rounded-xl bg-grass px-6 py-2.5 font-display text-pitch-base"
            >
              이 라운드 다시
            </button>
          </div>
        )}

        {phase === "ready" && (
          <StartGate
            title="그린라이트"
            lines={[
              "빨강일 때 기다렸다가,",
              "초록으로 바뀌는 순간 탭!",
              `${ROUNDS}라운드 합산 — 빠를수록 상위.`,
              `성급하게 누르면 +${(FALSE_START_PENALTY / 1000).toFixed(1)}초 페널티.`,
            ]}
            onStart={begin}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
            <p className="font-display text-2xl text-ink">완료!</p>
            <p className="text-sm text-ink-dim">
              합계 <span className="tabular text-gold">{(total / 1000).toFixed(3)}초</span>
            </p>
            <p className="text-xs text-ink-faint">
              {times.map((t) => `${t}ms`).join(" · ")}
              {penalty > 0 && <span className="text-danger"> · 페널티 +{(penalty / 1000).toFixed(1)}초</span>}
            </p>
            <RetryButton submitting={submitting} onRetry={begin} />
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
