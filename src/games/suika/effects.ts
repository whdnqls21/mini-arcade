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
// 단계가 올라갈수록 높은 음. 짧은 사인파 하나면 충분하다.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  // 모바일은 사용자 제스처 이후에야 재생이 풀린다.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function playMergeSound(index: number, muted: boolean): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  // 단계별로 반음씩 올려 음이 쌓이는 느낌을 준다.
  osc.frequency.value = 320 * Math.pow(2, index / 12);
  osc.type = "sine";
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.22);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.24);
}

export function playDropSound(muted: boolean): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.value = 180;
  osc.type = "triangle";
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.12);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.14);
}
