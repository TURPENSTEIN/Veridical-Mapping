let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

const WAVE_TYPES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];

export function freqFromNorm(n: number): number {
  const min = 80;
  const max = 1200;
  return min * Math.pow(max / min, n);
}

export function waveFromNorm(n: number): OscillatorType {
  const idx = Math.min(3, Math.floor(n * 4));
  return WAVE_TYPES[idx];
}

export function playTone(
  pitchNorm: number,
  durationNorm: number,
  timbreNorm: number = 0,
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getCtx();
    const freq = freqFromNorm(pitchNorm);
    const duration = 200 + durationNorm * 1600;
    const wave = waveFromNorm(timbreNorm);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = wave;
    osc.frequency.value = freq;

    const now = ctx.currentTime;
    const attack = 0.01;
    const release = 0.08;
    const durSec = duration / 1000;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + attack);
    gain.gain.setValueAtTime(0.25, now + durSec - release);
    gain.gain.linearRampToValueAtTime(0, now + durSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durSec + 0.05);

    osc.onended = () => resolve();
  });
}

export function playTempo(
  tempoNorm: number,
  intervalNorm: number,
  pulses: number = 4,
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getCtx();
    const bpm = 60 + tempoNorm * 180;
    const intervalMs = 300 + intervalNorm * 1700;
    const beatSec = 60 / bpm;
    const intervalSec = intervalMs / 1000;
    const useInterval = Math.max(beatSec, intervalSec);
    const totalSec = useInterval * pulses + 0.1;

    for (let i = 0; i < pulses; i++) {
      const t = ctx.currentTime + i * useInterval;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
      gain.gain.linearRampToValueAtTime(0, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    }

    setTimeout(() => resolve(), totalSec * 1000);
  });
}

export function playClick(): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.003);
  gain.gain.linearRampToValueAtTime(0, now + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

export function playFeedbackTone(correct: boolean): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const now = ctx.currentTime;
  if (correct) {
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.linearRampToValueAtTime(784, now + 0.12);
  } else {
    osc.frequency.setValueAtTime(311, now);
    osc.frequency.linearRampToValueAtTime(207, now + 0.15);
  }
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function resumeAudio(): void {
  getCtx();
}
