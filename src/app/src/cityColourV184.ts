import { Color } from "three";

// Restrained plaster/stone display families, not surveyed facade colours.
// Explicit material/colour sources and individually authored buildings win.
export const GENERIC_FACADE_SWATCHES = [
  0xe3d5bb, 0xdac7ac, 0xeee3cd, 0xcbd0bf,
  0xdfc8bd, 0xc7d2d2, 0xddcda7, 0xdad7cc,
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
