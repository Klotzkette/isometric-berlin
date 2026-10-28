import previous from "./data/mitteEnsembleV281Previous.json";
import { transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";
import { mitteEnsembleV281Enabled } from "./mitteEnsembleV281Plan";

/** Only exact old estimated drawn windows yield after the required model exists. */
export function* transferMitteEnsembleTrianglesV281(
  enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (!enabled || !mitteEnsembleV281Enabled() || native || part.kind !== "alt-mitte-v169") return 0;
  return yield* transferExactPacketTriangles(previous.records, tile, native, part, indices, offset);
}
