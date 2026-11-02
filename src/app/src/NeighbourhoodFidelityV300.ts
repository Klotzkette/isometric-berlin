import moabit from "./data/moabitMitteV300.json";
import east from "./data/ostHousingV301.json";
import west from "./data/westKiezV302.json";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300, neighbourhoodPacketCandidateV300, type NeighbourhoodSourceV300, type NeighbourhoodTicketV300 } from "./NeighbourhoodPacketV300";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";

const regions: readonly [NeighbourhoodSourceV300, string][] = [
  [moabit as unknown as NeighbourhoodSourceV300, "moabit-mitte-v300"],
  [east as unknown as NeighbourhoodSourceV300, "ost-housing-v301"],
  [west as unknown as NeighbourhoodSourceV300, "west-kiez-v302"],
];
/** The eager keys do not inflate the unrelated region or another tile. */
export function* captureNeighbourhoodFidelityV300(chunk: SurroundingCityChunk, id: string, native: boolean, enabled = false, westCoreReady = false): Generator<void, NeighbourhoodTicketV300[]> {
  const tickets: NeighbourhoodTicketV300[] = [];
  if (enabled) for (const [source, kind] of regions) {
    if (kind === "west-kiez-v302" && !westCoreReady) continue;
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
