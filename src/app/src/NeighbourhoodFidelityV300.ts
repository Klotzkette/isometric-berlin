import moabit from "./data/moabitMitteV300.json";
import east from "./data/ostHousingV301.json";
import west from "./data/westKiezV302.json";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300, neighbourhoodPacketCandidateV300, type NeighbourhoodSourceV300, type NeighbourhoodTicketV300 } from "./NeighbourhoodPacketV300";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";

export function* captureNeighbourhoodFidelityV300(chunk: SurroundingCityChunk, id: string, native: boolean, enabled = false, westCoreReady = false): Generator<void, NeighbourhoodTicketV300[]> {
  return yield* captureNeighbourhoodFromSourcesV362(chunk, id, native, enabled, westCoreReady, east as unknown as NeighbourhoodSourceV300);
}

export function* captureNeighbourhoodFromSourcesV362(chunk: SurroundingCityChunk, id: string, native: boolean, enabled: boolean, westCoreReady: boolean, eastHousing?: NeighbourhoodSourceV300): Generator<void, NeighbourhoodTicketV300[]> {
  const tickets: NeighbourhoodTicketV300[] = [];
  if (!enabled) return tickets;
  const regions: readonly [NeighbourhoodSourceV300 | undefined, string][] = [
    [moabit as unknown as NeighbourhoodSourceV300, "moabit-mitte-v300"],
    [eastHousing, "ost-housing-v301"],
    [westCoreReady ? west as unknown as NeighbourhoodSourceV300 : undefined, "west-kiez-v302"],
  ];
  for (const [source, kind] of regions) {
    if (!source) continue;
    const ticket = yield* captureNeighbourhoodPacketV300(chunk, id, native, true, source, kind);
    if (ticket) tickets.push(ticket);
  }
  return tickets;
}
export function* prepareNeighbourhoodFidelityV300(chunk: SurroundingCityChunk, tickets: readonly NeighbourhoodTicketV300[]): Generator<void, SurroundingCityChunk> {
  for (const ticket of tickets) chunk = yield* prepareNeighbourhoodPacketV300(chunk, ticket);
  return chunk;
}

export const westKiezPacketCandidateV302 = (id:string,native=false):boolean => neighbourhoodPacketCandidateV300(west as unknown as NeighbourhoodSourceV300,id,native);
