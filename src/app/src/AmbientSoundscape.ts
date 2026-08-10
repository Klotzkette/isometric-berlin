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

// v0.39.0: "noch zu unruhig und ein bisschen zu schnell — langsamer, mehr
// Tiefe und mehr Hall." 72 → 54 BPM is a 25 % slowdown; because every
// envelope length is derived from STEP_SECONDS, the notes also get
// proportionally longer rather than leaving gaps.
export const AMBIENT_BPM = 54;
const STEP_SECONDS = 60 / AMBIENT_BPM / 4;
const STEPS_PER_VARIANT = 64;
// Leaves shared headroom for the optional 0.03 Dusk Republic layer.
export const AMBIENT_MASTER_GAIN = 0.07;
/** Short click-free attack so a permitted first gesture sounds immediate. */
export const AMBIENT_START_FADE_SECONDS = 0.18;
export const AMBIENT_START_DELAY_SECONDS = 0.015;

/**
 * Downward transposition of the whole soundscape ("mehr Tiefe"). A perfect
 * fourth moves every voice into a darker register without changing any
 * interval, so the seven variants keep their character and their distinct
 * roots — only the pitch centre drops.
 */
export const AMBIENT_TRANSPOSE_SEMITONES = -5;

// Diffuse convolution tail. A four-second decay is long enough to read as a
// hall rather than a room, which is what carries the "mehr Hall" request; the
// dry/wet split keeps the note attacks legible instead of washing them out.
export const AMBIENT_REVERB_SECONDS = 4.2;
export const AMBIENT_REVERB_DECAY = 2.6;
export const AMBIENT_REVERB_WET = 0.52;

// The swell used to fire every four steps. v0.39.0 halves that again — one
// swell per eight steps — because at 54 BPM the old cadence still read as a
// pulse ("zu unruhig") rather than as breathing.
export const BEAT_INTERVAL_STEPS = 8;

/**
 * True on the steps that carry the deep swell beat.
 */
export function shouldScheduleBeat(step: number): boolean {
  return step % BEAT_INTERVAL_STEPS === 2;
}

// Event density: the chime used to be allowed on every second step and the
// drone every sixteen. Thinning both is the other half of "weniger dichte
// Ereignisfolge" — the patterns themselves are untouched, they are just
// sampled more sparsely.
export const CHIME_INTERVAL_STEPS = 4;
export const DRONE_INTERVAL_STEPS = 32;

/**
 * Build a diffuse exponential-decay impulse response for the hall reverb.
 * Generated rather than shipped as a file: an audio asset would be a binary
 * blob in the repo, and a noise tail with an exponential envelope is exactly
 * what a small convolution hall needs.
 */
export function createReverbImpulse(
  context: BaseAudioContext,
  seconds = AMBIENT_REVERB_SECONDS,
  decay = AMBIENT_REVERB_DECAY,
): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * Math.max(0.05, seconds)));
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const t = index / length;
      data[index] = (Math.random() * 2 - 1) * (1 - t) ** decay;
    }
  }
  return buffer;
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
  private activeSources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private closeTimer: number | null = null;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextStepAt = 0;
  private resumeAfterSuspension = false;
  private startGeneration = 0;
  private startPromise: Promise<boolean> | null = null;
  private step = 0;
  private timer: number | null = null;

  /**
   * Whether the layer is actually reaching the speakers.
   *
   * A scheduler armed over a suspended context is silence, so the toggle
   * must not read it as sound.
   */
  get audible(): boolean {
    return this.timer !== null && this.context?.state === "running";
  }

  get activeVoiceCount(): number {
    return this.activeSources.size;
  }

  /**
   * Construct the suspended graph and its generated impulse before a gesture.
   * There is no media file to decode here: the procedural buffers are the
   * assets, and Web Audio keeps the new context suspended until a gesture.
   */
  prepare(): boolean {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (this.context && this.master && this.context.state !== "closed") {
      return true;
    }
    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) {
      return false;
    }
    const context = new AudioContextClass();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    // Start silent. `start` applies the short gain ramp only after a browser
    // has permitted resume, so graph preparation itself can never autoplay.
    master.gain.setValueAtTime(0, context.currentTime);
    compressor.threshold.value = -22;
    compressor.knee.value = 14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.3;
    // Parallel dry/wet hall. The ConvolverNode normalises its impulse
    // response, so the wet path does not raise the overall level and the
    // AMBIENT_MASTER_GAIN headroom contract still holds.
    const dry = context.createGain();
    const wet = context.createGain();
    const reverb = context.createConvolver();
    reverb.buffer = createReverbImpulse(context);
    dry.gain.value = 1 - AMBIENT_REVERB_WET;
    wet.gain.value = AMBIENT_REVERB_WET;
    master.connect(dry).connect(compressor);
    master.connect(reverb).connect(wet).connect(compressor);
    compressor.connect(context.destination);
    this.context = context;
    this.master = master;
    this.step = 0;
    this.nextStepAt = context.currentTime + AMBIENT_START_DELAY_SECONDS;
    return true;
  }

  async start(): Promise<boolean> {
    if (this.timer !== null) {
      if (this.context?.state === "running") {
        return true;
      }
      // Safari/iOS and power-saving browsers can suspend an AudioContext
      // without dispatching a page lifecycle event. The scheduler survives,
      // so treating its timer as proof of playback makes every later click a
      // false success over silence. Retire that stale schedule and let this
      // user gesture reach resume() synchronously below.
      this.clearScheduler();
      this.stopActiveSources(this.context?.currentTime ?? 0, true);
    }
    // A load-time resume can remain pending while the browser waits for a
    // gesture. Never return that stale promise from the real click: starting a
    // new generation reaches `resume()` synchronously in the gesture and lets
    // the latest attempt own the scheduler.
    const generation = ++this.startGeneration;
    const pending = this.startInternal(generation);
    this.startPromise = pending;
    try {
      return await pending;
    } finally {
      if (this.startPromise === pending) {
        this.startPromise = null;
      }
    }
  }

  private async startInternal(generation: number): Promise<boolean> {
    if (!this.prepare()) {
      return false;
    }
    const context = this.context;
    const master = this.master;
    if (!context || !master || !(await this.resumeWithin(context))) {
      return false;
    }
    if (
      generation !== this.startGeneration ||
      context !== this.context ||
      master !== this.master
    ) {
      return false;
    }
    this.resumeAfterSuspension = false;
    this.armScheduler(context, master);
    return true;
  }

  private armScheduler(context: AudioContext, master: GainNode): void {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(
      Math.max(0, master.gain.value),
      context.currentTime,
    );
    master.gain.linearRampToValueAtTime(
      AMBIENT_MASTER_GAIN,
      context.currentTime + AMBIENT_START_FADE_SECONDS,
    );
    this.nextStepAt = context.currentTime + AMBIENT_START_DELAY_SECONDS;
    this.scheduleAhead();
    this.timer = window.setInterval(() => this.scheduleAhead(), 70);
  }

  private resumeWithin(context: AudioContext): Promise<boolean> {
    if (context.state === "running") {
      return Promise.resolve(true);
    }
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
      try {
        void context.resume().then(
          () => finish(context.state === "running"),
          () => finish(false),
        );
      } catch {
        finish(false);
      }
    });
  }

  stop(): void {
    this.startGeneration += 1;
    this.resumeAfterSuspension = false;
    this.clearScheduler();
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }
    const now = context.currentTime;
    // Linear fade to a true 0 before closing so the context never stops
    // on a non-zero sample (the classic shutdown click).
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0, master.gain.value), now);
    master.gain.linearRampToValueAtTime(0, now + 0.2);
    this.stopActiveSources(now + 0.22, false);
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
    }
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;
      if (this.context === context) {
        this.context = null;
        this.master = null;
      }
      this.stopActiveSources(context.currentTime, true);
      if (context.state !== "closed") {
        void context.close().catch(() => undefined);
      }
    }, 240);
  }

  /** Close synchronously enough for pagehide/beforeunload to silence the tab. */
  dispose(): void {
    this.startGeneration += 1;
    this.startPromise = null;
    this.resumeAfterSuspension = false;
    this.clearScheduler();
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    const context = this.context;
    const master = this.master;
    this.context = null;
    this.master = null;
    this.stopActiveSources(context?.currentTime ?? 0, true);
    if (!context) {
      return;
    }
    if (master) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
    }
    if (context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  async setSuspended(suspended: boolean): Promise<boolean> {
    const context = this.context;
    const master = this.master;
    if (!context || !master || context.state === "closed") {
      return false;
    }
    try {
      if (suspended) {
        // Only sound that was genuinely running may return automatically.
        // A browser-blocked/pending autoplay attempt must wait for a fresh
        // gesture after the page becomes visible again.
        this.resumeAfterSuspension ||= this.timer !== null;
        this.startGeneration += 1;
        this.clearScheduler();
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0, context.currentTime);
        this.stopActiveSources(context.currentTime, true);
        if (context.state === "running") {
          await context.suspend();
        }
        return true;
      }
      if (!this.resumeAfterSuspension) {
        return false;
      }
      this.resumeAfterSuspension = false;
      const generation = ++this.startGeneration;
      if (!(await this.resumeWithin(context))) {
        return false;
      }
      if (
        generation !== this.startGeneration ||
        context !== this.context ||
        master !== this.master
      ) {
        return false;
      }
      this.armScheduler(context, master);
      return true;
    } catch {
      return false;
    }
  }

  private clearScheduler(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scheduleAhead(): void {
    const context = this.context;
    if (!context || !this.master || context.state !== "running") {
      return;
    }
    // Catch-up clamp: after interval throttling (background tab) we
    // resume from "now" instead of scheduling thousands of past-due
    // oscillator nodes in one tick.
    if (this.nextStepAt < context.currentTime - STEP_SECONDS) {
      this.nextStepAt = context.currentTime;
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
    const root = variant.rootMidi + AMBIENT_TRANSPOSE_SEMITONES;
    const bassInterval = variant.bass[patternStep];
    if (bassInterval !== null) {
      this.scheduleBass(context, at, root + bassInterval);
    }
    const chimeInterval = variant.chime[patternStep];
    if (chimeInterval !== null && step % CHIME_INTERVAL_STEPS === 0) {
      this.scheduleChime(context, at, root + chimeInterval);
    }
    if (shouldScheduleBeat(step)) {
      this.scheduleBeat(context, at, beatMidi(root));
    }
    if (step % DRONE_INTERVAL_STEPS === 0) {
      this.scheduleDrone(context, at, root - 12);
    }
  }

  private scheduleBass(context: AudioContext, at: number, midi: number): void {
    if (!this.master) {
      return;
    }
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(340, at);
    filter.Q.value = 0.7;
    // A longer attack than the old 0.03 s: at 54 BPM the note has room to
    // swell in, and a soft entry is what makes the bass read as weight rather
    // than as a pluck.
    const envelope = attackReleaseEnvelope(
      at,
      0.12,
      0.14,
      STEP_SECONDS * 0.9,
      STEP_SECONDS * 1.4,
    );
    applyEnvelope(gain.gain, envelope);
    filter.connect(gain).connect(this.master);
    const stopAt = envelopeEnd(envelope) + 0.02;
    // The sub-octave sine is the "mehr Bassgewicht" half: it adds body an
    // octave below without muddying the triangle's fundamental.
    for (const [type, ratio, level] of [
      ["triangle", 1, 1],
      ["sine", 0.5, 0.6],
    ] as const) {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(midiFrequency(midi) * ratio, at);
      partial.gain.setValueAtTime(0, at);
      partial.gain.linearRampToValueAtTime(level, at + 0.14);
      oscillator.connect(partial).connect(filter);
      oscillator.start(at);
      oscillator.stop(stopAt);
      this.trackSource(oscillator, [partial]);
    }
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
      this.trackSource(oscillator, [partial]);
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
      this.trackSource(oscillator, [partial]);
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
      this.trackSource(oscillator, []);
    }
  }

  private stopActiveSources(at: number, disconnect: boolean): void {
    for (const [source, nodes] of this.activeSources) {
      try {
        source.stop(at);
      } catch {
        // A source that already ended has already left the audible graph.
      }
      if (!disconnect) {
        continue;
      }
      source.onended = null;
      try {
        source.disconnect();
      } catch {
        // Disconnect is best-effort during AudioContext shutdown.
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // The node may already be detached by context shutdown.
        }
      }
    }
    if (disconnect) {
      this.activeSources.clear();
    }
  }

  private trackSource(
    source: AudioScheduledSourceNode,
    nodes: AudioNode[],
  ): void {
    this.activeSources.set(source, nodes);
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // Disconnect is best-effort during AudioContext shutdown.
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // The node may already be detached by context shutdown.
        }
      }
      this.activeSources.delete(source);
    };
  }
}
