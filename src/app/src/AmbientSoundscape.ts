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

// The percussive beat used to fire on every odd step (eight hits per
// sixteen-step bar). v0.5.6 halves that cadence — one swell every four
// steps — so the beat breathes instead of ticking.
export const BEAT_INTERVAL_STEPS = 4;

/**
 * True on the steps that carry the deep swell beat. Firing once per four
 * steps is exactly half the old every-other-step cadence.
 */
export function shouldScheduleBeat(step: number): boolean {
  return step % BEAT_INTERVAL_STEPS === 2;
}

/**
 * The beat sits two octaves below the variant root so it reads as a low,
 * felt swell rather than a bright tick.
 */
export function beatMidi(rootMidi: number): number {
  return rootMidi - 24;
}

export type EnvelopeStage = {
  ramp: "set" | "linear";
  time: number;
  value: number;
};

/**
 * A click-free gain contour: it is pinned to 0 at `at` with a hard
 * `set`, ramps linearly up to `peak`, holds, then ramps linearly back to
 * exactly 0. Because it both starts and ends at 0 with non-zero attack
 * and release, oscillators can start/stop against it without the DC step
 * that causes the tick/knack. Linear ramps (not exponential) are used so
 * the tail truly reaches 0 rather than an audible 0.0001 floor.
 */
export function attackReleaseEnvelope(
  at: number,
  peak: number,
  attack: number,
  sustain: number,
  release: number,
): EnvelopeStage[] {
  return [
    { ramp: "set", time: at, value: 0 },
    { ramp: "linear", time: at + attack, value: peak },
    { ramp: "linear", time: at + attack + sustain, value: peak },
    { ramp: "linear", time: at + attack + sustain + release, value: 0 },
  ];
}

/**
 * Symmetric crescendo→decrescendo swell for the beat: it rises across the
 * first half and falls across the second, with no flat/percussive attack.
 */
export function swellEnvelope(
  at: number,
  peak: number,
  duration: number,
): EnvelopeStage[] {
  const half = duration / 2;
  return attackReleaseEnvelope(at, peak, half, 0, half);
}

function applyEnvelope(param: AudioParam, stages: readonly EnvelopeStage[]): void {
  for (const stage of stages) {
    if (stage.ramp === "set") {
      param.setValueAtTime(stage.value, stage.time);
    } else {
      param.linearRampToValueAtTime(stage.value, stage.time);
    }
  }
}

function envelopeEnd(stages: readonly EnvelopeStage[]): number {
  return stages[stages.length - 1]?.time ?? 0;
}

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
    // Ramp the master gain up from a true 0 with a linear fade-in so the
    // very first sample is silent — no start-up thump.
    master.gain.setValueAtTime(0, context.currentTime);
    master.gain.linearRampToValueAtTime(0.095, context.currentTime + 1.4);
    compressor.threshold.value = -22;
    compressor.knee.value = 14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.3;
    master.connect(compressor).connect(context.destination);
    this.context = context;
    this.master = master;
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
    if (!context || !master) {
      return;
    }
    const now = context.currentTime;
    // Linear fade to a true 0 before closing so the context never stops
    // on a non-zero sample (the classic shutdown click).
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0, master.gain.value), now);
    master.gain.linearRampToValueAtTime(0, now + 0.2);
    window.setTimeout(() => void context.close(), 240);
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
    if (shouldScheduleBeat(step)) {
      this.scheduleBeat(context, at, beatMidi(variant.rootMidi));
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
    const envelope = attackReleaseEnvelope(
      at,
      0.11,
      0.03,
      STEP_SECONDS * 0.9,
      STEP_SECONDS * 0.9,
    );
    applyEnvelope(gain.gain, envelope);
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start(at);
    oscillator.stop(envelopeEnd(envelope) + 0.02);
  }

  private scheduleChime(context: AudioContext, at: number, midi: number): void {
    if (!this.master) {
      return;
    }
    const gain = context.createGain();
    const envelope = attackReleaseEnvelope(at, 0.028, 0.05, 0.15, 1.05);
    applyEnvelope(gain.gain, envelope);
    gain.connect(this.master);
    const stopAt = envelopeEnd(envelope) + 0.02;
    for (const [type, ratio, level] of [
      ["square", 1, 0.34],
      ["sine", 2.01, 0.22],
    ] as const) {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(midiFrequency(midi) * ratio, at);
      // Ramp the partial in from 0 rather than snapping to `level`, so the
      // oscillator never starts on a hard amplitude step.
      partial.gain.setValueAtTime(0, at);
      partial.gain.linearRampToValueAtTime(level, at + 0.05);
      oscillator.connect(partial).connect(gain);
      oscillator.start(at);
      oscillator.stop(stopAt);
    }
  }

  /**
   * The v0.5.6 beat: a deep, tuned swell (crescendo→decrescendo) that
   * replaces the bright percussive hi-hat. It fires half as often as the
   * old hat and sits two octaves below the variant root.
   */
  private scheduleBeat(context: AudioContext, at: number, midi: number): void {
    if (!this.master) {
      return;
    }
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220, at);
    filter.Q.value = 0.6;
    const duration = STEP_SECONDS * 3.2;
    const envelope = swellEnvelope(at, 0.13, duration);
    applyEnvelope(gain.gain, envelope);
    filter.connect(gain).connect(this.master);
    const stopAt = envelopeEnd(envelope) + 0.03;
    for (const [type, ratio, level] of [
      ["sine", 1, 1],
      ["triangle", 2, 0.32],
    ] as const) {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(midiFrequency(midi) * ratio, at);
      partial.gain.setValueAtTime(0, at);
      partial.gain.linearRampToValueAtTime(level, at + duration * 0.1);
      oscillator.connect(partial).connect(filter);
      oscillator.start(at);
      oscillator.stop(stopAt);
    }
  }

  private scheduleDrone(context: AudioContext, at: number, midi: number): void {
    if (!this.master) {
      return;
    }
    const gain = context.createGain();
    const envelope = attackReleaseEnvelope(at, 0.024, 0.5, 0.6, 2);
    applyEnvelope(gain.gain, envelope);
    gain.connect(this.master);
    const stopAt = envelopeEnd(envelope) + 0.03;
    for (const ratio of [1, 1.5]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(midiFrequency(midi) * ratio, at);
      oscillator.connect(gain);
      oscillator.start(at);
      oscillator.stop(stopAt);
    }
  }
}
