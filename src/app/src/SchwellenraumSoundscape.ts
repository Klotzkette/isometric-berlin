/**
 * A quiet, self-contained procedural sound layer for Schwellenraum.
 *
 * The graph deliberately has two independently faded buses:
 *
 * - `room` is a low, soft air bed with occasional close rustles;
 * - `score` is a sparse sequence of slow harmonic fields and dim glints.
 *
 * Nothing is downloaded or decoded. Every buffer is generated from a fixed
 * seed, so the texture is reproducible, attribution-free and available in an
 * offline build. The master ceiling and a final dynamics stage keep the layer
 * far behind the interface even when both buses overlap.
 */

export type SchwellenraumMix = Readonly<{
  room: boolean;
  score: boolean;
}>;

export type SchwellenraumStepPlan = Readonly<{
  glint: boolean;
  glintMidi: number;
  pad: boolean;
  padRootMidi: number;
  rustle: boolean;
  rustleIndex: number;
}>;

export type ScheduleWindow = Readonly<{
  nextAt: number;
  times: readonly number[];
}>;

export const SCHWELLENRAUM_MASTER_GAIN = 0.04;
export const SCHWELLENRAUM_ROOM_GAIN = 0.64;
export const SCHWELLENRAUM_SCORE_GAIN = 0.44;
export const SCHWELLENRAUM_ENTER_FADE_SECONDS = 2.8;
export const SCHWELLENRAUM_LEAVE_FADE_SECONDS = 2.4;
export const SCHWELLENRAUM_MIX_FADE_SECONDS = 1.6;
export const SCHWELLENRAUM_STEP_SECONDS = 2.4;
export const SCHWELLENRAUM_LOOKAHEAD_SECONDS = 0.52;
export const SCHWELLENRAUM_MAX_STEPS_PER_TICK = 3;

const START_DELAY_SECONDS = 0.045;
const RESUME_FADE_SECONDS = 1.4;
const RUSTLE_BUFFER_SECONDS = 6.2;
const REVERB_SECONDS = 3.4;
const PAD_EVERY_STEPS = 8;
const RUSTLE_EVERY_STEPS = 2;
const GLINT_EVERY_STEPS = 13;

const PAD_ROOTS = [41, 48, 43, 46, 38, 45, 40] as const;
const GLINT_NOTES = [72, 67, 74, 69, 76, 71, 65, 73, 68] as const;

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

type TrackedSource = AudioScheduledSourceNode;

function audioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const scope = window as AudioWindow;
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

export function isSchwellenraumAudioSupported(): boolean {
  return audioContextConstructor() !== null;
}

/** Convert a MIDI note to concert-pitch frequency. */
export function schwellenraumFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Fixed-seed, softly correlated noise for the room bed and reverb tail.
 *
 * Xorshift32 is used because its state is four bytes, has no platform
 * dependency and is quick enough to prepare after the first app-shell paint.
 * The two one-pole stages remove brittle white-noise edges before Web Audio's
 * filters colour the texture further.
 */
export function createSeededSoftNoise(
  length: number,
  seed: number,
): Float32Array<ArrayBuffer> {
  const safeLength = Math.max(0, Math.floor(length));
  const result = new Float32Array(safeLength);
  let state = (seed >>> 0) || 0x6d2b79f5;
  let soft = 0;
  let drift = 0;
  for (let index = 0; index < safeLength; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const white = ((state >>> 0) / 0xffffffff) * 2 - 1;
    soft += (white - soft) * 0.085;
    drift += (soft - drift) * 0.0065;
    result[index] = Math.max(
      -1,
      Math.min(1, white * 0.09 + soft * 0.67 + drift * 0.24),
    );
  }
  return result;
}

/**
 * Ease both ends of a generated texture into one shared sample. A looping
 * BufferSource therefore crosses its boundary without a value discontinuity
 * (and without the periodic click an arbitrary noise splice would create).
 */
export function makeSoftNoiseLoopSafe(
  texture: Float32Array,
  edgeLength: number,
): Float32Array<ArrayBuffer> {
  const result = new Float32Array(texture);
  if (result.length < 2) {
    return result;
  }
  const edge = Math.min(
    Math.max(2, Math.floor(edgeLength)),
    Math.floor(result.length / 2),
  );
  const anchor = (result[0] + result[result.length - 1]) * 0.5;
  for (let offset = 0; offset < edge; offset += 1) {
    const phase = offset / Math.max(1, edge - 1);
    const eased = phase * phase * (3 - 2 * phase);
    const right = result.length - 1 - offset;
    result[offset] = anchor * (1 - eased) + result[offset] * eased;
    result[right] = anchor * (1 - eased) + result[right] * eased;
  }
  return result;
}

/** Deterministic, deliberately sparse event plan for one scheduler step. */
export function schwellenraumStepPlan(step: number): SchwellenraumStepPlan {
  const safeStep = Math.max(0, Math.floor(step));
  const padIndex = Math.floor(safeStep / PAD_EVERY_STEPS);
  const glintIndex = Math.floor(safeStep / GLINT_EVERY_STEPS);
  return {
    glint: safeStep % GLINT_EVERY_STEPS === 5,
    glintMidi: GLINT_NOTES[glintIndex % GLINT_NOTES.length],
    pad: safeStep % PAD_EVERY_STEPS === 0,
    padRootMidi: PAD_ROOTS[padIndex % PAD_ROOTS.length],
    rustle: safeStep % RUSTLE_EVERY_STEPS === 0,
    rustleIndex: Math.floor(safeStep / RUSTLE_EVERY_STEPS),
  };
}

/**
 * Bounded look-ahead planning. A throttled tab resumes from `currentTime`
 * rather than allocating a burst of every event that elapsed while hidden.
 */
export function planSchwellenraumSchedule(
  nextAt: number,
  currentTime: number,
): ScheduleWindow {
  let cursor = Number.isFinite(nextAt) ? nextAt : currentTime;
  if (cursor < currentTime - SCHWELLENRAUM_STEP_SECONDS) {
    cursor = currentTime + START_DELAY_SECONDS;
  }
  const horizon = currentTime + SCHWELLENRAUM_LOOKAHEAD_SECONDS;
  const times: number[] = [];
  while (
    cursor < horizon &&
    times.length < SCHWELLENRAUM_MAX_STEPS_PER_TICK
  ) {
    times.push(cursor);
    cursor += SCHWELLENRAUM_STEP_SECONDS;
  }
  return { nextAt: cursor, times };
}

function applyEnvelope(
  param: AudioParam,
  at: number,
  peak: number,
  attack: number,
  sustain: number,
  release: number,
): number {
  const peakAt = at + attack;
  const releaseAt = peakAt + sustain;
  const endAt = releaseAt + release;
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, peakAt);
  param.linearRampToValueAtTime(peak, releaseAt);
  param.linearRampToValueAtTime(0, endAt);
  return endAt;
}

function holdAndRamp(
  param: AudioParam,
  target: number,
  at: number,
  seconds: number,
): void {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(at);
  } else {
    const current = Number.isFinite(param.value) ? Math.max(0, param.value) : 0;
    param.cancelScheduledValues(at);
    param.setValueAtTime(current, at);
  }
  param.linearRampToValueAtTime(target, at + Math.max(0.02, seconds));
}

function makeRoomBuffer(context: BaseAudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * RUSTLE_BUFFER_SECONDS));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const texture = makeSoftNoiseLoopSafe(
    createSeededSoftNoise(length, 0x8a4f19d3),
    context.sampleRate * 0.38,
  );
  buffer.copyToChannel(texture, 0);
  return buffer;
}

function makeReverbBuffer(context: BaseAudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * REVERB_SECONDS));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  const seeds = [0x19d3a84f, 0xb71c52e9] as const;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = createSeededSoftNoise(length, seeds[channel]);
    for (let index = 0; index < data.length; index += 1) {
      const phase = index / data.length;
      // Keep the first reflection gentle and let the tail disappear fully.
      data[index] *= (1 - Math.exp(-phase * 18)) * (1 - phase) ** 2.8;
    }
    buffer.copyToChannel(data, channel);
  }
  return buffer;
}

/**
 * Two-bus procedural layer. `start()` reaches AudioContext.resume()
 * synchronously before its first await, so it can be used directly by the
 * existing capture-phase first-gesture helper.
 */
export class SchwellenraumSoundscape {
  private activeSources = new Map<TrackedSource, AudioNode[]>();
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private roomBus: GainNode | null = null;
  private scoreBus: GainNode | null = null;
  private roomBuffer: AudioBuffer | null = null;
  private mix: SchwellenraumMix = { room: true, score: true };
  private nextStepAt = 0;
  private playbackRequested = false;
  private resumeAfterSuspension = false;
  private schedulerTimer: number | null = null;
  private startGeneration = 0;
  private step = 0;
  private stopTimer: number | null = null;

  get audible(): boolean {
    return (
      this.playbackRequested &&
      this.schedulerTimer !== null &&
      this.context?.state === "running" &&
      (this.mix.room || this.mix.score)
    );
  }

  get activeVoiceCount(): number {
    return this.activeSources.size;
  }

  get currentMix(): SchwellenraumMix {
    return { ...this.mix };
  }

  /** Build the suspended graph without initiating playback. */
  prepare(): boolean {
    if (
      this.context &&
      this.master &&
      this.roomBus &&
      this.scoreBus &&
      this.roomBuffer &&
      this.context.state !== "closed"
    ) {
      return true;
    }
    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) {
      return false;
    }
    try {
      const context = new AudioContextClass({ latencyHint: "playback" });
      // Assign immediately so any later graph/buffer allocation failure is
      // still closed by the catch path instead of leaking an AudioContext.
      this.context = context;
      const master = context.createGain();
      const roomBus = context.createGain();
      const scoreBus = context.createGain();
      const roomColour = context.createBiquadFilter();
      const scoreColour = context.createBiquadFilter();
      const dry = context.createGain();
      const reverbSend = context.createGain();
      const reverbReturn = context.createGain();
      const reverb = context.createConvolver();
      const outputLowpass = context.createBiquadFilter();
      const limiter = context.createDynamicsCompressor();

      master.gain.setValueAtTime(0, context.currentTime);
      roomBus.gain.setValueAtTime(
        this.mix.room ? SCHWELLENRAUM_ROOM_GAIN : 0,
        context.currentTime,
      );
      scoreBus.gain.setValueAtTime(
        this.mix.score ? SCHWELLENRAUM_SCORE_GAIN : 0,
        context.currentTime,
      );

      roomColour.type = "lowpass";
      roomColour.frequency.value = 2350;
      roomColour.Q.value = 0.42;
      scoreColour.type = "lowpass";
      scoreColour.frequency.value = 3150;
      scoreColour.Q.value = 0.38;
      outputLowpass.type = "lowpass";
      outputLowpass.frequency.value = 4800;
      outputLowpass.Q.value = 0.35;

      // Dry plus a subdued generated tail. Neither path can bypass master.
      dry.gain.value = 0.76;
      reverbSend.gain.value = 0.28;
      reverbReturn.gain.value = 0.34;
      reverb.buffer = makeReverbBuffer(context);

      // A high-ratio, soft-knee final stage catches the rare pad/rustle
      // overlap. The 0.04 master ceiling remains the primary loudness limit.
      limiter.threshold.value = -27;
      limiter.knee.value = 10;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.009;
      limiter.release.value = 0.48;

      roomBus.connect(roomColour);
      scoreBus.connect(scoreColour);
      roomColour.connect(dry);
      scoreColour.connect(dry);
      roomColour.connect(reverbSend);
      scoreColour.connect(reverbSend);
      reverbSend.connect(reverb).connect(reverbReturn);
      dry.connect(master);
      reverbReturn.connect(master);
      master.connect(outputLowpass).connect(limiter).connect(context.destination);

      this.context = context;
      this.master = master;
      this.roomBus = roomBus;
      this.scoreBus = scoreBus;
      this.roomBuffer = makeRoomBuffer(context);
      this.nextStepAt = context.currentTime + START_DELAY_SECONDS;
      this.step = 0;
      return true;
    } catch {
      this.dispose();
      return false;
    }
  }

  async start(): Promise<boolean> {
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.playbackRequested = true;
    if (this.schedulerTimer !== null) {
      if (this.context?.state === "running") {
        return true;
      }
      this.clearScheduler();
      this.stopActiveSources(this.context?.currentTime ?? 0);
    }
    const generation = ++this.startGeneration;
    return this.startInternal(generation, SCHWELLENRAUM_ENTER_FADE_SECONDS);
  }

  private async startInternal(
    generation: number,
    fadeSeconds: number,
  ): Promise<boolean> {
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
      !this.playbackRequested ||
      context !== this.context ||
      master !== this.master
    ) {
      return false;
    }
    this.resumeAfterSuspension = false;
    this.armScheduler(context, master, fadeSeconds);
    return true;
  }

  /** Fade either sub-layer without rebuilding or restarting the piece. */
  setMix(
    mix: SchwellenraumMix,
    fadeSeconds = SCHWELLENRAUM_MIX_FADE_SECONDS,
  ): void {
    this.mix = { room: Boolean(mix.room), score: Boolean(mix.score) };
    const context = this.context;
    if (!context || context.state === "closed") {
      return;
    }
    if (this.roomBus) {
      holdAndRamp(
        this.roomBus.gain,
        this.mix.room ? SCHWELLENRAUM_ROOM_GAIN : 0,
        context.currentTime,
        fadeSeconds,
      );
    }
    if (this.scoreBus) {
      holdAndRamp(
        this.scoreBus.gain,
        this.mix.score ? SCHWELLENRAUM_SCORE_GAIN : 0,
        context.currentTime,
        fadeSeconds,
      );
    }
  }

  /**
   * Fade to silence, retire scheduled voices, then suspend the warm context.
   * Re-entering the mode reuses its deterministic buffers and graph.
   */
  stop(fadeSeconds = SCHWELLENRAUM_LEAVE_FADE_SECONDS): void {
    this.playbackRequested = false;
    this.resumeAfterSuspension = false;
    const generation = ++this.startGeneration;
    this.clearScheduler();
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    const context = this.context;
    const master = this.master;
    if (!context || !master || context.state === "closed") {
      return;
    }
    const seconds = Math.max(0.02, fadeSeconds);
    holdAndRamp(master.gain, 0, context.currentTime, seconds);
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = null;
      if (
        generation !== this.startGeneration ||
        this.playbackRequested ||
        this.context !== context
      ) {
        return;
      }
      this.stopActiveSources(context.currentTime);
      void this.suspendStoppedGeneration(context, master, generation);
    }, Math.ceil((seconds + 0.06) * 1000));
  }

  private async suspendStoppedGeneration(
    context: AudioContext,
    master: GainNode,
    generation: number,
  ): Promise<void> {
    try {
      if (context.state === "running") {
        await context.suspend();
      }
      if (
        generation === this.startGeneration &&
        !this.playbackRequested &&
        context === this.context &&
        master === this.master
      ) {
        return;
      }
      // A rapid re-entry can arm the next generation while the old suspend
      // request is in flight. Resume only that newer live scheduler; another
      // stop, lifecycle pause or dispose keeps it absent and therefore silent.
      if (
        this.playbackRequested &&
        this.schedulerTimer !== null &&
        context === this.context &&
        master === this.master &&
        context.state === "suspended"
      ) {
        await context.resume();
      }
    } catch {
      // A later user gesture can retry a browser-declined resume.
    }
  }

  /** Immediate lifecycle pause; only previously running audio may resume. */
  async setSuspended(suspended: boolean): Promise<boolean> {
    const context = this.context;
    const master = this.master;
    if (!context || !master || context.state === "closed") {
      return false;
    }
    try {
      if (suspended) {
        this.resumeAfterSuspension ||=
          this.playbackRequested && this.schedulerTimer !== null;
        const generation = ++this.startGeneration;
        this.clearScheduler();
        if (this.stopTimer !== null) {
          window.clearTimeout(this.stopTimer);
          this.stopTimer = null;
        }
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0, context.currentTime);
        this.stopActiveSources(context.currentTime);
        if (context.state === "running") {
          await context.suspend();
        }
        if (
          generation !== this.startGeneration ||
          context !== this.context ||
          master !== this.master
        ) {
          if (
            this.playbackRequested &&
            this.schedulerTimer !== null &&
            context === this.context &&
            master === this.master &&
            context.state === "suspended"
          ) {
            await context.resume();
          }
          return false;
        }
        return true;
      }
      if (!this.resumeAfterSuspension || !this.playbackRequested) {
        return false;
      }
      this.resumeAfterSuspension = false;
      const generation = ++this.startGeneration;
      if (!(await this.resumeWithin(context))) {
        return false;
      }
      if (
        generation !== this.startGeneration ||
        !this.playbackRequested ||
        context !== this.context ||
        master !== this.master
      ) {
        return false;
      }
      this.armScheduler(context, master, RESUME_FADE_SECONDS);
      return true;
    } catch {
      return false;
    }
  }

  /** Close the context and detach every node. Safe to call repeatedly. */
  dispose(): void {
    this.playbackRequested = false;
    this.resumeAfterSuspension = false;
    this.startGeneration += 1;
    this.clearScheduler();
    if (this.stopTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    const context = this.context;
    const master = this.master;
    this.context = null;
    this.master = null;
    this.roomBus = null;
    this.scoreBus = null;
    this.roomBuffer = null;
    if (context && master) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
    }
    this.stopActiveSources(context?.currentTime ?? 0);
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private armScheduler(
    context: AudioContext,
    master: GainNode,
    fadeSeconds: number,
  ): void {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
    // A quick leave→re-enter can cancel the delayed stop while its old loop
    // and tails still exist. Retire them under the now-silent master before
    // starting the fresh bed, otherwise every quick mode toggle doubles it.
    this.stopActiveSources(context.currentTime);
    master.gain.linearRampToValueAtTime(
      SCHWELLENRAUM_MASTER_GAIN,
      context.currentTime + fadeSeconds,
    );
    this.nextStepAt = context.currentTime + START_DELAY_SECONDS;
    this.startRoomBed(context, context.currentTime + START_DELAY_SECONDS);
    this.scheduleAhead();
    this.schedulerTimer = window.setInterval(() => this.scheduleAhead(), 140);
  }

  private scheduleAhead(): void {
    const context = this.context;
    if (!context || context.state !== "running") {
      return;
    }
    const windowPlan = planSchwellenraumSchedule(
      this.nextStepAt,
      context.currentTime,
    );
    for (const at of windowPlan.times) {
      this.scheduleStep(context, at, this.step);
      this.step += 1;
    }
    this.nextStepAt = windowPlan.nextAt;
  }

  private scheduleStep(context: AudioContext, at: number, step: number): void {
    const plan = schwellenraumStepPlan(step);
    if (this.mix.room && plan.rustle) {
      this.scheduleRustle(context, at, plan.rustleIndex);
    }
    if (this.mix.score && plan.pad) {
      this.schedulePad(context, at, plan.padRootMidi, step);
    }
    if (this.mix.score && plan.glint) {
      this.scheduleGlint(context, at, plan.glintMidi, step);
    }
  }

  private startRoomBed(context: AudioContext, at: number): void {
    if (!this.roomBus || !this.roomBuffer) {
      return;
    }
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.roomBuffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = RUSTLE_BUFFER_SECONDS;
    source.playbackRate.value = 0.72;
    highpass.type = "highpass";
    highpass.frequency.value = 85;
    highpass.Q.value = 0.35;
    lowpass.type = "lowpass";
    lowpass.frequency.value = 920;
    lowpass.Q.value = 0.4;
    gain.gain.value = 0.18;
    source
      .connect(highpass)
      .connect(lowpass)
      .connect(gain)
      .connect(this.roomBus);
    source.start(at, 0.31);
    this.trackSource(source, [highpass, lowpass, gain]);
  }

  private scheduleRustle(
    context: AudioContext,
    at: number,
    index: number,
  ): void {
    if (!this.roomBus || !this.roomBuffer) {
      return;
    }
    const duration = 2.85 + (index % 4) * 0.23;
    const source = context.createBufferSource();
    const bandpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    const pan = context.createStereoPanner();
    source.buffer = this.roomBuffer;
    source.playbackRate.setValueAtTime(0.78 + (index % 5) * 0.035, at);
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(610 + (index % 7) * 115, at);
    bandpass.Q.value = 0.48;
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2380;
    lowpass.Q.value = 0.35;
    pan.pan.setValueAtTime(((index % 9) - 4) * 0.075, at);
    const endAt = applyEnvelope(gain.gain, at, 0.42, 0.82, 0.58, 1.45);
    source
      .connect(bandpass)
      .connect(lowpass)
      .connect(gain)
      .connect(pan)
      .connect(this.roomBus);
    const offset = (index * 0.731) % 2.4;
    source.start(at, offset, duration);
    source.stop(Math.max(endAt, at + duration) + 0.03);
    this.trackSource(source, [bandpass, lowpass, gain, pan]);
  }

  private schedulePad(
    context: AudioContext,
    at: number,
    rootMidi: number,
    step: number,
  ): void {
    if (!this.scoreBus) {
      return;
    }
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const pan = context.createStereoPanner();
    const endAt = applyEnvelope(gain.gain, at, 0.09, 4.4, 7.1, 6.2);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(720, at);
    filter.frequency.linearRampToValueAtTime(1320, at + 6.8);
    filter.frequency.linearRampToValueAtTime(580, endAt);
    filter.Q.value = 0.5;
    pan.pan.setValueAtTime(((step / PAD_EVERY_STEPS) % 5 - 2) * 0.08, at);
    filter.connect(gain).connect(pan).connect(this.scoreBus);

    const intervals = step % 16 === 0 ? [0, 7, 14] : [0, 5, 12];
    const detunes = [-4.5, 1.5, 5.8] as const;
    intervals.forEach((interval, voiceIndex) => {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = voiceIndex === 1 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(
        schwellenraumFrequency(rootMidi + interval),
        at,
      );
      oscillator.detune.setValueAtTime(detunes[voiceIndex], at);
      partial.gain.value = voiceIndex === 0 ? 0.38 : 0.27;
      oscillator.connect(partial).connect(filter);
      oscillator.start(at);
      oscillator.stop(endAt + 0.04);
      this.trackSource(
        oscillator,
        voiceIndex === intervals.length - 1
          ? [partial, filter, gain, pan]
          : [partial],
      );
    });
  }

  private scheduleGlint(
    context: AudioContext,
    at: number,
    midi: number,
    step: number,
  ): void {
    if (!this.scoreBus) {
      return;
    }
    const gain = context.createGain();
    const lowpass = context.createBiquadFilter();
    const pan = context.createStereoPanner();
    const endAt = applyEnvelope(gain.gain, at, 0.033, 0.9, 0.18, 3.7);
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2600;
    lowpass.Q.value = 0.45;
    pan.pan.setValueAtTime(((step % 7) - 3) * 0.11, at);
    lowpass.connect(gain).connect(pan).connect(this.scoreBus);
    [1, 1.503].forEach((ratio, voiceIndex) => {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(schwellenraumFrequency(midi) * ratio, at);
      oscillator.detune.setValueAtTime(voiceIndex === 0 ? -2.5 : 3.5, at);
      partial.gain.value = voiceIndex === 0 ? 0.52 : 0.2;
      oscillator.connect(partial).connect(lowpass);
      oscillator.start(at);
      oscillator.stop(endAt + 0.04);
      this.trackSource(
        oscillator,
        voiceIndex === 1 ? [partial, lowpass, gain, pan] : [partial],
      );
    });
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
        // This call is reached synchronously from start().
        void context.resume().then(
          () => finish(context.state === "running"),
          () => finish(false),
        );
      } catch {
        finish(false);
      }
    });
  }

  private clearScheduler(): void {
    if (this.schedulerTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private stopActiveSources(at: number): void {
    for (const [source, nodes] of this.activeSources) {
      source.onended = null;
      try {
        source.stop(at);
      } catch {
        // A naturally ended source is already silent.
      }
      try {
        source.disconnect();
      } catch {
        // Best effort during lifecycle shutdown.
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Shared nodes may already have been detached by another partial.
        }
      }
    }
    this.activeSources.clear();
  }

  private trackSource(source: TrackedSource, nodes: AudioNode[]): void {
    this.activeSources.set(source, nodes);
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // Context shutdown may already have detached it.
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Shared nodes can be detached once by the final partial.
        }
      }
      this.activeSources.delete(source);
    };
  }
}
