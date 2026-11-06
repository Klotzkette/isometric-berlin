import data from "./data/berlinSenateV321.json";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300,
  neighbourhoodPacketCandidateV300, type NeighbourhoodSourceV300,
  type NeighbourhoodTicketV300 } from "./NeighbourhoodPacketV300";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";

export const BERLIN_SENATE_KIND_V321 = "berlin-senate-v321";
export const berlinSenateSourceV321 = data as unknown as NeighbourhoodSourceV300;

/** Exact existing packets own these three finite public exterior refinements.
 * The caller supplies this source only to the main-thread city controller. */
export function berlinSenatePacketCandidateV321(id: string, native = false): boolean {
  return neighbourhoodPacketCandidateV300(berlinSenateSourceV321, id, native);
}

export function* captureBerlinSenateV321(
  chunk: SurroundingCityChunk, id: string, native = false, enabled = false,
): Generator<void, NeighbourhoodTicketV300 | undefined> {
  return yield* captureNeighbourhoodPacketV300(chunk, id, native, enabled,
    berlinSenateSourceV321, BERLIN_SENATE_KIND_V321);
}

export function* prepareBerlinSenateV321(
  chunk: SurroundingCityChunk, ticket?: NeighbourhoodTicketV300,
): Generator<void, SurroundingCityChunk> {
  return yield* prepareNeighbourhoodPacketV300(chunk, ticket);
}
