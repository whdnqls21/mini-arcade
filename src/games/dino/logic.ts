// 끝없이 달리며 장애물을 뛰어넘거나(점프) 몸을 낮춰(슬라이드) 피하는 게임.
// 화면과 무관한 순수 로직만 둔다. 좌표는 월드 단위, 시간은 초.

export const W = 320;
// 다른 게임과 높이를 맞추려고 세로를 키웠다(하단 버튼까지 포함해 비슷해진다).
export const H = 360;
export const GROUND_Y = 300; // 지면 높이(위에서부터)

export const DINO_X = 28;
export const DINO_W = 22;
export const DINO_H = 26; // 서 있을 때 높이
export const DINO_SLIDE_H = 14; // 슬라이드 중 높이(낮은 것 아래로 지나간다)

// 점프: 최고 높이 약 52, 체공 약 0.6초.
export const GRAVITY = 1156; // units/s²
export const JUMP_V = 347; // units/s
export const AIRTIME = (2 * JUMP_V) / GRAVITY;
export const JUMP_PEAK = (JUMP_V * JUMP_V) / (2 * GRAVITY);

export const SPEED_START = 180; // units/s
export const SPEED_MAX = 420;
export const SPEED_RAMP = 12; // 초당 증가

// 충돌 판정은 보이는 것보다 조금 너그럽게 준다.
const FORGIVE = 2.5;

// 슬라이드해야 지나갈 수 있는 공중 바의 아래 여백.
// 서 있는 높이(26)보다 낮고 슬라이드 높이(14)보다 높아야 슬라이드로만 통과된다.
const OVERHANG_CLEAR = 17;

export type ObstacleKind = "ground" | "overhang";

export interface Obstacle {
  x: number;
  w: number;
  base: number; // 아래 끝(지면 위 높이). ground 는 0.
  h: number; // 세로 두께
  kind: ObstacleKind;
}

export interface DinoState {
  speed: number;
  dist: number; // 누적 이동 거리
  y: number; // 지면 위 높이(0 = 착지)
  vy: number;
  sliding: boolean;
  obstacles: Obstacle[];
  gapLeft: number; // 다음 장애물까지 남은 거리
  dead: boolean;
}

export function newState(): DinoState {
  return {
    speed: SPEED_START,
    dist: 0,
    y: 0,
    vy: 0,
    sliding: false,
    obstacles: [],
    gapLeft: 260, // 첫 장애물까지는 넉넉히
    dead: false,
  };
}

export const scoreOf = (s: DinoState) => Math.floor(s.dist / 10);

export function jump(s: DinoState): boolean {
  if (s.dead || s.y > 0) return false; // 공중에서는 다시 못 뛴다
  s.vy = JUMP_V;
  return true;
}

// 슬라이드는 땅에 있을 때만 몸을 낮춘다(공중에선 무시). 버튼을 누르는 동안 유지.
export function setSlide(s: DinoState, on: boolean): void {
  s.sliding = on;
}

// 현재 충돌 상자의 높이 — 땅에서 슬라이드 중일 때만 낮아진다.
function dinoHeight(s: DinoState): number {
  return s.sliding && s.y === 0 ? DINO_SLIDE_H : DINO_H;
}

/** 이 속도에서 반드시 뛰어넘을 수 있는 최소 간격. */
export function minGap(speed: number): number {
  return speed * AIRTIME + DINO_W + 26;
}

/**
 * 속도가 붙을수록 어려운 장애물이 열린다. 느릴수록 체공 거리가 짧아
 * 오히려 정확히 뛰어야 하므로, 종류를 안 가리면 시작 직후가 가장 어렵다.
 */
function makeObstacle(rnd: () => number, speed: number): Obstacle {
  const hard = (speed - SPEED_START) / (SPEED_MAX - SPEED_START); // 0~1
  const roll = rnd();
  const ground = (h: number): Obstacle => ({ x: W, w: h > 26 ? 13 : 11, base: 0, h, kind: "ground" });
  // 공중 바 — 아래 여백 아래로 슬라이드해서 지난다. 점프로는 못 넘게 위로 충분히 높인다.
  const overhang = (): Obstacle => ({
    x: W,
    w: 20 + Math.round(rnd() * 10),
    base: OVERHANG_CLEAR,
    h: 46, // OVERHANG_CLEAR + 46 = 63 > 점프 최고점, 점프로는 통과 불가
    kind: "overhang",
  });

  if (hard < 0.18) {
    // 도입부 — 낮은 지상 장애물만
    return ground(18 + Math.round(rnd() * 4));
  }
  if (hard < 0.45) {
    // 중반 — 지상 위주, 가끔 공중 바
    if (roll < 0.75) return ground(18 + Math.round(rnd() * 7));
    return overhang();
  }
  // 후반 — 지상 높은 것과 공중 바가 골고루
  if (roll < 0.5) return ground(20 + Math.round(rnd() * 12));
  if (roll < 0.8) return overhang();
  // 붙어 있는 지상 무리
  const n = 2 + Math.floor(rnd() * 2);
  return { x: W, w: 9 * n + 3 * (n - 1), base: 0, h: 20 + Math.round(rnd() * 8), kind: "ground" };
}

export function step(s: DinoState, dtSec: number, rnd: () => number = Math.random): void {
  if (s.dead) return;

  s.speed = Math.min(SPEED_MAX, s.speed + SPEED_RAMP * dtSec);
  const dx = s.speed * dtSec;
  s.dist += dx;

  // 점프 물리
  if (s.y > 0 || s.vy > 0) {
    s.vy -= GRAVITY * dtSec;
    s.y += s.vy * dtSec;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = 0;
    }
  }

  // 장애물 이동 + 화면 밖 제거
  for (const o of s.obstacles) o.x -= dx;
  while (s.obstacles.length && s.obstacles[0].x + s.obstacles[0].w < -10) s.obstacles.shift();

  // 다음 장애물 생성
  s.gapLeft -= dx;
  if (s.gapLeft <= 0) {
    s.obstacles.push(makeObstacle(rnd, s.speed));
    const base = minGap(s.speed);
    s.gapLeft = base + rnd() * base * 0.7;
  }

  // 충돌 — 세로로 [발, 발+높이] 와 장애물 [base, base+h] 가 겹치는지
  const left = DINO_X + FORGIVE;
  const right = DINO_X + DINO_W - FORGIVE;
  const bottom = s.y;
  const top = s.y + dinoHeight(s) - FORGIVE;
  for (const o of s.obstacles) {
    if (o.x + o.w < left || o.x > right) continue;
    if (bottom < o.base + o.h && top > o.base) {
      s.dead = true;
      return;
    }
  }
}
