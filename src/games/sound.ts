// 게임 공용 효과음 — 오디오 파일 없이 WebAudio 로 합성한다(에셋 0).
// 앱 전체가 코드로 그림·소리를 만드는 방식과 일관되게 유지한다.
// 음소거는 기기 볼륨/무음 스위치를 따르므로 앱 안에 토글을 두지 않는다.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  dur?: number; // 초
  type?: Wave;
  gain?: number; // 최대 음량 0~1
  delay?: number; // 시작 지연(초)
  glideTo?: number; // 끝 주파수(있으면 미끄러진다)
}

// 짧은 한 음. 모든 효과음의 기본 벽돌.
export function tone({ freq, dur = 0.14, type = "sine", gain = 0.16, delay = 0, glideTo }: ToneOpts): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  // 아주 작은 값에서 시작해야 exponentialRamp 가 동작하고 클릭음이 안 난다.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// 여러 음을 순서대로 — 팡파레·상승음 등에 쓴다.
export function sequence(notes: Omit<ToneOpts, "delay">[], step = 0.09): void {
  notes.forEach((n, i) => tone({ ...n, delay: i * step }));
}

// 노이즈 버스트 — 착지·충돌 같은 둔탁한 소리.
export function thud(gain = 0.2, dur = 0.16): void {
  const ac = audio();
  if (!ac) return;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // 뒤로 갈수록 잦아드는 노이즈
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  // 저역만 남겨 "퍽" 느낌
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  src.connect(lp).connect(g).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + dur + 0.02);
}

// 반음 계단 — index 로 음높이를 올린다(도레미…).
export const semitone = (base: number, steps: number) => base * Math.pow(2, steps / 12);

// 카운트다운 초읽기 틱 — 제한 시간 게임의 마지막 몇 초에 초마다 울린다.
// final(마지막 1초)은 더 높고 길게 내 긴장감을 준다.
export function tick(final = false): void {
  if (final) {
    tone({ freq: 1320, type: "square", gain: 0.12, dur: 0.2 });
  } else {
    tone({ freq: 880, type: "square", gain: 0.1, dur: 0.06 });
  }
}
