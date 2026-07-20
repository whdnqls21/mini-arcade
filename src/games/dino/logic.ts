// 끝없이 달리며 장애물을 뛰어넘는 게임. 화면과 무관한 순수 로직만 둔다.
// 좌표 단위는 월드 기준이고 시간은 초를 쓴다(중력·속도 계산이 읽기 쉬워진다).

export const W = 320;
// 세로가 너무 납작하면 시작/게임오버 화면이 판을 넘친다. 하늘을 넉넉히 둔다.
export const H = 176;
export const GROUND_Y = 132; // 지면 높이(위에서부터)

export const DINO_X = 28;
export const DINO_W = 22;
export const DINO_H = 26;

// 점프: 최고 높이 약 52, 체공 약 0.6초.
// 가장 높은 장애물(36)보다 16 정도 여유를 둬야 타이밍 허용 폭이 쓸 만해진다.
export const GRAVITY = 1156; // units/s²
export const JUMP_V = 347; // units/s
export const AIRTIME = (2 * JUMP_V) / GRAVITY;
export const JUMP_PEAK = (JUMP_V * JUMP_V) / (2 * GRAVITY);

export const SPEED_START = 180; // units/s
export const SPEED_MAX = 420;
export const SPEED_RAMP = 12; // 초당 증가

// 충돌 판정은 보이는 것보다 조금 너그럽게 준다.
const FORGIVE = 2.5;

export interface Obstacle {
  x: number;
  w: number;
  h: number;
}

export interface DinoState {
  speed: number;
  dist: number; // 누적 이동 거리
  y: number; // 지면 위 높이(0 = 착지)
  vy: number;
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

/**
 * 이 속도에서 반드시 뛰어넘을 수 있는 최소 간격.
 * 체공 중 지나가는 거리에 몸통과 여유를 더한다. 이걸 지키지 않으면
 * 속도가 붙었을 때 물리적으로 통과 불가능한 배치가 나온다.
 */
export function minGap(speed: number): number {
  return speed * AIRTIME + DINO_W + 26;
}

/**
 * 속도가 붙을수록 어려운 장애물이 열린다.
 * 느릴수록 체공 중 이동 거리가 짧아 오히려 정확히 뛰어야 하므로,
 * 종류를 가리지 않으면 시작 직후가 가장 어려운 거꾸로 된 난이도가 된다.
 */
function makeObstacle(rnd: () => number, speed: number): Obstacle {
  const hard = (speed - SPEED_START) / (SPEED_MAX - SPEED_START); // 0~1
  const roll = rnd();

  if (hard < 0.2) {
    // 도입부 — 낮고 좁은 것만
    return { x: W, w: 11, h: 18 + Math.round(rnd() * 4) };
  }
  if (hard < 0.5) {
    // 중반 — 중간 높이까지
    if (roll < 0.65) return { x: W, w: 11, h: 18 + Math.round(rnd() * 5) };
    return { x: W, w: 13, h: 24 + Math.round(rnd() * 5) };
  }
  // 후반 — 높은 것과 무리까지 전부
  if (roll < 0.4) return { x: W, w: 11, h: 18 + Math.round(rnd() * 5) };
  if (roll < 0.75) return { x: W, w: 13, h: 28 + Math.round(rnd() * 8) };
  const n = 2 + Math.floor(rnd() * 2);
  return { x: W, w: 9 * n + 3 * (n - 1), h: 20 + Math.round(rnd() * 8) };
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

  // 충돌
  const left = DINO_X + FORGIVE;
  const right = DINO_X + DINO_W - FORGIVE;
  const bottom = s.y; // 발
  const top = s.y + DINO_H - FORGIVE;
  for (const o of s.obstacles) {
    if (o.x + o.w < left || o.x > right) continue;
    if (bottom < o.h && top > 0) {
      s.dead = true;
      return;
    }
  }
}
