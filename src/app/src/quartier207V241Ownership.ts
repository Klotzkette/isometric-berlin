import previous from "./data/quartier207V241Previous.json";
import { transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

/** Replace audited generic drawn apertures only after the required glass model exists. */
export function* transferQuartier207TrianglesV241(
  enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (!enabled || native || part.kind !== "alt-mitte-v169") return 0;
  return yield* transferExactPacketTriangles(previous.records, tile, native, part, indices, offset);
}
