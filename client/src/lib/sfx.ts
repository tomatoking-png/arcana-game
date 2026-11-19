/**
 * Tiny synthesized sound kit (Web Audio). Every sound is generated in code,
 * so there are no licensing concerns. Audio stays silent until the browser
 * allows playback (first user gesture) and whenever the player mutes it.
 */
type SfxName = 'hover' | 'select' | 'draw' | 'play' | 'special' | 'uno' | 'victory' | 'error' | 'turn' | 'click';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Call from a user gesture to unlock audio. */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export const audioReady = () => !!ctx && ctx.state === 'running';

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, glideTo?: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master!);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, vol: number, from: number, to: number) {
  const c = ctx!;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(from, start);
  f.frequency.exponentialRampToValueAtTime(to, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start);
}

let lastHover = 0;

export function sfx(name: SfxName) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.005;
  switch (name) {
    case 'hover': {
      if (performance.now() - lastHover < 60) return;
      lastHover = performance.now();
      tone(1320, t, 0.06, 'sine', 0.03);
      break;
    }
    case 'click':
      tone(660, t, 0.07, 'triangle', 0.08, 880);
      break;
    case 'select':
      tone(880, t, 0.09, 'triangle', 0.08, 1175);
      break;
    case 'draw':
      noise(t, 0.18, 0.25, 900, 3200);
      tone(523, t + 0.06, 0.12, 'sine', 0.06, 784);
      break;
    case 'play':
      noise(t, 0.12, 0.3, 2400, 600);
      tone(196, t + 0.08, 0.14, 'sine', 0.18, 140);
      tone(1568, t + 0.1, 0.25, 'sine', 0.05);
      break;
    case 'special':
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.055, 0.22, 'sine', 0.07));
      break;
    case 'uno':
      [523, 659, 784, 1047].forEach((f) => tone(f, t, 0.5, 'triangle', 0.07));
      [1568, 2093].forEach((f, i) => tone(f, t + 0.12 + i * 0.08, 0.35, 'sine', 0.05));
      break;
    case 'victory':
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.13, 0.4, 'triangle', 0.08));
      break;
    case 'turn':
      tone(988, t, 0.18, 'sine', 0.06);
      tone(1319, t + 0.09, 0.22, 'sine', 0.05);
      break;
    case 'error':
      tone(220, t, 0.16, 'triangle', 0.1, 170);
      break;
  }
}
