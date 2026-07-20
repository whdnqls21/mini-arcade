"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RetryButton } from "@/games/shared";
import type { GamePlayProps } from "@/games/types";
import { clearGame, loadGame, saveGame } from "@/lib/game-save";
import { burst, type Particle, playDropSound, playMergeSound, stepParticles } from "./effects";
import {
  createWorld,
  DEATH_GRACE_MS,
  DEATH_Y,
  DROP_Y,
  type FruitSnapshot,
  type SuikaWorld,
  WORLD_H,
  WORLD_W,
} from "./engine";
import { FruitChain, FruitIcon } from "./FruitIcon";
import { DROPPABLE, FRUITS, randomDropIndex } from "./fruits";
import { drawFruit } from "./render";

const SLUG = "suika";
const FIXED_MS = 1000 / 60; // 물리 고정 스텝
const DROP_COOLDOWN_MS = 420;
const COMBO_WINDOW_MS = 1200;
const POP_MS = 220;
const SAVE_INTERVAL_MS = 1000;

interface SaveSuika {
  fruits: FruitSnapshot[];
  score: number;
  current: number;
  next: number;
}

export default function SuikaGame({ onGameOver, bestScore, submitting, accountId }: GamePlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<SuikaWorld | null>(null);

  // 루프 안에서 쓰는 값은 전부 ref — 리렌더와 무관하게 최신값을 봐야 한다.
  const scoreRef = useRef(0);
  const overRef = useRef(false);
  const dropXRef = useRef(WORLD_W / 2);
  const currentRef = useRef(0);
  const nextRef = useRef(0);
  const lastDropRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const popRef = useRef<Map<number, number>>(new Map()); // bodyId → 시작 시각
  const comboRef = useRef({ count: 0, at: 0 });
  const lastSaveRef = useRef(0);

  // 화면 표시용 미러
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [current, setCurrentUi] = useState(0);
  const [next, setNextUi] = useState(0);
  const [combo, setCombo] = useState(0);
  const [ready, setReady] = useState(false);
  const reported = useRef(false);

  const setCurrent = useCallback((i: number) => {
    currentRef.current = i;
    setCurrentUi(i);
  }, []);
  const setNext = useCallback((i: number) => {
    nextRef.current = i;
    setNextUi(i);
  }, []);

  const persist = useCallback(() => {
    const world = worldRef.current;
    if (!world || overRef.current) return;
    saveGame<SaveSuika>(SLUG, accountId, {
      fruits: world.snapshot(),
      score: scoreRef.current,
      current: currentRef.current,
      next: nextRef.current,
    });
  }, [accountId]);

  const reset = useCallback(() => {
    worldRef.current?.clear();
    scoreRef.current = 0;
    overRef.current = false;
    particlesRef.current = [];
    popRef.current.clear();
    comboRef.current = { count: 0, at: 0 };
    lastDropRef.current = 0;
    setScore(0);
    setOver(false);
    setCombo(0);
    setCurrent(randomDropIndex());
    setNext(randomDropIndex());
    reported.current = false;
    clearGame(SLUG, accountId);
  }, [accountId, setCurrent, setNext]);

  // ── 월드 생성 + 저장된 판 복원 ─────────────────────────────────────
  useEffect(() => {
    const world = createWorld();
    worldRef.current = world;

    const saved = loadGame<SaveSuika>(SLUG, accountId);
    if (saved?.fruits?.length) {
      world.restore(saved.fruits);
      scoreRef.current = saved.score ?? 0;
      setScore(scoreRef.current);
      setCurrent(saved.current ?? randomDropIndex());
      setNext(saved.next ?? randomDropIndex());
    } else {
      setCurrent(randomDropIndex());
      setNext(randomDropIndex());
    }
    setReady(true);

    return () => {
      world.destroy();
      worldRef.current = null;
    };
  }, [accountId, setCurrent, setNext]);

  // ── 물리 + 렌더 루프 ───────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    // 캔버스 해상도를 컨테이너 크기 × DPR 로 맞춘다.
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const advance = (dt: number) => {
      if (overRef.current) return;
      const { merges, overMs } = world.step(dt);
      const now = performance.now();

      for (const m of merges) {
        scoreRef.current += m.score;
        particlesRef.current.push(...burst(m.x, m.y, FRUITS[m.index - 1].color, FRUITS[m.index].radius));
        popRef.current.set(m.bodyId, now);
        playMergeSound(m.index);
        // 연속 합체를 콤보로 센다
        const c = comboRef.current;
        c.count = now - c.at < COMBO_WINDOW_MS ? c.count + 1 : 1;
        c.at = now;
      }
      if (merges.length) {
        setScore(scoreRef.current);
        setCombo(comboRef.current.count);
      } else if (comboRef.current.count && now - comboRef.current.at > COMBO_WINDOW_MS) {
        comboRef.current.count = 0;
        setCombo(0);
      }

      if (overMs >= DEATH_GRACE_MS) {
        overRef.current = true;
        setOver(true);
        clearGame(SLUG, accountId);
      }

      if (now - lastSaveRef.current > SAVE_INTERVAL_MS) {
        lastSaveRef.current = now;
        persist();
      }
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (rect.width * dpr) / WORLD_W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, WORLD_W, WORLD_H);

      // 배경
      ctx.fillStyle = "#0a0f16";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      const now = performance.now();

      // 경계선 — 과일이 근처에 있으면 붉게
      const danger = world.fruits().some((b) => b.position.y - FRUITS[b.fruitIndex].radius < DEATH_Y + 16);
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = danger ? "rgba(255,107,107,0.75)" : "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, DEATH_Y);
      ctx.lineTo(WORLD_W, DEATH_Y);
      ctx.stroke();
      ctx.restore();

      // 조준선 + 다음에 떨어질 과일 미리보기
      if (!overRef.current) {
        const f = FRUITS[currentRef.current];
        const x = Math.min(WORLD_W - f.radius, Math.max(f.radius, dropXRef.current));
        const cooling = now - lastDropRef.current < DROP_COOLDOWN_MS;
        ctx.save();
        // 안내선은 흐리게, 과일은 또렷하게. 같은 알파를 쓰면 과일이 탁한 갈색으로 죽는다.
        ctx.globalAlpha = cooling ? 0.15 : 0.4;
        ctx.setLineDash([4, 7]);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, DROP_Y + f.radius);
        ctx.lineTo(x, WORLD_H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = cooling ? 0.45 : 1;
        drawFruit(ctx, currentRef.current, x, DROP_Y, f.radius, 0, 1);
        ctx.restore();
      }

      // 과일
      for (const body of world.fruits()) {
        const f = FRUITS[body.fruitIndex];
        const started = popRef.current.get(body.id);
        let s = 1;
        if (started !== undefined) {
          const t = (now - started) / POP_MS;
          if (t >= 1) popRef.current.delete(body.id);
          else s = 1 + Math.sin(Math.min(t, 1) * Math.PI) * 0.18; // 잠깐 부풀었다 돌아온다
        }
        drawFruit(ctx, body.fruitIndex, body.position.x, body.position.y, f.radius, body.angle, s);
      }

      // 파티클
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      // 탭이 백그라운드였다 돌아오면 delta 가 커진다 — 한 번에 몰아서 계산하지 않도록 자른다.
      const delta = Math.min(now - last, 100);
      last = now;
      acc += delta;
      let guard = 0;
      while (acc >= FIXED_MS && guard++ < 6) {
        advance(FIXED_MS);
        acc -= FIXED_MS;
      }
      particlesRef.current = stepParticles(particlesRef.current, delta / FIXED_MS);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ready, accountId, persist]);

  // ── 입력 ───────────────────────────────────────────────────────────
  const toWorldX = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return WORLD_W / 2;
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * WORLD_W;
  }, []);

  const aim = useCallback(
    (clientX: number) => {
      dropXRef.current = toWorldX(clientX);
    },
    [toWorldX]
  );

  const release = useCallback(
    (clientX: number) => {
      const world = worldRef.current;
      if (!world || overRef.current) return;
      const now = performance.now();
      if (now - lastDropRef.current < DROP_COOLDOWN_MS) return;
      lastDropRef.current = now;
      dropXRef.current = toWorldX(clientX);
      world.drop(currentRef.current, dropXRef.current);
      playDropSound();
      setCurrent(nextRef.current);
      setNext(randomDropIndex());
      persist();
    },
    [toWorldX, setCurrent, setNext, persist]
  );

  // 게임 오버 시 점수 1회 보고
  useEffect(() => {
    if (over && !reported.current) {
      reported.current = true;
      onGameOver(score, { game: SLUG });
    }
  }, [over, score, onGameOver]);

  // 페이지를 벗어날 때 마지막 상태를 저장
  useEffect(() => {
    return () => {
      persist();
    };
  }, [persist]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Stat label="점수" value={score} />
          <Stat label="베스트" value={bestScore ?? 0} accent />
        </div>
        <div className="flex items-center gap-2">
          <NextPreview next={next} />
          <button
            onClick={reset}
            className="shrink-0 whitespace-nowrap rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink-dim hover:text-ink"
          >
            새 게임
          </button>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => e.buttons > 0 && aim(e.clientX)}
          onPointerDown={(e) => aim(e.clientX)}
          onPointerUp={(e) => release(e.clientX)}
          style={{ aspectRatio: `${WORLD_W} / ${WORLD_H}` }}
          className="w-full touch-none select-none rounded-xl border border-pitch-line"
        />

        {combo >= 2 && (
          <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 font-display text-2xl text-gold drop-shadow">
            {combo} COMBO!
          </div>
        )}

        {over && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/70">
            <p className="font-display text-2xl text-ink">게임 오버</p>
            <p className="text-sm text-ink-dim">
              점수 <span className="tabular text-gold">{score}</span>
            </p>
            <RetryButton submitting={submitting} onRetry={reset} />
          </div>
        )}
      </div>

      {/* 과일 순서 — 게임 중에도 보이게 둔다. 지금 떨어뜨릴 과일에 표시가 붙는다. */}
      <div className="rounded-lg bg-black/20 px-1.5 py-1">
        <FruitChain compact highlight={current} />
      </div>
    </div>
  );
}

// 지금 떨어뜨릴 과일은 판 위와 아래 순서표에 이미 보이므로, 여기서는 다음 것만 알려준다.
function NextPreview({ next }: { next: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-black/20 px-2.5 py-1">
      <span className="text-[10px] text-ink-faint">다음</span>
      <FruitIcon index={Math.min(next, DROPPABLE - 1)} size={24} />
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
