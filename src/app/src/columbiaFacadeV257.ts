import data from "./data/columbiahalleV257.json";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

/** An exact prior replacement fingerprint gates the photographed correction.
 * Existing city batch, four measured parts and every navigation record survive. */
export function* columbiaFacadeV257(original: SurroundingPackedMesh, native: boolean): Generator<void, SurroundingPackedMesh> {
  const correction = data[native ? "minecraft" : "drawn"];
  let value = 2166136261;
  for (const text of [original.positions, original.colors, original.indices])
    for (let start = 0; start < text.length; start += 65536) {
      for (let i = start; i < Math.min(text.length, start + 65536); i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
      yield;
    }
  return value === correction.fingerprint ? correction.replacement as SurroundingPackedMesh : original;
}
