import { Color } from "three";
import { ORDINARY_FACADE_TONES } from "./ordinaryFacadeTones";

// Keep the eight stable fallback assignments. Source and authored paint take
// precedence over these estimates.
export const GENERIC_FACADE_SWATCHES = [
  ORDINARY_FACADE_TONES[0], ORDINARY_FACADE_TONES[1], ORDINARY_FACADE_TONES[2], ORDINARY_FACADE_TONES[3],
  ORDINARY_FACADE_TONES[4], ORDINARY_FACADE_TONES[5], ORDINARY_FACADE_TONES[6], ORDINARY_FACADE_TONES[7],
] as const;
const tones = GENERIC_FACADE_SWATCHES.map(value => new Color(value));

// Original swatches used in the verified public-architecture mesh receipts.
export const OFFICE_FACADE_SWATCHES_V362 = [0xddc29e, 0xcba989, 0xe9dcc0, 0xafc0a7,
  0xd4a596, 0xa8c4cb, 0xd2b679, 0xc6c6b8] as const;
const officeTones = OFFICE_FACADE_SWATCHES_V362.map(value => new Color(value));

export function genericFacadeIndex(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % tones.length;
}

/** Shared read-only paint; callers copy/lerp it rather than mutate it. */
export function genericFacadeTone(id: string, retainedOffice = false): Color {
  return (retainedOffice ? officeTones : tones)[genericFacadeIndex(id)];
}
