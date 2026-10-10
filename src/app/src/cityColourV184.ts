import { Color } from "three";

// Restrained plaster/stone display families, not surveyed facade colours.
// Explicit material/colour sources and individually authored buildings win.
// v211 keeps all eight IDs in the same family while separating warm plaster,
// cool stone and muted mineral pigments a little more clearly at street scale.
export const GENERIC_FACADE_SWATCHES = [
  0xe2ceb0, 0xd4bba0, 0xe9dfc8, 0xbcc8b6,
  0xd8b7aa, 0xb7cccf, 0xd6c18f, 0xd1cfc3,
] as const;
const tones = GENERIC_FACADE_SWATCHES.map(value => new Color(value));

export function genericFacadeIndex(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % tones.length;
}

/** Shared read-only paint; callers copy/lerp it rather than mutate it. */
export function genericFacadeTone(id: string): Color {
  return tones[genericFacadeIndex(id)];
}
