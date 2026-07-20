// 크롬 다이노 화면 그리기. 컴포넌트와 분리해 정적으로도 한 프레임을 그려볼 수 있게 한다.

import { DINO_H, DINO_X, type DinoState, GROUND_Y, H, W } from "./logic";

// ── 그리기 ───────────────────────────────────────────────────────────
// 규칙: 민트는 공룡에게만 쓴다. 나머지는 채도를 뺀 청회색이라 눈이 항상 주인공을 먼저 찾는다.
// 그리고 모든 것을 같은 픽셀 격자에 스냅해 조립한 티가 아니라 픽셀아트로 읽히게 한다.
const PX = 2; // 픽셀 한 칸 = 월드 2단위

const MINT = "#4de0c0"; // 공룡 전용
const MINT_DEAD = "#6b7a8a";
const CACTUS = "#2f7d68";
const DUNE_FAR = "#18222e";
const DUNE_NEAR = "#223040";
const GROUND_BAND = "#2b3947";
const GROUND_EDGE = "#3c4c5c";
const MOON = "#e8d9a0";
const NIGHT = "#0a0f16";

// 공룡 — 11x13 픽셀(= 22x26 월드단위, 충돌 상자와 정확히 같다)
const DINO_BODY = [
  ".......####",
  ".......#o##",
  ".......####",
  ".......####",
  ".......###.",
  "###....###.",
  "..#########",
  "..#########",
  "..########.",
  "..#######..",
];
// 허벅지는 늘 있고 어느 발이 땅에 닿는지만 번갈아 바뀐다 — 이게 달리는 것처럼 보인다.
const LEGS_A = ["..##..##...", "..##..##...", ".###......."];
const LEGS_B = ["..##..##...", "..##..##...", "......###.."];
const LEGS_AIR = ["..##..##...", "..##..##...", "..........."];

function drawSprite(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  x: number,
  y: number,
  color: string
) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      ctx.fillStyle = ch === "o" ? NIGHT : color;
      ctx.fillRect(x + c * PX, y + r * PX, PX, PX);
    }
  }
}

// 사구 능선 — 같은 x 에 대해 항상 같은 높이가 나오도록 계산만으로 만든다.
function duneTop(x: number, seed: number, amp: number, base: number): number {
  const h =
    base + Math.sin(x * 0.017 + seed) * amp + Math.sin(x * 0.0071 + seed * 2.3) * amp * 0.55;
  return Math.round(h / PX) * PX; // 픽셀 격자에 맞춰 계단처럼 잘린다
}

function drawDunes(
  ctx: CanvasRenderingContext2D,
  offset: number,
  seed: number,
  amp: number,
  base: number,
  color: string
) {
  ctx.fillStyle = color;
  for (let sx = 0; sx < W; sx += PX) {
    const top = duneTop(sx + offset, seed, amp, base);
    ctx.fillRect(sx, top, PX, GROUND_Y - top);
  }
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  s: DinoState,
  running: boolean
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (rect.width * dpr) / W;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // 밤하늘 — 아주 옅은 세로 그라데이션
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#0b1119");
  sky.addColorStop(1, "#131c26");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 별 — 위쪽 하늘이 비어 보이지 않게. 아주 느리게 흘러 배경으로만 남는다.
  ctx.fillStyle = "rgba(255,255,255,0.20)";
  for (let i = 0; i < 16; i++) {
    const seedX = (i * 97) % 311;
    const sy = 8 + ((i * 53) % 62);
    const sx = Math.round((W + 40 - ((s.dist * 0.03 + seedX) % (W + 40))) / PX) * PX;
    ctx.fillRect(sx, Math.round(sy / PX) * PX, PX, PX);
  }

  // 달 — 화면에서 가장 느리게 흐른다. 유일한 따뜻한 색.
  // 시작 시점에 화면 안에 있어야 하므로 위상을 미리 밀어둔다.
  const moonX = Math.round((W + 60 - ((s.dist * 0.05 + 130) % (W + 120))) / PX) * PX;
  ctx.fillStyle = MOON;
  for (let r = -5; r <= 5; r++) {
    const half = Math.round(Math.sqrt(Math.max(0, 25 - r * r))) * PX;
    if (half > 0) ctx.fillRect(moonX - half, 24 + r * PX, half * 2, PX);
  }

  // 사구 두 겹 — 뒤가 느리고 앞이 빠르다
  drawDunes(ctx, s.dist * 0.15, 1.7, 9, GROUND_Y - 30, DUNE_FAR);
  drawDunes(ctx, s.dist * 0.35, 4.2, 7, GROUND_Y - 14, DUNE_NEAR);

  // 땅
  ctx.fillStyle = GROUND_BAND;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = GROUND_EDGE;
  ctx.fillRect(0, GROUND_Y, W, PX);

  // 자갈 — 땅과 같은 속도로 흘러 속도감을 만든다
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  for (let i = 0; i < 16; i++) {
    const gx = Math.round((W - ((s.dist + i * 37) % (W + 40))) / PX) * PX;
    ctx.fillRect(gx, GROUND_Y + PX * 2 + (i % 3) * PX * 2, PX * 3, PX);
  }

  drawCacti(ctx, s);
  drawDino(ctx, s, running);
}

function drawCacti(ctx: CanvasRenderingContext2D, s: DinoState) {
  ctx.fillStyle = CACTUS;
  for (const o of s.obstacles) {
    const x = Math.round(o.x / PX) * PX;
    const h = Math.round(o.h / PX) * PX;
    const top = GROUND_Y - h;

    if (o.w > 20) {
      // 무리 — 굵기가 다른 기둥 여러 개
      const n = Math.round(o.w / 12);
      for (let i = 0; i < n; i++) {
        const bx = x + i * PX * 6;
        const bh = h - (i % 2) * PX * 2;
        ctx.fillRect(bx, GROUND_Y - bh, PX * 2, bh);
      }
      continue;
    }

    // 기둥 + 팔 — 팔 높이를 좌우로 어긋나게 둬야 선인장처럼 보인다
    ctx.fillRect(x + PX, top, PX * 3, h);
    const armL = top + Math.round(h * 0.4 / PX) * PX;
    ctx.fillRect(x - PX, armL, PX * 2, PX);
    ctx.fillRect(x - PX, armL, PX, PX * 3);
    const armR = top + Math.round(h * 0.6 / PX) * PX;
    ctx.fillRect(x + PX * 4, armR, PX * 2, PX);
    ctx.fillRect(x + PX * 5, armR - PX * 2, PX, PX * 3);
  }
}

function drawDino(ctx: CanvasRenderingContext2D, s: DinoState, running: boolean) {
  const foot = GROUND_Y - s.y;
  const x = Math.round(DINO_X / PX) * PX;
  const y = Math.round((foot - DINO_H) / PX) * PX;
  const color = s.dead ? MINT_DEAD : MINT;

  // 발밑 그림자 — 공중에 뜬 정도가 눈에 보이게 한다
  if (!s.dead) {
    const lift = Math.min(1, s.y / 52);
    ctx.fillStyle = `rgba(0,0,0,${0.35 - lift * 0.25})`;
    const sw = PX * (8 - Math.round(lift * 3));
    ctx.fillRect(x + PX * 2, GROUND_Y + PX, sw, PX);
  }

  drawSprite(ctx, DINO_BODY, x, y, color);
  const legs = s.y > 0.5 ? LEGS_AIR : running ? (Math.floor(s.dist / 14) % 2 ? LEGS_B : LEGS_A) : LEGS_A;
  drawSprite(ctx, legs, x, y + DINO_BODY.length * PX, color);
}
