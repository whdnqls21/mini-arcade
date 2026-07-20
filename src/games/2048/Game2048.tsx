"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GamePlayProps } from "@/games/types";
import { clearGame, loadGame, saveGame } from "@/lib/game-save";
import { canMove, type Dir, newGame, planMove, spawn, type Tile } from "./logic";
import { tileBg, tileColor, tileFontSize } from "./tiles";

const SLUG = "2048";

// 이어하기로 저장되는 판. merged/isNew 는 이번 이동에만 쓰는 연출 플래그라 저장하지 않는다.
interface Save2048 {
  tiles: { id: number; value: number; r: number; c: number }[];
  score: number;
}

export default function Game2048({ onGameOver, bestScore, submitting, accountId }: GamePlayProps) {
  const idc = useRef(0);
  const nextId = useCallback(() => ++idc.current, []);
  const [tiles, setTiles] = useState<Tile[]>(() => newGame(nextId));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [restored, setRestored] = useState(false); // 저장된 판 확인이 끝났는지
  const reported = useRef(false);
  // 현재 판의 동기 사본. 리렌더 전에 방향키가 연달아 들어와도 직전 이동 결과 위에서 계산한다.
  const tilesRef = useRef(tiles);

  // tiles 를 바꾸는 유일한 통로 — ref 와 state 를 함께 갱신한다.
  const applyTiles = useCallback((next: Tile[]) => {
    tilesRef.current = next;
    setTiles(next);
  }, []);

  // 저장된 판 복원. localStorage 는 서버에서 읽을 수 없어 첫 렌더 후 처리한다.
  useEffect(() => {
    const saved = loadGame<Save2048>(SLUG, accountId);
    if (saved?.tiles?.length) {
      // 타일 id 카운터를 이어받지 않으면 새 타일 id 가 겹쳐 React key 가 충돌한다.
      idc.current = saved.tiles.reduce((max, t) => Math.max(max, t.id), 0);
      applyTiles(saved.tiles);
      setScore(saved.score);
      setOver(false);
      reported.current = false;
    }
    setRestored(true);
  }, [accountId, applyTiles]);

  // 판이 바뀔 때마다 저장. 게임 오버면 저장을 지운다.
  useEffect(() => {
    if (!restored) return;
    if (over) {
      clearGame(SLUG, accountId);
      return;
    }
    const plain = tiles.map((t) => ({ id: t.id, value: t.value, r: t.r, c: t.c }));
    saveGame<Save2048>(SLUG, accountId, { tiles: plain, score });
  }, [tiles, score, over, restored, accountId]);

  const reset = useCallback(() => {
    idc.current = 0;
    applyTiles(newGame(nextId));
    setScore(0);
    setOver(false);
    reported.current = false;
  }, [nextId, applyTiles]);

  // 이동 계산과 상태 변경은 setState 업데이터 밖에서 한다.
  // 업데이터 안에서 setScore 를 부르면 StrictMode 가 업데이터를 두 번 실행할 때 점수가 중복 가산된다.
  const doMove = useCallback(
    (dir: Dir) => {
      if (over || !restored) return; // 복원 전 입력은 무시(복원이 덮어써 버린다)
      const { tiles: moved, gained, moved: didMove } = planMove(tilesRef.current, dir);
      if (!didMove) return;
      const sp = spawn(moved, nextId);
      const next = sp ? [...moved, sp] : moved;
      applyTiles(next);
      if (gained) setScore((s) => s + gained);
      if (!canMove(next)) setOver(true);
    },
    [over, restored, nextId, applyTiles]
  );

  // 게임 오버 시 점수 1회 보고
  useEffect(() => {
    if (over && !reported.current) {
      reported.current = true;
      onGameOver(score, { game: "2048" });
    }
  }, [over, score, onGameOver]);

  // 키보드
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  // 스와이프
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Stat label="점수" value={score} />
          <Stat label="베스트" value={bestScore ?? 0} accent />
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink"
        >
          새 게임
        </button>
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative mx-auto aspect-square w-full max-w-[22rem] touch-none select-none rounded-xl bg-black/30 p-1.5"
      >
        {/* 배경 빈칸 */}
        <div className="absolute inset-1.5 grid grid-cols-4 grid-rows-4">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="p-1.5">
              <div className="h-full w-full rounded-lg bg-white/[0.04]" />
            </div>
          ))}
        </div>

        {/* 타일 — 복원 전에는 감춰 새 판이 한 프레임 비치는 걸 막는다 */}
        <div className="absolute inset-1.5" style={{ opacity: restored ? 1 : 0 }}>
          {tiles.map((t) => (
            <div
              key={t.id}
              className="absolute left-0 top-0 h-1/4 w-1/4 p-1.5"
              style={{
                transform: `translate(${t.c * 100}%, ${t.r * 100}%)`,
                transition: "transform 110ms ease",
              }}
            >
              <div
                className={`flex h-full w-full items-center justify-center rounded-lg font-display ${
                  t.merged ? "tile-pop" : t.isNew ? "tile-new" : ""
                }`}
                style={{ background: tileBg(t.value), color: tileColor(t.value), fontSize: tileFontSize(t.value) }}
              >
                {t.value}
              </div>
            </div>
          ))}
        </div>

        {over && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/70">
            <p className="font-display text-2xl text-ink">게임 오버</p>
            <p className="text-sm text-ink-dim">
              점수 <span className="tabular text-gold">{score}</span>
              {submitting && " · 기록 저장 중…"}
            </p>
            <button
              onClick={reset}
              className="rounded-xl bg-grass px-5 py-2.5 font-display text-pitch-base"
            >
              다시 하기
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-1.5 text-center">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div className={`tabular font-display text-lg ${accent ? "text-gold" : "text-ink"}`}>{value}</div>
    </div>
  );
}
