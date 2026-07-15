export type AmbientVariant = {
  bass: readonly (number | null)[];
  chime: readonly (number | null)[];
  name: string;
  rootMidi: number;
};

const REST = null;

export const AMBIENT_VARIANTS: readonly AmbientVariant[] = [
  {
    name: "Spree dusk",
    rootMidi: 38,
    bass: [0, REST, 0, REST, 7, REST, 3, REST, 0, REST, 10, REST, 7, REST, 3, REST],
    chime: [12, REST, REST, 19, REST, REST, 15, REST, 12, REST, REST, 22, REST, 19, REST, REST],
  },
  {
    name: "Glass dome",
    rootMidi: 41,
    bass: [0, REST, 7, REST, 0, REST, 5, REST, 8, REST, 7, REST, 3, REST, 5, REST],
    chime: [12, REST, 19, REST, REST, 17, REST, 15, REST, 24, REST, 19, REST, 17, REST, REST],
  },
  {
    name: "Tiergarten rain",
    rootMidi: 36,
    bass: [0, REST, REST, 0, 5, REST, REST, 7, 3, REST, REST, 0, 10, REST, 7, REST],
    chime: [19, REST, 15, REST, 12, REST, REST, 10, REST, 12, REST, 15, REST, 19, REST, REST],
  },
  {
    name: "Parliament nocturne",
    rootMidi: 43,
    bass: [0, REST, 0, REST, 3, REST, 7, REST, 10, REST, 7, REST, 5, REST, 3, REST],
    chime: [12, REST, REST, 15, REST, 19, REST, 22, REST, 19, REST, 17, REST, 15, REST, REST],
  },
  {
    name: "Station glass",
    rootMidi: 40,
    bass: [0, REST, 7, REST, 10, REST, 7, REST, 0, REST, 5, REST, 8, REST, 7, REST],
    chime: [19, REST, 24, REST, REST, 22, REST, 19, REST, 15, REST, 19, REST, 17, REST, REST],
  },
  {
    name: "Carillon after hours",
    rootMidi: 45,
    bass: [0, REST, REST, 7, 5, REST, REST, 3, 0, REST, REST, 10, 7, REST, 5, REST],
    chime: [12, REST, 19, REST, 24, REST, 22, REST, 19, REST, 15, REST, 17, REST, 12, REST],
  },
  {
    name: "Quiet republic",
    rootMidi: 33,
    bass: [0, REST, 0, REST, 7, REST, REST, 5, 3, REST, 10, REST, 7, REST, 5, REST],
    chime: [12, REST, REST, 15, REST, 19, REST, REST, 22, REST, REST, 19, REST, 15, REST, REST],
  },
];

const BPM = 72;
const STEP_SECONDS = 60 / BPM / 4;
const STEPS_PER_VARIANT = 64;

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

function audioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const scope = window as AudioWindow;
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

export function isAmbientAudioSupported(): boolean {
  return audioContextConstructor() !== null;
}

export function midiFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export class AmbientSoundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextStepAt = 0;
  private noise: AudioBuffer | null = null;
  private step = 0;
  private timer: number | null = null;

  async start(): Promise<boolean> {
    if (this.context) {
      return this.resumeWithin(this.context);
    }
    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) {
      return false;
    }
    const context = new AudioContextClass();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.095, context.currentTime + 1.4);
    compressor.threshold.value = -22;
    compressor.knee.value = 14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.3;
    master.connect(compressor).connect(context.destination);
    this.context = context;
    this.master = master;
    this.noise = this.createNoiseBuffer(context);
    this.step = 0;
    this.nextStepAt = context.currentTime + 0.08;
    if (!(await this.resumeWithin(context))) {
      return false;
    }
    this.scheduleAhead();
    this.timer = window.setInterval(() => this.scheduleAhead(), 70);
    return true;
  }

  private resumeWithin(context: AudioContext): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (resumed: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        resolve(resumed);
      };
      const timer = window.setTimeout(() => finish(false), 1_500);
      void context.resume().then(
        () => finish(context.state === "running"),
        () => finish(false),
      );
    });
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const context = this.context;
    const master = this.master;
    this.context = null;
    this.master = null;
    this.noise = null;
    if (!context || !master) {
      return;
    }
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    window.setTimeout(() => void context.close(), 220);
  }

  async setSuspended(suspended: boolean): Promise<void> {
    if (!this.context) {
      return;
    }
    if (suspended) {
      await this.context.suspend();
    } else {
      await this.context.resume();
    }
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.ceil(context.sampleRate * 0.05);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const values = buffer.getChannelData(0);
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private scheduleAhead(): void {
    const context = this.context;
    if (!context || !this.master || context.state === "closed") {
      return;
    }
    while (this.nextStepAt < context.currentTime + 0.28) {
      this.scheduleStep(context, this.nextStepAt, this.step);
      this.nextStepAt += STEP_SECONDS;
      this.step += 1;
    }
  }

  private scheduleStep(context: AudioContext, at: number, step: number): void {
    const variant =
      AMBIENT_VARIANTS[
        Math.floor(step / STEPS_PER_VARIANT) % AMBIENT_VARIANTS.length
      ];
    const patternStep = step % variant.bass.length;
    const bassInterval = variant.bass[patternStep];
    if (bassInterval !== null) {
      this.scheduleBass(context, at, variant.rootMidi + bassInterval);
    }
    const chimeInterval = variant.chime[patternStep];
    if (chimeInterval !== null && step % 2 === 0) {
      this.scheduleChime(context, at, variant.rootMidi + chimeInterval);
    }
    if (step % 2 === 1) {
      this.scheduleHat(context, at, step % 4 === 3 ? 0.012 : 0.007);
    }
    if (step % 16 === 0) {
      this.scheduleDrone(context, at, variant.rootMidi - 12);
    }
  }

  private scheduleBass(context: AudioContext, at: number, midi: number): void {
    if (!this.master) {
      return;
    }
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(midiFrequency(midi), at);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(340, at);
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.11, at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + STEP_SECONDS * 1.7);
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + STEP_SECONDS * 1.8);
  }

  private scheduleChime(context: AudioContext, at: number, midi: number): void {
    if (!this.master) {
      return;
    }
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.028, at + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.25);
    gain.connect(this.master);
    for (const [type, ratio, level] of [
      ["square", 1, 0.34],
      ["sine", 2.01, 0.22],
    ] as const) {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(midiFrequency(midi) * ratio, at);
      partial.gain.value = level;
      oscillator.connect(partial).connect(gain);
      oscillator.start(at);
      oscillator.stop(at + 1.3);
    }
  }

  private scheduleHat(context: AudioContext, at: number, level: number): void {
    if (!this.master || !this.noise) {
      return;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noise;
    filter.type = "highpass";
    filter.frequency.value = 6_800;
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(at);
    source.stop(at + 0.05);
  }

  private scheduleDrone(context: AudioContext, at: number, midi: number): void {
    if (!this.master) {
      return;
    }
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.024, at + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 3.1);
    gain.connect(this.master);
    for (const ratio of [1, 1.5]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(midiFrequency(midi) * ratio, at);
      oscillator.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + 3.2);
    }
  }
}
