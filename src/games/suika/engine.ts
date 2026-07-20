// matter.js 물리 월드 래퍼. React 와 무관하게 동작하며 렌더링도 하지 않는다.
// (Matter.Render 는 쓰지 않고 캔버스 그리기는 컴포넌트가 담당)

import Matter from "matter-js";

import { FRUITS, MAX_INDEX, mergeScore } from "./fruits";

const { Bodies, Body, Composite, Engine, Events } = Matter;

export const WORLD_W = 320;
export const WORLD_H = 440;
export const DROP_Y = 40; // 과일이 생성되는 높이
export const DEATH_Y = 78; // 이 선보다 위에 과일이 머무르면 게임 오버
export const DEATH_GRACE_MS = 1000; // 유예 시간 — 떨어뜨린 직후 튀는 건 봐준다

const WALL = 60; // 벽 두께 (충분히 두꺼워야 빠른 과일이 뚫고 나가지 않는다)

export interface FruitBody extends Matter.Body {
  fruitIndex: number;
  bornAt: number; // 월드 시계 기준 생성 시각
}

// 생성 직후에는 속도가 0이라 "정지 상태"로 오판된다. 이 시간 동안은 게임 오버 판정에서 제외.
const BIRTH_GRACE_MS = 600;

export interface MergeEvent {
  x: number;
  y: number;
  index: number; // 새로 만들어진 과일 단계
  score: number;
  bodyId: number; // 팝 애니메이션을 걸 대상
}

export interface FruitSnapshot {
  i: number; // fruitIndex
  x: number;
  y: number;
  a: number; // angle
  vx: number;
  vy: number;
  va: number; // angularVelocity
}

function isFruit(body: Matter.Body): body is FruitBody {
  return (body as FruitBody).fruitIndex !== undefined;
}

export function createWorld() {
  const engine = Engine.create();
  engine.gravity.y = 1.4;
  // 위치 보정 반복 횟수를 늘리면 많이 쌓였을 때 서로 파고드는 걸 줄일 수 있다.
  engine.positionIterations = 8;
  engine.velocityIterations = 8;

  const walls = [
    // 좌/우/바닥. 천장은 없다 — 과일이 위로 넘치는 게 곧 게임 오버 조건.
    Bodies.rectangle(-WALL / 2, WORLD_H / 2, WALL, WORLD_H * 3, { isStatic: true }),
    Bodies.rectangle(WORLD_W + WALL / 2, WORLD_H / 2, WALL, WORLD_H * 3, { isStatic: true }),
    Bodies.rectangle(WORLD_W / 2, WORLD_H + WALL / 2, WORLD_W + WALL * 2, WALL, { isStatic: true }),
  ];
  Composite.add(engine.world, walls);

  // 합칠 쌍은 큐에 모았다가 스텝이 끝난 뒤 처리한다.
  // collisionStart 콜백 안에서 body 를 지우면 엔진이 순회 중인 배열이 바뀌어 깨진다.
  let pending: [FruitBody, FruitBody][] = [];
  const consumed = new Set<number>(); // 이미 합쳐지기로 예약된 body id

  Events.on(engine, "collisionStart", (evt) => {
    for (const { bodyA, bodyB } of evt.pairs) {
      if (!isFruit(bodyA) || !isFruit(bodyB)) continue;
      if (bodyA.fruitIndex !== bodyB.fruitIndex) continue;
      if (bodyA.fruitIndex >= MAX_INDEX) continue; // 수박끼리는 합쳐지지 않는다
      if (consumed.has(bodyA.id) || consumed.has(bodyB.id)) continue;
      consumed.add(bodyA.id);
      consumed.add(bodyB.id);
      pending.push([bodyA, bodyB]);
    }
  });

  function makeFruit(index: number, x: number, y: number): FruitBody {
    const f = FRUITS[index];
    const body = Bodies.circle(x, y, f.radius, {
      restitution: 0.2, // 살짝만 튀도록
      friction: 0.4,
      frictionStatic: 0.6,
      density: 0.001,
    }) as FruitBody;
    body.fruitIndex = index;
    body.bornAt = clock;
    return body;
  }

  function drop(index: number, x: number): FruitBody {
    const r = FRUITS[index].radius;
    const clamped = Math.min(WORLD_W - r, Math.max(r, x));
    const body = makeFruit(index, clamped, DROP_Y);
    Composite.add(engine.world, body);
    return body;
  }

  // 게임 오버 판정용 — 과일별로 "경계선 위에 머문 시간" 누적
  const aboveSince = new Map<number, number>();
  let clock = 0; // 월드 내부 시계 (실제 시각과 무관하게 스텝 누적)

  function step(dtMs: number): { merges: MergeEvent[]; overMs: number } {
    clock += dtMs;
    Engine.update(engine, dtMs);

    const merges: MergeEvent[] = [];
    if (pending.length) {
      const queue = pending;
      pending = [];
      for (const [a, b] of queue) {
        // 스텝 사이에 이미 제거됐을 수 있으니 월드에 남아 있는지 확인
        if (!Composite.get(engine.world, a.id, "body") || !Composite.get(engine.world, b.id, "body")) {
          continue;
        }
        const x = (a.position.x + b.position.x) / 2;
        const y = (a.position.y + b.position.y) / 2;
        const next = a.fruitIndex + 1;
        Composite.remove(engine.world, a);
        Composite.remove(engine.world, b);
        aboveSince.delete(a.id);
        aboveSince.delete(b.id);
        const merged = makeFruit(next, x, y);
        Composite.add(engine.world, merged);
        merges.push({ x, y, index: next, score: mergeScore(next), bodyId: merged.id });
      }
      consumed.clear();
    }

    // 경계선 위에 느리게 머무는 과일이 있으면 시간 누적
    let overMs = 0;
    for (const body of Composite.allBodies(engine.world)) {
      if (!isFruit(body)) continue;
      if (clock - body.bornAt < BIRTH_GRACE_MS) continue; // 갓 생성된 과일은 제외
      const r = FRUITS[body.fruitIndex].radius;
      const settled = body.speed < 1.2; // 아직 떨어지는 중이면 봐준다
      if (settled && body.position.y - r < DEATH_Y) {
        const acc = (aboveSince.get(body.id) ?? 0) + dtMs;
        aboveSince.set(body.id, acc);
        overMs = Math.max(overMs, acc);
      } else {
        aboveSince.delete(body.id);
      }
    }
    return { merges, overMs };
  }

  function fruits(): FruitBody[] {
    return Composite.allBodies(engine.world).filter(isFruit);
  }

  function snapshot(): FruitSnapshot[] {
    return fruits().map((b) => ({
      i: b.fruitIndex,
      x: Math.round(b.position.x * 100) / 100,
      y: Math.round(b.position.y * 100) / 100,
      a: Math.round(b.angle * 1000) / 1000,
      vx: Math.round(b.velocity.x * 100) / 100,
      vy: Math.round(b.velocity.y * 100) / 100,
      va: Math.round(b.angularVelocity * 1000) / 1000,
    }));
  }

  function restore(snap: FruitSnapshot[]): void {
    clear();
    for (const s of snap) {
      if (s.i < 0 || s.i > MAX_INDEX) continue; // 저장 구조가 바뀐 경우 방어
      const body = makeFruit(s.i, s.x, s.y);
      Body.setAngle(body, s.a);
      Body.setVelocity(body, { x: s.vx, y: s.vy });
      Body.setAngularVelocity(body, s.va);
      Composite.add(engine.world, body);
    }
  }

  function clear(): void {
    for (const body of fruits()) Composite.remove(engine.world, body);
    aboveSince.clear();
    consumed.clear();
    pending = [];
  }

  function destroy(): void {
    Events.off(engine, "collisionStart");
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  }

  return { drop, step, fruits, snapshot, restore, clear, destroy };
}

export type SuikaWorld = ReturnType<typeof createWorld>;
