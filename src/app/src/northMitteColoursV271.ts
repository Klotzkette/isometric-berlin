import packetKeys from "./data/northMitteColoursV271Index.json";
import manifest from "./data/northMitteColoursV271.json";
import { applyAltMitteAppearanceV213, type AltMitteAppearanceSourceV213 } from "./altMitteAppearanceV213";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

const keys: ReadonlySet<string> = new Set(packetKeys);

/** Exact finite source sheets in Weinberg/Zion/Arkona/Kastanien only. Execute
 * after v213 and before later explicit material receipts. Original encoded
 * packet bytes remain the ownership proof; only final colour cells change.
 * The tiny eager key index rejects unrelated packets before reading the weak
 * construction field. No geometry, GPU storage, draw or per-frame work is added.
 */
export function* applyNorthMitteColoursV271(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, vertexCount: number,
  evidence: AltMitteAppearanceSourceV213 = manifest as AltMitteAppearanceSourceV213,
): Generator<void, number> {
  if (part.kind !== "alt-mitte-v169" || !keys.has(`${native ? "minecraft" : "drawn"}:${tile}`)) return 0;
  return yield* applyAltMitteAppearanceV213(tile, native, part, mesh, vertices, vertexOffset, vertexCount, evidence);
}
