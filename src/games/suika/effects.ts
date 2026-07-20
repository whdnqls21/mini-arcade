// 합체 연출 — 파티클과 효과음. 외부 에셋 없이 캔버스와 WebAudio 로만 만든다.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number; // 남은 수명 0~1
  color: string;
}

// 합쳐진 자리에서 사방으로 튀는 조각들
export function burst(x: number, y: number, color: string, radius: number): Particle[] {
  const count = Math.min(18, 6 + Math.round(radius / 4));
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 1.2 + Math.random() * 2.2;
    out.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.8,
      r: 2 + Math.random() * (radius / 12),
      life: 1,
      color,
    });
  }
  return out;
}

// dt 는 60fps 기준 배율(1 = 16.7ms). 수명이 다한 조각은 걸러서 돌려준다.
export function stepParticles(list: Particle[], dt: number): Particle[] {
  const out: Particle[] = [];
  for (const p of list) {
    p.vy += 0.18 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= 0.035 * dt;
    if (p.life > 0) out.push(p);
  }
  return out;
}

// ── 효과음 ──────────────────────────────────────────────────────────
// 합성 오디오는 공용 모듈(games/sound.ts)로 옮겼다. 여기선 수박게임용 래퍼만 둔다.

import { semitone, tone } from "@/games/sound";

// 단계가 올라갈수록 높은 음 — 합칠수록 음이 쌓이는 느낌.
export function playMergeSound(index: number): void {
  tone({ freq: semitone(320, index), type: "sine", gain: 0.18, dur: 0.22 });
}

// 과일을 떨어뜨릴 때 낮은 "톡".
export function playDropSound(): void {
  tone({ freq: 180, type: "triangle", gain: 0.08, dur: 0.12 });
}
