import { Color } from "three";

// Restrained plaster/stone display families, not surveyed facade colours.
// Explicit material/colour sources and individually authored buildings win.
// v217 keeps all eight existing family assignments. A little less white in
// these illustration swatches makes ordinary streets legible alongside the
// individually researched buildings; it is not new per-house colour evidence.
export const GENERIC_FACADE_SWATCHES = [
  0xddc29e, 0xcba989, 0xe9dcc0, 0xafc0a7,
  0xd4a596, 0xa8c4cb, 0xd2b679, 0xc6c6b8,
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
