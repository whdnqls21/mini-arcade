// 과일 그리기. 물리 바디가 원이라 실루엣은 원을 유지하고,
// 과일다움은 표면 무늬와 꼭지로 낸다. 광원은 항상 왼쪽 위 — 더미로 쌓였을 때 한 장면처럼 보이게.

import { FRUITS } from "./fruits";

const LEAF = "#5f9e3f";
const LEAF_DARK = "#43762c";

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  radius: number,
  angle: number,
  scale = 1
) {
  const f = FRUITS[index];
  const r = radius * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 본체
  const grad = ctx.createRadialGradient(-r * 0.32, -r * 0.36, r * 0.08, 0, 0, r);
  grad.addColorStop(0, f.color);
  grad.addColorStop(1, f.shade);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // 표면 무늬 — 실루엣 밖으로 새지 않게 원 안으로 자른다
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  detail(ctx, index, r);
  ctx.restore();

  // 꼭지·잎은 원 밖으로 살짝 나온다
  topper(ctx, index, r);

  // 광택
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, -r * 0.4, r * 0.24, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // 아래쪽 그림자 테두리로 입체감 마무리
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, 0, r - ctx.lineWidth / 2, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  ctx.restore();
}

// ── 표면 무늬 ────────────────────────────────────────────────────────
function detail(ctx: CanvasRenderingContext2D, index: number, r: number) {
  switch (index) {
    case 0: // 체리 — 오목한 결 하나만
      ctx.strokeStyle = "rgba(0,0,0,0.16)";
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.arc(-r * 0.15, -r * 0.9, r * 0.7, Math.PI * 0.35, Math.PI * 0.75);
      ctx.stroke();
      break;

    case 1: // 딸기 — 씨
      ctx.fillStyle = "rgba(255,236,180,0.85)";
      for (const [sx, sy] of seedGrid(r)) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, r * 0.07, r * 0.11, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 2: // 포도 — 알갱이 뭉침
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      for (const [gx, gy, gr] of [
        [-r * 0.38, r * 0.1, r * 0.34],
        [r * 0.32, -r * 0.18, r * 0.3],
        [r * 0.08, r * 0.46, r * 0.3],
      ] as const) {
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 3: // 한라봉 — 껍질 결
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = r * 0.05;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      break;

    case 4: // 감 — 아래로 갈수록 진해지는 결
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = r * 0.06;
      for (const dx of [-r * 0.4, 0, r * 0.4]) {
        ctx.beginPath();
        ctx.moveTo(dx, -r);
        ctx.quadraticCurveTo(dx * 1.3, 0, dx, r);
        ctx.stroke();
      }
      break;

    case 5: // 사과 — 세로 하이라이트
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.ellipse(r * 0.34, r * 0.05, r * 0.16, r * 0.6, 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 6: // 배 — 잔점
      ctx.fillStyle = "rgba(90,80,30,0.28)";
      for (const [sx, sy] of freckles(r)) {
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 7: // 복숭아 — 가운데 골
      ctx.strokeStyle = "rgba(160,60,60,0.3)";
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.moveTo(-r * 0.05, -r);
      ctx.quadraticCurveTo(r * 0.3, 0, -r * 0.05, r);
      ctx.stroke();
      break;

    case 8: // 파인애플 — 마름모 격자
      ctx.strokeStyle = "rgba(140,95,10,0.4)";
      ctx.lineWidth = r * 0.045;
      for (let i = -6; i <= 6; i++) {
        const off = i * r * 0.3;
        ctx.beginPath();
        ctx.moveTo(off - r, -r);
        ctx.lineTo(off + r, r);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(off - r, r);
        ctx.lineTo(off + r, -r);
        ctx.stroke();
      }
      break;

    case 9: // 멜론 — 그물
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = r * 0.04;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r, i * r * 0.32);
        ctx.quadraticCurveTo(0, i * r * 0.32 + r * 0.22, r, i * r * 0.32);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * r * 0.32, -r);
        ctx.quadraticCurveTo(i * r * 0.32 + r * 0.22, 0, i * r * 0.32, r);
        ctx.stroke();
      }
      break;

    case 10: // 수박 — 줄무늬
      ctx.strokeStyle = "rgba(12,60,25,0.75)";
      ctx.lineWidth = r * 0.13;
      for (let i = -2; i <= 2; i++) {
        const off = i * r * 0.42;
        ctx.beginPath();
        ctx.moveTo(off, -r);
        ctx.quadraticCurveTo(off + r * 0.22, 0, off, r);
        ctx.stroke();
      }
      break;
  }
}

// ── 꼭지 / 잎 ────────────────────────────────────────────────────────
function topper(ctx: CanvasRenderingContext2D, index: number, r: number) {
  switch (index) {
    case 0: // 체리 — 긴 줄기
      ctx.strokeStyle = LEAF_DARK;
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.quadraticCurveTo(r * 0.5, -r * 1.5, r * 0.9, -r * 1.3);
      ctx.stroke();
      break;

    case 1: // 딸기 — 꼭지 잎
      ctx.fillStyle = LEAF;
      for (const a of [-0.9, -0.3, 0.3, 0.9]) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.92, r * 0.16, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;

    case 4: // 감 — 꼭지 위에만 얹히는 네 갈래 꽃받침
      ctx.fillStyle = LEAF_DARK;
      for (const a of [-0.62, -0.21, 0.21, 0.62]) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.82, r * 0.19, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#6b4a24";
      ctx.beginPath();
      ctx.arc(0, -r * 0.92, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 5: // 사과 — 줄기 + 잎
    case 6: // 배
      ctx.strokeStyle = "#7a5230";
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(r * 0.06, -r * 1.22);
      ctx.stroke();
      ctx.fillStyle = LEAF;
      ctx.beginPath();
      ctx.ellipse(r * 0.3, -r * 1.12, r * 0.26, r * 0.13, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 7: // 복숭아 — 잎 하나
      ctx.fillStyle = LEAF;
      ctx.beginPath();
      ctx.ellipse(r * 0.34, -r * 0.98, r * 0.28, r * 0.13, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 8: // 파인애플 — 왕관
      ctx.fillStyle = LEAF;
      for (const [a, len] of [
        [-0.5, 0.5],
        [-0.16, 0.62],
        [0.16, 0.62],
        [0.5, 0.5],
      ] as const) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, -r * 0.9);
        ctx.lineTo(0, -r * (0.9 + len));
        ctx.lineTo(r * 0.12, -r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;

    case 10: // 수박 — 짧은 꼭지
      ctx.strokeStyle = LEAF_DARK;
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.quadraticCurveTo(r * 0.18, -r * 1.18, -r * 0.05, -r * 1.28);
      ctx.stroke();
      break;
  }
}

// 딸기 씨 배치 — 매번 같은 자리에 찍히도록 고정 좌표를 비율로 둔다.
function seedGrid(r: number): [number, number][] {
  const pts: [number, number][] = [
    [-0.42, -0.42],
    [0.12, -0.55],
    [0.5, -0.18],
    [-0.5, 0.1],
    [-0.05, 0.02],
    [0.36, 0.34],
    [-0.28, 0.52],
    [0.08, 0.66],
  ];
  return pts.map(([a, b]) => [a * r, b * r]);
}

function freckles(r: number): [number, number][] {
  const pts: [number, number][] = [
    [-0.35, -0.3],
    [0.2, -0.45],
    [0.45, 0.05],
    [-0.15, 0.25],
    [0.1, 0.55],
    [-0.5, 0.35],
    [0.34, -0.12],
  ];
  return pts.map(([a, b]) => [a * r, b * r]);
}
