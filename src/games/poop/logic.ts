// 똥 피하기 — 졸라맨을 좌우로 움직여 위에서 떨어지는 똥을 피한다. 버틴 시간이 점수.
// 규칙 엔진(상태·물리·충돌)만 여기 두고 화면(render.ts)과 분리한다.

export const W = 320;
export const H = 440;

export const PLAYER_W = 22; // 충돌 판정 폭
export const PLAYER_H = 46; // 졸라맨 키
export const GROUND = H - 10; // 발이 닿는 y
export const POOP_R = 13;

const MOVE_SPEED = 250; // 좌우 이동 속도(px/s)
const RAMP_SEC = 50; // 이 시간에 걸쳐 최고 난이도까지 오른다

export interface Poop {
  x: number;
  y: number;
  r: number;
  vy: number;
}

export interface PoopState {
  px: number; // 졸라맨 중심 x
  dir: -1 | 0 | 1; // 현재 이동 방향(버튼)
  poops: Poop[];
  elapsed: number; // 버틴 시간(초)
  spawnTimer: number; // 다음 똥까지 남은 시간
  dead: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function newState(): PoopState {
  return { px: W / 2, dir: 0, poops: [], elapsed: 0, spawnTimer: 0.6, dead: false };
}

export function setDir(s: PoopState, d: -1 | 0 | 1): void {
  s.dir = d;
}

export function step(s: PoopState, dt: number): void {
  if (s.dead) return;
  s.elapsed += dt;

  // 이동
  const half = PLAYER_W / 2;
  s.px = clamp(s.px + s.dir * MOVE_SPEED * dt, half, W - half);

  // 난이도 곡선(0→1)
  const r = Math.min(s.elapsed / RAMP_SEC, 1);
  const fallSpeed = 150 + 260 * r; // 150 → 410 px/s
  const interval = 0.75 - 0.5 * r; // 0.75 → 0.25 s

  // 똥 생성
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    s.spawnTimer = interval * (0.6 + Math.random() * 0.8);
    s.poops.push({
      x: POOP_R + Math.random() * (W - 2 * POOP_R),
      y: -POOP_R,
      r: POOP_R,
      vy: fallSpeed * (0.85 + Math.random() * 0.3),
    });
  }

  // 낙하 + 충돌(원 vs 졸라맨 박스). 판정은 살짝 후하게(r*0.7).
  const boxT = GROUND - PLAYER_H;
  const boxL = s.px - half;
  const boxR = s.px + half;
  for (const p of s.poops) {
    p.y += p.vy * dt;
    const cx = clamp(p.x, boxL, boxR);
    const cy = clamp(p.y, boxT, GROUND);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const hit = p.r * 0.7;
    if (dx * dx + dy * dy <= hit * hit) s.dead = true;
  }

  // 화면 밖으로 지나간 똥 제거
  s.poops = s.poops.filter((p) => p.y < H + p.r * 2);
}

// 점수 = 버틴 시간(초, 정수).
export function scoreOf(s: PoopState): number {
  return Math.floor(s.elapsed);
}
