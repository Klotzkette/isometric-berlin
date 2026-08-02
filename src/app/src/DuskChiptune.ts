/**
 * "Dusk Republic" — a dark, low-key motorik loop for the
 * Regierungsviertel: 8-bit voices over a machine pulse, meant to sit
 * far back in the mix and be switched on or off at will.
 *
 * Sound design brief (owner, in German): düster, tieftönig, 8-bit,
 * ewig lang wiederkehrend, recht leise im Hintergrund — kraftwerky und
 * NEU!-mässig, krautrockig, aber auch Daft-Punk-artig hip, mit
 * Basis-Click und Bass, muss aber low key sein.
 *
 * The piece alternates two movements of equal weight, so both moods
 * the owner asked for live in one loop:
 * - **Slow movement (the original mood).** Events land on quarter notes
 *   of the shared grid — roughly the old 54 BPM procession — sparse,
 *   dark, almost no percussion. Eight sections of eight bars.
 * - **Motorik movement.** The same harmony at four times the event
 *   density: sixteenth-note sequencer bass, a click on every half, hats
 *   on the off-quarters, filter breathing. Eight sections of four bars.
 * Both run on ONE sixteenth-note grid, so switching movement is a
 * change of density and not a tempo jump — the classic krautrock
 * half-time/double-time move. Sixteen-step ramps at each boundary fade
 * the percussion in before a motorik section and out before a slow one,
 * so the seams are audible as a lift, never as a cut.
 *
 * How each reference shows up:
 * - **NEU! / Klaus Dinger — the motorik beat.** A click on every
 *   quarter (four on the floor) with a hat on every eighth: the
 *   relentless, hypnotic pulse of "Hallogallo". This is the spine.
 * - **Kraftwerk.** The bass is a sixteenth-note sequencer line that
 *   mostly hammers its tonic and moves in small, precise steps —
 *   machine music, not a walking bass. The lead is a clean pulse
 *   arpeggio over it.
 * - **Krautrock.** Sections change slowly and minimally; nothing
 *   develops in a hurry, the groove simply keeps running.
 * - **Daft Punk.** A slow filter sweep breathes across each section
 *   (the master low-pass opens and closes), giving the loop that
 *   filtered-house lift without adding any volume.
 * - **Low key throughout.** Master gain stays at 0.05 and the click is
 *   a soft blip rather than a kick drum.
 *
 * Chip constraints are deliberate: two pulse voices with real duty
 * cycles, a triangle bass, and filtered noise for click and hats — the
 * palette of an NES/AY chip.
 *
 * "Ewig lang": harmony advances on a 16-cycle (both movements), lead
 * register on 5, melodic contour on 7 and the filter breath on 11.
 * Their least common multiple is 18,480 sections — well over eight
 * hours at this tempo before the exact combination returns.
 */

import { createReverbImpulse } from "./AmbientSoundscape";

const REST = null;

export type ChipMovement = "slow" | "motorik";

export type ChipSection = {
  /**
   * Scale degrees for the bass. In a motorik section these are
   * sixteenths (64 of them); in a slow section they are quarters (32
   * of them, each held for four grid steps).
   */
  bass: readonly (number | null)[];
  /** Chord colour degrees played by the second pulse voice. */
  colour: readonly (number | null)[];
  /** Semitone offset of this section's tonic from the piece's root. */
  degree: number;
  movement: ChipMovement;
  name: string;
};

/** Grid steps per event: quarters in the slow movement, sixteenths in motorik. */
export function stepsPerEvent(movement: ChipMovement): number {
  return movement === "slow" ? 4 : 1;
}

/**
 * How much of the chip layer goes through the hall. Slightly wetter than the
 * ambient layer: the chip voices are the drier, more percussive of the two, so
 * they need more tail to stop reading as restless.
 */
export const CHIP_REVERB_WET = 0.46;

/** D natural minor (aeolian) — the darkest common chip scale. */
export const AEOLIAN = [0, 2, 3, 5, 7, 8, 10] as const;
/** Phrygian for the two most oppressive sections (flat second). */
export const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10] as const;

// v0.39.0 drops the root a perfect fourth, matching the ambient layer's
// transposition, so both engines share one darker pitch centre ("mehr Tiefe").
export const CHIP_ROOT_MIDI = 33; // A1
/**
 * Motorik tempo. 118 → 88 BPM in v0.39.0: "noch zu unruhig und ein bisschen zu
 * schnell." A 25 % slowdown keeps the pulse hypnotic rather than driving, and
 * because every event length is a multiple of CHIP_STEP_SECONDS the notes
 * lengthen with the grid instead of leaving holes in the groove.
 */
export const CHIP_BPM = 88;
export const CHIP_STEP_SECONDS = 60 / CHIP_BPM / 4; // sixteenth notes
// Mixed with the optional ambient layer, so the two masters sum to 0.10
// instead of competing for headroom in mobile speakers.
export const CHIP_MASTER_GAIN = 0.03;
export const CHIP_SCHEDULE_AHEAD_SECONDS = 0.4;
export const CHIP_SCHEDULE_RESUME_DELAY_SECONDS = 0.06;
export const CHIP_MAX_STEPS_PER_TICK = 4;

/**
 * The motorik spine: a click on every half, a hat on the off-quarter between
 * them. v0.39.0 halves the percussion density (click 4 → 8, hat 2 → 4): at the
 * slower tempo the old four-on-the-floor plus off-eighth hat was the loudest
 * remaining source of "zu unruhig". The alternation click–hat–click survives,
 * there is simply twice as much air between the hits.
 */
export const CLICK_EVERY_STEPS = 8;
export const HAT_EVERY_STEPS = 4;

export function isClickStep(localStep: number): boolean {
  return localStep % CLICK_EVERY_STEPS === 0;
}

export function isHatStep(localStep: number): boolean {
  return localStep % HAT_EVERY_STEPS === 0 && !isClickStep(localStep);
}

/**
 * Daft-Punk filter breath: the master low-pass sweeps up and back down
 * once per section, on an 11-cycle of depths so no two neighbouring
 * sections breathe alike.
 */
export const FILTER_DEPTHS = [
  0.2, 0.55, 0.35, 0.8, 0.3, 0.65, 0.25, 0.9, 0.45, 0.7, 0.4,
] as const;
export const FILTER_BASE_HZ = 900;
export const FILTER_PEAK_HZ = 3400;

export function filterHzAt(
  sectionIndex: number,
  localStep: number,
  sectionLength: number,
  movement: ChipMovement,
): number {
  const depth = FILTER_DEPTHS[sectionIndex % FILTER_DEPTHS.length];
  const phase = localStep / Math.max(1, sectionLength);
  // One smooth up-and-down per section; the slow movement keeps the
  // low-pass mostly shut so it stays dark.
  const breath = Math.sin(phase * Math.PI);
  const reach = movement === "slow" ? 0.35 : 1;
  return (
    FILTER_BASE_HZ +
    (FILTER_PEAK_HZ - FILTER_BASE_HZ) * depth * breath * reach
  );
}

/**
 * Eight harmonic stations, walked in order: i – VI – III – VII – iv –
 * v – ♭II(phrygian) – i. Classic minor-mode circling that never
 * resolves brightly.
 */
export const CHIP_SECTIONS: readonly ChipSection[] = [
  {
    name: "Dusk over the Spree",
    degree: 0,
    movement: "motorik",
    // Kraftwerk sequencer bass: sixteenths hammering the tonic with
    // small precise moves — machine music, not a walking bass.
    bass: [0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 4, 0, 2, 0,
           0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 4, 0, 2, 0,
           0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 5, 0, 4, 0,
           0, 0, 0, 0, 0, 0, 7, 0, 4, 0, 2, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             9, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             11, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             9, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             7, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Ministries asleep",
    degree: 8,
    movement: "motorik",
    bass: [0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 7, 0, 4, 0,
           0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 7, 0, 4, 0,
           0, 0, 0, 0, 4, 0, 7, 0, 0, 0, 0, 0, 9, 0, 7, 0,
           0, 0, 0, 0, 4, 0, 0, 0, 2, 0, 0, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Cold river light",
    degree: 3,
    movement: "motorik",
    bass: [0, 0, 4, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 4, 0,
           0, 0, 4, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 2, 0,
           0, 0, 4, 0, 7, 0, 0, 0, 9, 0, 7, 0, 0, 0, 4, 0,
           0, 0, 4, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, 9, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, 7, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             11, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             9, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Empty colonnade",
    degree: 10,
    movement: "motorik",
    bass: [0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 4, 0, 0, 0, 0, 0,
           0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 4, 0, 0, 0, 0, 0,
           0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 9, 0, 7, 0, 4, 0,
           0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 2, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Under the bridges",
    degree: 5,
    movement: "motorik",
    bass: [0, 0, 0, 0, 7, 0, 4, 0, 0, 0, 0, 0, 2, 0, 0, 0,
           0, 0, 0, 0, 7, 0, 4, 0, 0, 0, 0, 0, 2, 0, 0, 0,
           0, 0, 0, 0, 7, 0, 4, 0, 2, 0, 0, 0, 9, 0, 7, 0,
           0, 0, 0, 0, 7, 0, 4, 0, 0, 0, 0, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             7, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             11, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 7, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Lamps on the axis",
    degree: 7,
    movement: "motorik",
    bass: [0, 0, 0, 4, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 4, 0,
           0, 0, 0, 4, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 2, 0,
           0, 0, 0, 4, 7, 0, 0, 0, 9, 0, 7, 0, 4, 0, 0, 0,
           0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, 9, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, 11, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, 9, REST, REST, REST, 7, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Flat second (the dread)",
    degree: 1,
    movement: "motorik",
    bass: [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 7, 0, 3, 0,
           0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 7, 0, 3, 0,
           0, 0, 0, 0, 3, 0, 7, 0, 0, 0, 0, 0, 8, 0, 7, 0,
           0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             8, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             10, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             8, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Home, unresolved",
    degree: 0,
    movement: "motorik",
    bass: [0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0,
           4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
           0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 4, 0, 0, 0,
           2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, REST, REST],
    colour: [REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             9, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST,
             11, REST, REST, REST, REST, REST, REST, REST],
  },
  // ---- Slow movement: the original dark procession, quarter events ----
  {
    name: "Dusk, slow",
    degree: 0,
    movement: "slow",
    bass: [0, REST, 0, 7, REST, 4, 0, REST, 0, REST, 7, REST, 4, REST, 2, REST,
           0, REST, 0, 7, REST, 4, 0, REST, 5, REST, 4, REST, 2, REST, 0, REST],
    colour: [REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, 7, REST, REST, REST, REST, REST],
  },
  {
    name: "Ministries, slow",
    degree: 8,
    movement: "slow",
    bass: [0, REST, REST, 0, 4, REST, 0, REST, 7, REST, 4, REST, 0, REST, REST, REST,
           0, REST, REST, 0, 4, REST, 7, REST, 9, REST, 7, REST, 4, REST, 0, REST],
    colour: [REST, REST, 11, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST,
             REST, REST, 11, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Cold river, slow",
    degree: 3,
    movement: "slow",
    bass: [0, REST, 4, REST, 0, REST, 7, REST, 0, REST, 4, REST, 2, REST, 0, REST,
           0, REST, 4, REST, 7, REST, 9, REST, 7, REST, 4, REST, 2, REST, 0, REST],
    colour: [REST, REST, REST, REST, REST, REST, 9, REST,
             REST, REST, REST, REST, REST, REST, 7, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, 9, REST, REST, REST],
  },
  {
    name: "Colonnade, slow",
    degree: 10,
    movement: "slow",
    bass: [0, REST, 0, REST, REST, 7, REST, 4, 0, REST, REST, 0, 7, REST, 4, REST,
           0, REST, 0, REST, REST, 7, REST, 9, 7, REST, REST, 4, 2, REST, 0, REST],
    colour: [REST, REST, REST, 9, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, 11, REST,
             REST, REST, REST, 9, REST, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Bridges, slow",
    degree: 5,
    movement: "slow",
    bass: [0, REST, 7, REST, 4, REST, 0, REST, 2, REST, 0, REST, 7, REST, 4, REST,
           0, REST, 7, REST, 4, REST, 2, REST, 0, REST, 9, REST, 7, REST, 4, REST],
    colour: [REST, REST, REST, REST, 7, REST, REST, REST,
             REST, REST, 9, REST, REST, REST, REST, REST,
             REST, REST, REST, REST, 11, REST, REST, REST,
             REST, REST, REST, REST, 7, REST, REST, REST],
  },
  {
    name: "Axis lamps, slow",
    degree: 7,
    movement: "slow",
    bass: [0, REST, REST, 4, 0, REST, 7, REST, 0, REST, REST, 2, 4, REST, 0, REST,
           0, REST, REST, 4, 7, REST, 9, REST, 7, REST, REST, 4, 0, REST, REST, REST],
    colour: [REST, REST, 9, REST, REST, REST, REST, REST,
             REST, REST, 11, REST, REST, REST, REST, REST,
             REST, REST, 9, REST, REST, REST, 7, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Flat second, slow",
    degree: 1,
    movement: "slow",
    bass: [0, REST, 0, REST, 3, REST, 0, REST, 7, REST, 3, REST, 0, REST, REST, REST,
           0, REST, 0, REST, 3, REST, 7, REST, 8, REST, 7, REST, 3, REST, 0, REST],
    colour: [REST, REST, REST, REST, 8, REST, REST, REST,
             REST, REST, REST, REST, 10, REST, REST, REST,
             REST, REST, REST, REST, 8, REST, REST, REST,
             REST, REST, REST, REST, REST, REST, REST, REST],
  },
  {
    name: "Home, slow and unresolved",
    degree: 0,
    movement: "slow",
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

/**
 * Grid steps a section occupies: a slow section holds 32 quarter events
 * (128 steps, eight bars), a motorik section 64 sixteenths (four bars).
 * Equal listening weight, since the slow movement runs at a quarter of
 * the event density.
 */
export function sectionSteps(section: ChipSection): number {
  return section.bass.length * stepsPerEvent(section.movement);
}

/** Grid steps for one pass through all sixteen sections. */
export function sectionCycleSteps(): number {
  return CHIP_SECTIONS.reduce(
    (total, section) => total + sectionSteps(section),
    0,
  );
}

/**
 * Section cycles are coprime by construction, so the exact combination
 * of harmony, register, contour, hats and filter breath recurs only
 * after lcm(16, 5, 7, 3, 11) = 18,480 sections.
 */
export const CHIP_CYCLE_SECTIONS = 18_480;

export function chipLoopSeconds(): number {
  // Average section length across the sixteen-section pass.
  const perPass = sectionCycleSteps();
  const passes = CHIP_CYCLE_SECTIONS / CHIP_SECTIONS.length;
  return passes * perPass * CHIP_STEP_SECONDS;
}

export function sectionAt(index: number): ChipSection {
  return CHIP_SECTIONS[index % CHIP_SECTIONS.length];
}

/** Where a global grid step sits: which section, and how far into it. */
export function locateStep(step: number): {
  local: number;
  section: ChipSection;
  sectionIndex: number;
} {
  const perPass = sectionCycleSteps();
  const passIndex = Math.floor(step / perPass);
  let offset = step - passIndex * perPass;
  for (let index = 0; index < CHIP_SECTIONS.length; index += 1) {
    const section = CHIP_SECTIONS[index];
    const length = sectionSteps(section);
    if (offset < length) {
      return {
        local: offset,
        section,
        sectionIndex: passIndex * CHIP_SECTIONS.length + index,
      };
    }
    offset -= length;
  }
  // Unreachable: offset is always inside the pass.
  return { local: 0, section: CHIP_SECTIONS[0], sectionIndex: 0 };
}

/** Steps over which percussion fades in or out at a movement change. */
export const TRANSITION_STEPS = 16;

/**
 * Percussion weight (0…1) for a grid position. Approaching a motorik
 * section from a slow one the hats ramp IN; approaching a slow section
 * they ramp OUT, so a movement change lifts or settles instead of
 * cutting.
 */
export function percussionWeight(
  section: ChipSection,
  local: number,
  nextMovement: ChipMovement,
): number {
  const length = sectionSteps(section);
  const toEnd = length - local;
  if (section.movement === "motorik") {
    if (nextMovement === "slow" && toEnd <= TRANSITION_STEPS) {
      return toEnd / TRANSITION_STEPS;
    }
    return 1;
  }
  // Slow sections are almost dry; only the run-up to motorik wakes up.
  if (nextMovement === "motorik" && toEnd <= TRANSITION_STEPS) {
    return 1 - toEnd / TRANSITION_STEPS;
  }
  return 0;
}

export function contourAt(index: number): readonly number[] {
  return LEAD_CONTOURS[index % LEAD_CONTOURS.length];
}

export function leadOctaveAt(index: number): number {
  return LEAD_OCTAVES[index % LEAD_OCTAVES.length];
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
    typeof (
      window.AudioContext ??
      (window as never as Record<string, unknown>).webkitAudioContext
    ) !== "undefined"
  );
}

type PulseDuty = 0.125 | 0.25 | 0.5;

export type ChipScheduleBatch = {
  nextStepAt: number;
  times: readonly number[];
};

/**
 * Build one bounded look-ahead batch. A background-tab jump restarts just
 * ahead of "now"; it never emits a pile of past-due steps.
 */
export function chipScheduleBatch(
  currentTime: number,
  nextStepAt: number,
): ChipScheduleBatch {
  let cursor = nextStepAt;
  if (
    !Number.isFinite(cursor) ||
    cursor < currentTime - CHIP_STEP_SECONDS
  ) {
    cursor = currentTime + CHIP_SCHEDULE_RESUME_DELAY_SECONDS;
  }
  const times: number[] = [];
  const horizon = currentTime + CHIP_SCHEDULE_AHEAD_SECONDS;
  while (
    cursor < horizon &&
    times.length < CHIP_MAX_STEPS_PER_TICK
  ) {
    times.push(cursor);
    cursor += CHIP_STEP_SECONDS;
  }
  return { nextStepAt: cursor, times };
}

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
  private activeSources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private startGeneration = 0;
  private startPromise: Promise<boolean> | null = null;
  private timer: number | null = null;
  private nextStepAt = 0;
  private step = 0;

  get playing(): boolean {
    return this.timer !== null;
  }

  /**
   * Whether the track is actually reaching the speakers.
   *
   * `playing` only says the scheduler is running. A browser that blocked
   * autoplay, or that suspended the tab, leaves the context out of the
   * `running` state with the scheduler still armed — which is how the
   * toggle came to show "on" over silence.
   */
  get audible(): boolean {
    return this.timer !== null && this.context?.state === "running";
  }

  get activeVoiceCount(): number {
    return this.activeSources.size;
  }

  async start(): Promise<boolean> {
    if (this.timer !== null) {
      return true;
    }
    if (this.startPromise) {
      return this.startPromise;
    }
    if (!isChiptuneSupported()) {
      return false;
    }
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
    try {
      const Ctor =
        window.AudioContext ??
        ((window as never as Record<string, unknown>)
          .webkitAudioContext as typeof AudioContext);
      const context = this.context ?? new Ctor();
      this.context = context;
      if (!(await this.resumeWithin(context))) {
        return false;
      }
      if (generation !== this.startGeneration) {
        return false;
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
        // Parallel dry/wet hall, sharing the ambient layer's impulse response
        // so both engines sit in the same room ("deutlich mehr Reverb"). The
        // ConvolverNode normalises the response, so the master gain contract is
        // unaffected.
        const dry = context.createGain();
        const wet = context.createGain();
        const reverb = context.createConvolver();
        reverb.buffer = createReverbImpulse(context);
        dry.gain.value = 1 - CHIP_REVERB_WET;
        wet.gain.value = CHIP_REVERB_WET;
        master.connect(dry).connect(context.destination);
        master.connect(reverb).connect(wet).connect(context.destination);
        this.lowpass = lowpass;
        this.master = master;
      }
      // Fade in rather than clicking on.
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setValueAtTime(
        this.master.gain.value,
        context.currentTime,
      );
      this.master.gain.linearRampToValueAtTime(
        CHIP_MASTER_GAIN,
        context.currentTime + 1.6,
      );
      if (this.nextStepAt < context.currentTime) {
        this.nextStepAt =
          context.currentTime + CHIP_SCHEDULE_RESUME_DELAY_SECONDS;
      }
      this.scheduleAhead();
      this.timer = window.setInterval(() => this.scheduleAhead(), 90);
      return true;
    } catch {
      return false;
    }
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
      void context.resume().then(
        () => finish(context.state === "running"),
        () => finish(false),
      );
    });
  }

  /** Fade out and stop scheduling; the context stays warm for restart. */
  stop(): void {
    this.startGeneration += 1;
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
    const silentAt = context.currentTime + 0.24;
    master.gain.linearRampToValueAtTime(0, silentAt);
    for (const source of this.activeSources.keys()) {
      try {
        source.stop(silentAt + 0.02);
      } catch {
        // A source that already ended has already left the audible graph.
      }
    }
  }

  async setSuspended(suspended: boolean): Promise<boolean> {
    const context = this.context;
    if (!context || context.state === "closed") {
      return false;
    }
    try {
      if (suspended) {
        if (context.state === "running") {
          await context.suspend();
        }
        return true;
      }
      if (!(await this.resumeWithin(context))) {
        return false;
      }
      this.nextStepAt =
        context.currentTime + CHIP_SCHEDULE_RESUME_DELAY_SECONDS;
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.stop();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.lowpass = null;
    this.pulseWaves.clear();
    this.noiseBuffer = null;
    this.activeSources.clear();
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
    if (!context || !lowpass || context.state !== "running") {
      return;
    }
    const batch = chipScheduleBatch(context.currentTime, this.nextStepAt);
    for (const at of batch.times) {
      this.scheduleStep(context, lowpass, at, this.step);
      this.step += 1;
    }
    this.nextStepAt = batch.nextStepAt;
  }

  private scheduleStep(
    context: AudioContext,
    destination: AudioNode,
    at: number,
    step: number,
  ): void {
    const { local, section, sectionIndex } = locateStep(step);
    const mode = modeFor(section);
    const tonic = CHIP_ROOT_MIDI + section.degree;
    const length = sectionSteps(section);
    const perEvent = stepsPerEvent(section.movement);
    const nextMovement = sectionAt(sectionIndex + 1).movement;
    const drive = percussionWeight(section, local, nextMovement);

    // Daft-Punk filter breath on the shared low-pass.
    if (this.lowpass) {
      this.lowpass.frequency.setTargetAtTime(
        filterHzAt(sectionIndex, local, length, section.movement),
        at,
        0.12,
      );
    }

    // Bass and colour only fire on this movement's event grid.
    if (local % perEvent === 0) {
      const eventIndex = local / perEvent;
      const bassDegree = section.bass[eventIndex];
      if (bassDegree !== REST && bassDegree !== undefined) {
        this.voice(context, destination, {
          at,
          // The slow movement holds its notes; motorik keeps them tight.
          duration: CHIP_STEP_SECONDS * (perEvent === 1 ? 1.5 : 5.2),
          gain: section.movement === "slow" ? 0.5 : 0.42,
          midi: degreeToMidi(bassDegree, mode, tonic - 12),
          type: "triangle",
        });
      }
      const colourDegree = section.colour[eventIndex];
      if (colourDegree !== REST && colourDegree !== undefined) {
        this.voice(context, destination, {
          at,
          duration: CHIP_STEP_SECONDS * (perEvent === 1 ? 6 : 9),
          duty: 0.125,
          gain: 0.15,
          midi: degreeToMidi(colourDegree, mode, tonic + 12),
          type: "pulse",
        });
      }
    }

    // Pulse 1 — the Manic-Miner arpeggio. One note per bar in the slow
    // movement, one per half bar under motorik.
    const leadEvery = section.movement === "slow" ? 16 : 8;
    if (local % leadEvery === 0) {
      const contour = contourAt(sectionIndex);
      const position = (local / leadEvery) % contour.length;
      const midi =
        degreeToMidi(contour[position], mode, tonic + 12) +
        leadOctaveAt(sectionIndex);
      this.voice(context, destination, {
        at,
        duration: CHIP_STEP_SECONDS * (section.movement === "slow" ? 12 : 7),
        duty: 0.25,
        gain: 0.19,
        midi,
        type: "pulse",
      });
    }

    // NEU! motorik spine — a soft click on the quarters, hats on the
    // eighths, both scaled by the transition ramp so movement changes
    // lift and settle instead of cutting.
    if (drive > 0.02) {
      if (isClickStep(local)) {
        this.percussion(context, destination, at, {
          decay: 0.11,
          frequency: 1450,
          gain: 0.1 * drive,
          q: 1.1,
        });
      } else if (isHatStep(local)) {
        this.percussion(context, destination, at, {
          decay: 0.05,
          frequency: 6400,
          gain: 0.045 * drive,
          q: 1.6,
        });
      }
    }
  }

  private percussion(
    context: AudioContext,
    destination: AudioNode,
    at: number,
    spec: { decay: number; frequency: number; gain: number; q: number },
  ): void {
    const source = context.createBufferSource();
    source.buffer = this.noise(context);
    const bandpass = context.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = spec.frequency;
    bandpass.Q.value = spec.q;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(spec.gain, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + spec.decay);
    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(destination);
    source.start(at);
    source.stop(at + spec.decay + 0.05);
    this.trackSource(source, [bandpass, gain]);
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
    this.trackSource(oscillator, [gain]);
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
          // The node may already have been disconnected by context closure.
        }
      }
      this.activeSources.delete(source);
    };
  }
}
