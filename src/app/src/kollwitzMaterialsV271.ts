import manifest from "./data/kollwitzMaterialsV271.json";
import index from "./data/kollwitzMaterialsV271Index.json";
import { applyOuterMaterialsV232 } from "./outerMaterialsV232";
import type { AltMitteAppearanceSourceV213 } from "./altMitteAppearanceV213";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

const source = manifest as AltMitteAppearanceSourceV213;

/** Finite ordinary Kollwitz and northern Kastanienallee owners only. Exact immutable source receipts replace
 * generic fallback paint, preserving each existing wall/roof/window triangle.
 * All mapped/authored material owners are excluded offline. Apply after v263;
 * original source positions, colour strings and indices remain unchanged. */
export function* applyKollwitzMaterialsV271(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, count: number,
  evidence: AltMitteAppearanceSourceV213 = source,
): Generator<void, number> {
  if (part.kind !== "city" || !index.keys.includes(`${native ? "minecraft" : "drawn"}:${tile}`)) return 0;
  return yield* applyOuterMaterialsV232(tile, native, part, mesh, vertices,
    vertexOffset, count, evidence);
}
