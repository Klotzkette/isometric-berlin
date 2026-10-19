import previous from "./data/ihzV241Previous.json";
import { transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

/** Replace audited generic drawn apertures only after the required facade model exists. */
export function* transferIHZTrianglesV241(
  enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (!enabled || native || part.kind !== "alt-mitte-v169") return 0;
  return yield* transferExactPacketTriangles(previous.records, tile, native, part, indices, offset);
}
