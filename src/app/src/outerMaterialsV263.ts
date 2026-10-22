import manifest from "./data/outerMaterialsV263.json";
import { applyOuterMaterialsV232 } from "./outerMaterialsV232";
import type { AltMitteAppearanceSourceV213 } from "./altMitteAppearanceV213";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

const source = manifest as AltMitteAppearanceSourceV213;

/** Exact retained material observations on previously omitted legacy packets.
 * Only validated existing colour cells change; no geometry or GPU storage. */
export function* applyOuterMaterialsV263(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, count: number,
  evidence: AltMitteAppearanceSourceV213 = source,
): Generator<void, number> {
  return yield* applyOuterMaterialsV232(tile, native, part, mesh, vertices,
    vertexOffset, count, evidence);
}
