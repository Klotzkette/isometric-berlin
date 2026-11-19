import {
  buildCityChunkWithPaletteV362, prepareSurroundingQuarterFromSourcesV362, type SurroundingCityChunk, type SurroundingOwnershipOptions,
} from "./SurroundingCityGeometry";
import { synchronousPrimaryColourBankV362 } from "./primaryColoursV273";

import crossingKerbs from "./cityKerbCrossingSourceV365";
import east from "./eastHousingSourceV362";
import mauerpark from "./mauerparkSourceV362";
import type { NeighbourhoodSourceV300 } from "./NeighbourhoodPacketV300";
import type { MauerparkTerrainEvidenceV298 } from "./MauerparkTerrainV298Packets";

const regionalSources = {
  eastHousing: east as unknown as NeighbourhoodSourceV300,
  mauerpark: mauerpark as unknown as MauerparkTerrainEvidenceV298,
};

export function* prepareSurroundingQuarterPredecessorV303(
  chunk: SurroundingCityChunk, id: string, native = false, ownership: SurroundingOwnershipOptions = {},
) {
  return yield* prepareSurroundingQuarterFromSourcesV362(chunk, id, native, ownership, regionalSources);
}

/** Standalone audit and export callers can construct an arbitrary tile synchronously. */
export function* buildSurroundingCityChunk(
  chunk: SurroundingCityChunk, id: string, native = false, parkBacking = false,
  ownership: SurroundingOwnershipOptions = {},
) {
  return yield* buildCityChunkWithPaletteV362(chunk, id, native, parkBacking, ownership,
    { ...regionalSources, crossingKerbs: crossingKerbs[`${native ? "minecraft" : "drawn"}:${id}`], primaryColours: synchronousPrimaryColourBankV362(id, native) });
}

export function createSurroundingCityChunk(
  chunk: SurroundingCityChunk, id: string, native = false, ownership: SurroundingOwnershipOptions = {},
) {
  const steps = buildSurroundingCityChunk(chunk, id, native, false, ownership);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}
