/**
 * "Dusk Republic" — a dark, low, endlessly recurring 8-bit loop for the
 * Regierungsviertel, meant to sit far back in the mix and be switched
 * on or off at will.
 *
 * Sound design brief (owner, in German): düster, tieftönig, minecraft-
 * artig, 8-bit, ewig lang wiederkehrend, recht leise im Hintergrund,
 * angelehnt an SimCity 2000 und Manic Miner (langsam).
 *
 * How each reference shows up:
 * - **Manic Miner, slowed down.** Its famous monophonic "Mountain King"
 *   arpeggio is the melodic DNA: the lead is a single pulse voice
 *   climbing and falling through the scale in even steps. At 54 BPM in
 *   eighths it becomes a slow procession instead of a sprint.
 * - **SimCity 2000.** The bass is a walking line with ghost notes and
 *   the second pulse adds jazz-tinged colour (sevenths and ninths, the
 *   occasional flat ninth) rather than plain triads.
 * - **Minecraft.** Long rests. Whole bars where only the bass moves,
 *   so the music never demands attention.
 *
 * Chip constraints are deliberate: three tone voices (two pulse waves
 * with real duty cycles, one triangle bass) plus a filtered noise
 * channel for the sparse percussion — the palette of an NES/AY chip.
 *
 * "Ewig lang": the sections advance on an 8-step cycle, the lead
 * register on a 5-step cycle, the melodic contour on 7 and the
 * percussion pattern on 3. Their least common multiple is 840 sections
 * — just over four hours at this tempo before the exact combination
 * returns, with no audible seam anywhere.
 */

const REST = null;

export type ChipSection = {
  /** Scale degrees (0-based, in the section mode) for the bass walk. */
  bass: readonly (number | null)[];
  /** Chord colour degrees played by the second pulse voice. */
  colour: readonly (number | null)[];
  /** Semitone offset of this section's tonic from the piece's root. */
  degree: number;
  name: string;
};

/** D natural minor (aeolian) — the darkest common chip scale. */
export const AEOLIAN = [0, 2, 3, 5, 7, 8, 10] as const;
/** Phrygian for the two most oppressive sections (flat second). */
export const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10] as const;

export const CHIP_ROOT_MIDI = 38; // D2
export const CHIP_BPM = 54;
export const CHIP_STEP_SECONDS = 60 / CHIP_BPM / 2; // eighth notes
export const CHIP_STEPS_PER_SECTION = 32;
export const CHIP_MASTER_GAIN = 0.05;

/**
 * Eight harmonic stations, walked in order: i – VI – III – VII – iv –
 * v – ♭II(phrygian) – i. Classic minor-mode circling that never
 * resolves brightly.
 */
export const CHIP_SECTIONS: readonly ChipSection[] = [
  {
    name: "Dusk over the Spree",
    degree: 0,
    bass: [0, REST, 0, 7, REST, 4, 0, REST, 0, REST, 7, REST, 4, REST, 2, REST,
           0, REST, 0, 7, REST, 4, 0, REST, 5, REST, 4, REST, 2, REST, 0, REST],
    colour: [REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, 7, REST, REST, REST, REST, REST],
  },
  {
    name: "Ministries asleep",
    degree: 8,
    bass: [0, REST, REST, 0, 4, REST, 0, REST, 7, REST, 4, REST, 0, REST, REST, REST,
           0, REST, REST, 0, 4, REST, 7, REST, 9, REST, 7, REST, 4, REST, 0, REST],
    colour: [REST, REST, 11, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, 11, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Cold river light",
    degree: 3,
    bass: [0, REST, 4, REST, 0, REST, 7, REST, 0, REST, 4, REST, 2, REST, 0, REST,
           0, REST, 4, REST, 7, REST, 9, REST, 7, REST, 4, REST, 2, REST, 0, REST],
    colour: [REST, REST, REST, REST, REST, REST, 9, REST,
             REST, REST, REST, REST, REST, REST, 7, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST],
  },
  {
    name: "Empty colonnade",
    degree: 10,
    bass: [0, REST, 0, REST, REST, 7, REST, 4, 0, REST, REST, 0, 7, REST, 4, REST,
           0, REST, 0, REST, REST, 7, REST, 9, 7, REST, REST, 4, 2, REST, 0, REST],
    colour: [REST, REST, REST, 9, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, 11, REST,
             REST, REST, REST, 9, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Under the bridges",
    degree: 5,
    bass: [0, REST, 7, REST, 4, REST, 0, REST, 2, REST, 0, REST, 7, REST, 4, REST,
           0, REST, 7, REST, 4, REST, 2, REST, 0, REST, 9, REST, 7, REST, 4, REST],
    colour: [REST, REST, REST, REST, 7, REST, REST, REST,
             REST, REST, 9, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, 7, REST, REST, REST],
  },
  {
    name: "Lamps on the axis",
    degree: 7,
    bass: [0, REST, REST, 4, 0, REST, 7, REST, 0, REST, REST, 2, 4, REST, 0, REST,
           0, REST, REST, 4, 7, REST, 9, REST, 7, REST, REST, 4, 0, REST, REST, REST],
    colour: [REST, REST, 9, REST, REST, REST, REST, REST,
             REST, REST, 11, REST, REST, REST, REST, REST,
             REST, REST, 9, REST, REST, REST, 7, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Flat second (the dread)",
    degree: 1,
    bass: [0, REST, 0, REST, 3, REST, 0, REST, 7, REST, 3, REST, 0, REST, REST, REST,
           0, REST, 0, REST, 3, REST, 7, REST, 8, REST, 7, REST, 3, REST, 0, REST],
    colour: [REST, REST, REST, REST, 8, REST, REST, REST,
             REST, REST, REST, REST, 10, REST, REST, REST,
             REST, REST, REST, REST, 8, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Home, unresolved",
    degree: 0,
    bass: [0, REST, REST, REST, 7, REST, REST, REST, 4, REST, REST, REST, 0, REST, REST, REST,
           0, REST, REST, 7, REST, REST, 4, REST, 2, REST, REST, REST, 0, REST, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST],
  },
];

/**
 * The Manic-Miner contour: seven ways through the scale, each a slow
 * climb-and-fall in scale degrees. One is chosen per section from a
 * 7-cycle, so melody and harmony drift apart and only realign after
 * many sections.
 */
export const LEAD_CONTOURS: readonly (readonly number[])[] = [
  [0, 2, 4, 2, 0, -3, 0, 2],
  [0, 2, 4, 2, 5, 4, 2, 0],
  [7, 5, 4, 2, 0, 2, 4, 5],
  [0, 2, 0, -1, 0, 2, 4, 2],
  [4, 2, 0, 2, 4, 5, 7, 5],
  [0, -3, 0, 2, 4, 2, 0, -3],
  [2, 4, 5, 7, 5, 4, 2, 0],
];

/** Lead register shifts on a 5-cycle: −12, 0, +12 semitones and back. */
export const LEAD_OCTAVES = [0, 12, 0, -12, 12] as const;

/** Sparse percussion: three patterns of shaker positions in 32 steps. */
export const PERCUSSION_PATTERNS: readonly (readonly number[])[] = [
  [8, 24],
  [4, 12, 20, 28],
  [16],
];

/**
 * Section cycles are coprime by construction, so the exact combination
 * of harmony, register, contour and percussion recurs only after
 * lcm(8, 5, 7, 3) = 840 sections.
 */
export const CHIP_CYCLE_SECTIONS = 840;

export function chipLoopSeconds(): number {
  return CHIP_CYCLE_SECTIONS * CHIP_STEPS_PER_SECTION * CHIP_STEP_SECONDS;
}

export function sectionAt(index: number): ChipSection {
  return CHIP_SECTIONS[index % CHIP_SECTIONS.length];
}

export function contourAt(index: number): readonly number[] {
  return LEAD_CONTOURS[index % LEAD_CONTOURS.length];
}

export function leadOctaveAt(index: number): number {
  return LEAD_OCTAVES[index % LEAD_OCTAVES.length];
}

export function percussionAt(index: number): readonly number[] {
  return PERCUSSION_PATTERNS[index % PERCUSSION_PATTERNS.length];
}

/** Mode of a section: the two flat-second stations use phrygian. */
export function modeFor(section: ChipSection): readonly number[] {
  return section.degree === 1 ? PHRYGIAN : AEOLIAN;
}

/**
 * Scale degree → MIDI note. Degrees may run below zero or above the
 * octave; the scale wraps and the octave follows.
 */
export function degreeToMidi(
  degree: number,
  mode: readonly number[],
  tonicMidi: number,
): number {
  const size = mode.length;
  const octave = Math.floor(degree / size);
  const step = ((degree % size) + size) % size;
  return tonicMidi + octave * 12 + mode[step];
}

export function midiFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** True when the browser can host the chip player at all. */
export function isChiptuneSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window.AudioContext ?? (window as never as Record<string, unknown>).webkitAudioContext) !==
      "undefined"
  );
}

type PulseDuty = 0.125 | 0.25 | 0.5;

/**
 * A real pulse wave via Fourier series — the square-ish timbre of an
 * NES pulse channel, including its duty cycle. A plain "square"
 * oscillator only gives 50 %.
 */
function pulseWave(context: AudioContext, duty: PulseDuty): PeriodicWave {
  const harmonics = 24;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  for (let n = 1; n < harmonics; n += 1) {
    // Fourier coefficients of a pulse train of the given duty cycle.
    imag[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
  }
  return context.createPeriodicWave(real, imag, { disableNormalization: false });
}

/**
 * The player. Scheduling is look-ahead based (like the ambient layer),
 * so a throttled timer never produces a burst of past-due notes.
 */
export class DuskChiptune {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private pulseWaves: Map<PulseDuty, PeriodicWave> = new Map();
  private noiseBuffer: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextStepAt = 0;
  private step = 0;

  get playing(): boolean {
    return this.timer !== null;
  }

  /** Absolute section index for a global step counter. */
  private sectionIndex(step: number): number {
    return Math.floor(step / CHIP_STEPS_PER_SECTION);
  }

  async start(): Promise<boolean> {
    if (this.timer !== null) {
      return true;
    }
    if (!isChiptuneSupported()) {
      return false;
    }
    try {
      const Ctor =
        window.AudioContext ??
        ((window as never as Record<string, unknown>)
          .webkitAudioContext as typeof AudioContext);
      const context = this.context ?? new Ctor();
      this.context = context;
      if (context.state === "suspended") {
        await context.resume();
      }
      if (!this.master) {
        // Gentle low-pass: chip waves are harsh up top, and this track
        // must sit far behind the interface.
        const lowpass = context.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 2200;
        lowpass.Q.value = 0.6;
        const master = context.createGain();
        master.gain.value = 0;
        lowpass.connect(master);
        master.connect(context.destination);
        this.lowpass = lowpass;
        this.master = master;
      }
      // Fade in rather than clicking on.
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, context.currentTime);
      this.master.gain.linearRampToValueAtTime(
        CHIP_MASTER_GAIN,
        context.currentTime + 1.6,
      );
      if (this.nextStepAt < context.currentTime) {
        this.nextStepAt = context.currentTime + 0.12;
      }
      this.scheduleAhead();
      this.timer = window.setInterval(() => this.scheduleAhead(), 90);
      return true;
    } catch {
      return false;
    }
  }

  /** Fade out and stop scheduling; the context stays warm for restart. */
  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(master.gain.value, context.currentTime);
    master.gain.linearRampToValueAtTime(0, context.currentTime + 0.9);
  }

  async dispose(): Promise<void> {
    this.stop();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.lowpass = null;
    this.pulseWaves.clear();
    this.noiseBuffer = null;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // A context that refuses to close is harmless here.
      }
    }
  }

  private waveFor(context: AudioContext, duty: PulseDuty): PeriodicWave {
    const cached = this.pulseWaves.get(duty);
    if (cached) {
      return cached;
    }
    const wave = pulseWave(context, duty);
    this.pulseWaves.set(duty, wave);
    return wave;
  }

  private noise(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }
    const length = Math.floor(context.sampleRate * 0.3);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let value = 0;
    for (let index = 0; index < length; index += 1) {
      // Slightly correlated noise reads as a soft shaker, not a hiss.
      value = value * 0.72 + (Math.random() * 2 - 1) * 0.28;
      data[index] = value;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private scheduleAhead(): void {
    const context = this.context;
    const lowpass = this.lowpass;
    if (!context || !lowpass || context.state === "closed") {
      return;
    }
    // Catch-up clamp after timer throttling (background tab).
    if (this.nextStepAt < context.currentTime - CHIP_STEP_SECONDS) {
      this.nextStepAt = context.currentTime;
    }
    while (this.nextStepAt < context.currentTime + 0.4) {
      this.scheduleStep(context, lowpass, this.nextStepAt, this.step);
      this.nextStepAt += CHIP_STEP_SECONDS;
      this.step += 1;
    }
  }

  private scheduleStep(
    context: AudioContext,
    destination: AudioNode,
    at: number,
    step: number,
  ): void {
    const sectionCount = this.sectionIndex(step);
    const section = sectionAt(sectionCount);
    const mode = modeFor(section);
    const local = step % CHIP_STEPS_PER_SECTION;
    const tonic = CHIP_ROOT_MIDI + section.degree;

    // Triangle bass — the walking line, two octaves down.
    const bassDegree = section.bass[local];
    if (bassDegree !== REST && bassDegree !== undefined) {
      this.voice(context, destination, {
        at,
        duration: CHIP_STEP_SECONDS * 1.7,
        gain: 0.5,
        midi: degreeToMidi(bassDegree, mode, tonic - 12),
        type: "triangle",
      });
    }

    // Pulse 2 — jazz colour, narrow duty, quiet and short.
    const colourDegree = section.colour[local];
    if (colourDegree !== REST && colourDegree !== undefined) {
      this.voice(context, destination, {
        at,
        duration: CHIP_STEP_SECONDS * 2.4,
        duty: 0.125,
        gain: 0.16,
        midi: degreeToMidi(colourDegree, mode, tonic + 12),
        type: "pulse",
      });
    }

    // Pulse 1 — the slow Manic-Miner arpeggio, one note every fourth
    // eighth so the procession breathes.
    if (local % 4 === 0) {
      const contour = contourAt(sectionCount);
      const position = (local / 4) % contour.length;
      const midi =
        degreeToMidi(contour[position], mode, tonic + 12) +
        leadOctaveAt(sectionCount);
      this.voice(context, destination, {
        at,
        duration: CHIP_STEP_SECONDS * 3.1,
        duty: 0.25,
        gain: 0.2,
        midi,
        type: "pulse",
      });
    }

    // Noise channel — a shaker on a handful of steps per section.
    if (percussionAt(sectionCount).includes(local)) {
      const source = context.createBufferSource();
      source.buffer = this.noise(context);
      const bandpass = context.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 5200;
      bandpass.Q.value = 1.4;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.08, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(destination);
      source.start(at);
      source.stop(at + 0.2);
    }
  }

  private voice(
    context: AudioContext,
    destination: AudioNode,
    spec: {
      at: number;
      duration: number;
      duty?: PulseDuty;
      gain: number;
      midi: number;
      type: "pulse" | "triangle";
    },
  ): void {
    const oscillator = context.createOscillator();
    if (spec.type === "pulse") {
      oscillator.setPeriodicWave(this.waveFor(context, spec.duty ?? 0.25));
    } else {
      oscillator.type = "triangle";
    }
    oscillator.frequency.value = midiFrequency(spec.midi);
    const gain = context.createGain();
    // Chip envelope: instant attack, short decay to a sustain, release.
    gain.gain.setValueAtTime(0, spec.at);
    gain.gain.linearRampToValueAtTime(spec.gain, spec.at + 0.012);
    gain.gain.linearRampToValueAtTime(spec.gain * 0.55, spec.at + 0.09);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      spec.at + Math.max(0.12, spec.duration),
    );
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(spec.at);
    oscillator.stop(spec.at + Math.max(0.14, spec.duration) + 0.02);
  }
}
