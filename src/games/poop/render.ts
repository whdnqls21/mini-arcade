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
  drawStick(ctx, s.px, s.dir, s.runPhase, s.dead);
}

function drawStick(
  ctx: CanvasRenderingContext2D,
  px: number,
  dir: number,
  phase: number,
  dead: boolean
): void {
  const feetTop = GROUND - PLAYER_H;
  const col = dead ? "#ff6b6b" : "#e8edf2";
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const moving = dir !== 0 && !dead;
  const sw = moving ? Math.sin(phase) : 0; // 스윙(-1~1)
  const lean = dir * 2; // 이동 방향으로 살짝 기울임

  const headR = 4.5; // 얼굴 작게
  const headCy = feetTop + headR;
  const neckY = feetTop + 2 * headR; // 머리 아래
  const shoulderY = neckY + 2;
  const hipY = feetTop + 26;
  const footY = GROUND; // 다리 길게(hip→foot ~20)

  // 머리
  ctx.beginPath();
  ctx.arc(px + lean, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // 몸통 (살짝 기울임)
  ctx.beginPath();
  ctx.moveTo(px + lean, neckY);
  ctx.lineTo(px, hipY);
  ctx.stroke();

  // 팔 (길게, 달릴 때 앞뒤로 스윙)
  const armSwing = sw * 7;
  ctx.beginPath();
  ctx.moveTo(px + lean, shoulderY);
  ctx.lineTo(px - 11, shoulderY + 11 - armSwing);
  ctx.moveTo(px + lean, shoulderY);
  ctx.lineTo(px + 11, shoulderY + 11 + armSwing);
  ctx.stroke();

  // 다리 (길게, 달릴 때 성큼성큼 벌어짐 / 멈추면 어깨너비 스탠스)
  const spread = moving ? sw * 11 : 6.5;
  ctx.beginPath();
  ctx.moveTo(px, hipY);
  ctx.lineTo(px - spread, footY);
  ctx.moveTo(px, hipY);
  ctx.lineTo(px + spread, footY);
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
