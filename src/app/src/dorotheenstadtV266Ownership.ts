import previous from './data/dorotheenstadtV266Previous.json';
import { transferExactPacketTriangles } from './exactPacketTransfer';
import type { SurroundingPackedMesh } from './SurroundingCityGeometry';

/** Only the four audited generic drawn fronts yield after the required model exists. */
export function* transferDorotheenstadtTrianglesV266(
  enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  if (!enabled || native || part.kind !== 'alt-mitte-v169') return 0;
  return yield* transferExactPacketTriangles(previous.records,tile,native,part,indices,offset);
}
