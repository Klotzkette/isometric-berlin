import manifest from "./data/outerMaterialsV254.json";
import { applyOuterMaterialsV232 } from "./outerMaterialsV232";
import type { AltMitteAppearanceSourceV213 } from "./altMitteAppearanceV213";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

const source = manifest as AltMitteAppearanceSourceV213;

/** Previously omitted Ringbahn/southern packets, with their own exact receipts.
 * Reuse the yielded validated colour writer and existing destination buffer. */
export function* applyOuterMaterialsV254(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, count: number,
  evidence: AltMitteAppearanceSourceV213 = source,
): Generator<void, number> {
  return yield* applyOuterMaterialsV232(tile, native, part, mesh, vertices,
    vertexOffset, count, evidence);
}
