// 똥 피하기 화면 — 졸라맨과 떨어지는 똥을 캔버스에 그린다.
import { GROUND, H, PLAYER_H, W, type PoopState } from "./logic";

export function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  s: PoopState
): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (rect.width * dpr) / W;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // 바닥선
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 2);
  ctx.lineTo(W, GROUND + 2);
  ctx.stroke();

  for (const p of s.poops) drawPoop(ctx, p.x, p.y, p.r);
  drawStick(ctx, s.px, s.dead);
}

function drawStick(ctx: CanvasRenderingContext2D, px: number, dead: boolean): void {
  const feetTop = GROUND - PLAYER_H;
  const col = dead ? "#ff6b6b" : "#e8edf2";
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const headR = 6;
  const headY = feetTop + headR;
  const neck = headY + headR;
  const hip = feetTop + 30;

  // 머리
  ctx.beginPath();
  ctx.arc(px, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // 몸통
  ctx.beginPath();
  ctx.moveTo(px, neck);
  ctx.lineTo(px, hip);
  ctx.stroke();
  // 팔 (만세 — 똥을 막는 느낌)
  ctx.beginPath();
  ctx.moveTo(px, neck + 3);
  ctx.lineTo(px - 9, neck - 4);
  ctx.moveTo(px, neck + 3);
  ctx.lineTo(px + 9, neck - 4);
  ctx.stroke();
  // 다리
  ctx.beginPath();
  ctx.moveTo(px, hip);
  ctx.lineTo(px - 8, GROUND);
  ctx.moveTo(px, hip);
  ctx.lineTo(px + 8, GROUND);
  ctx.stroke();
}

function drawPoop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);

  const ell = (cy: number, rx: number, ry: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  // 아래→위로 쌓인 몽글이(소프트콘 모양)
  ell(r * 0.5, r, r * 0.62, "#6f4a28");
  ell(-r * 0.02, r * 0.72, r * 0.5, "#805632");
  ell(-r * 0.5, r * 0.42, r * 0.4, "#8f6038");

  // 눈
  const eyeY = r * 0.05;
  ctx.fillStyle = "#fff";
  circle(ctx, -r * 0.3, eyeY, r * 0.17);
  circle(ctx, r * 0.3, eyeY, r * 0.17);
  ctx.fillStyle = "#1a1310";
  circle(ctx, -r * 0.3, eyeY + r * 0.02, r * 0.08);
  circle(ctx, r * 0.3, eyeY + r * 0.02, r * 0.08);
  // 입
  ctx.strokeStyle = "#1a1310";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, r * 0.34, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
