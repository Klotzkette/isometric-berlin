import packetKeys from "./data/remainingAltMitteColoursV273Index.json";
import manifest from "./data/remainingAltMitteColoursV273.json";
import { applyAltMitteAppearanceV213, type AltMitteAppearanceSourceV213 } from "./altMitteAppearanceV213";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

const keys: ReadonlySet<string> = new Set(packetKeys);

/** Complete remaining v169 residential catalogue, after v213/v271 and before
 * explicit material writers. Every correction is independently bound to its
 * original drawn/native source streams. Unknown paint is a display estimate.
 * The eager index prevents unrelated packet loads from decoding weak receipts.
 */
export function* applyRemainingAltMitteColoursV273(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, vertexCount: number,
  evidence: AltMitteAppearanceSourceV213 = manifest as AltMitteAppearanceSourceV213,
): Generator<void, number> {
  if (part.kind !== "alt-mitte-v169" || !keys.has(`${native ? "minecraft" : "drawn"}:${tile}`)) return 0;
  return yield* applyAltMitteAppearanceV213(tile, native, part, mesh, vertices, vertexOffset, vertexCount, evidence);
}
