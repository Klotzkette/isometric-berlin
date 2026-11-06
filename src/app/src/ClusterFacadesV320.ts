import data from "./data/clusterFacadesV320.json";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300,
  neighbourhoodPacketCandidateV300, type NeighbourhoodSourceV300,
  type NeighbourhoodTicketV300 } from "./NeighbourhoodPacketV300";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";

export const CLUSTER_FACADES_KIND_V320 = "cluster-facades-v320";
export const clusterFacadesSourceV320 = data as unknown as NeighbourhoodSourceV300;
const source = clusterFacadesSourceV320;

/** The small eager key index rejects unrelated tiles before a weak recipe is
 * read. Source admission, complete append and old fitting retirement retain
 * the established full packet transaction and its unchanged limits. */
export function clusterFacadePacketCandidateV320(id: string, native = false): boolean {
  return neighbourhoodPacketCandidateV300(source, id, native);
}

export function* captureClusterFacadesV320(
  chunk: SurroundingCityChunk, id: string, native = false, enabled = false,
  evidence: NeighbourhoodSourceV300 = source,
): Generator<void, NeighbourhoodTicketV300 | undefined> {
  return yield* captureNeighbourhoodPacketV300(chunk, id, native, enabled,
    evidence, CLUSTER_FACADES_KIND_V320);
}

export function* prepareClusterFacadesV320(
  chunk: SurroundingCityChunk, ticket?: NeighbourhoodTicketV300,
): Generator<void, SurroundingCityChunk> {
  return yield* prepareNeighbourhoodPacketV300(chunk, ticket);
}
