import source from "./data/kalkscheuneOwnershipV218.json";
import { transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

/** The required Kalkscheune facade replaces only its old estimated drawn
 * windows. Resident measured shells, roof ink and native voxels stay intact. */
export function* transferKalkscheuneFacadeV218(
  tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (native || tile !== "2_-2" || part.kind !== "alt-mitte-v169") return 0;
  return yield* transferExactPacketTriangles(source.records, tile, false, part, indices, offset);
}
