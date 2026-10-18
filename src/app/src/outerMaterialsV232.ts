import manifest from "./data/outerMaterialsV232.json";
import { applyAltMitteAppearanceV213, type AltMitteAppearanceSourceV213 } from "./altMitteAppearanceV213";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

const source = manifest as AltMitteAppearanceSourceV213;

/** Exact retained ordinary outer-owner material receipts. No geometry, extra
 * buffer, texture or per-frame work: reuse the bounded validated colour writer.
 * The kind adapter is local; original packet identity and bytes stay untouched. */
export function* applyOuterMaterialsV232(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, count: number,
  evidence: AltMitteAppearanceSourceV213 = source,
): Generator<void, number> {
  if (part.kind !== "city" || !Object.prototype.hasOwnProperty.call(evidence.packets,
    `${native ? "minecraft" : "drawn"}:${tile}`)) return 0;
  return yield* applyAltMitteAppearanceV213(tile, native,
    { ...part, kind: "alt-mitte-v169" }, mesh, vertices, vertexOffset, count, evidence);
}
