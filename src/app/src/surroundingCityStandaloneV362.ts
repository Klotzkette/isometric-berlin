import { synchronousSurveyedPavingV368 } from "./synchronousSurveyedPavingV368";
import crossing0 from "./data/crossingPavingV368_0.json";
import crossing1 from "./data/crossingPavingV368_1.json";
import crossing2 from "./data/crossingPavingV368_2.json";
import crossing3 from "./data/crossingPavingV368_3.json";
import crossing4 from "./data/crossingPavingV368_4.json";
import crossing5 from "./data/crossingPavingV368_5.json";
import crossing6 from "./data/crossingPavingV368_6.json";
import crossing7 from "./data/crossingPavingV368_7.json";
import type { CrossingPavingBank } from "./crossingPavingV368";
import crossingOwners from "./data/crossingPavingOwnersV368.json";
import {
  buildCityChunkWithPaletteV362, prepareSurroundingQuarterFromSourcesV362, type SurroundingCityChunk, type SurroundingOwnershipOptions,
} from "./SurroundingCityGeometry";
import { synchronousPrimaryColourBankV362 } from "./primaryColoursV273";

import crossingKerbs from "./cityKerbCrossingSourceV365";
import east from "./eastHousingSourceV362";
import mauerpark from "./mauerparkSourceV362";
import type { NeighbourhoodSourceV300 } from "./NeighbourhoodPacketV300";
import type { MauerparkTerrainEvidenceV298 } from "./MauerparkTerrainV298Packets";

const crossingBanks: readonly CrossingPavingBank[] = [crossing0, crossing1, crossing2, crossing3, crossing4, crossing5, crossing6, crossing7];
const crossingTiles: Readonly<Record<string, number>> = crossingOwners;

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
    { ...regionalSources, surveyedPaving: native ? undefined : synchronousSurveyedPavingV368(id), crossingPaving: native ? undefined : crossingBanks[crossingTiles[id]]?.[id], crossingKerbs: crossingKerbs[`${native ? "minecraft" : "drawn"}:${id}`], primaryColours: synchronousPrimaryColourBankV362(id, native) });
}

export function createSurroundingCityChunk(
  chunk: SurroundingCityChunk, id: string, native = false, ownership: SurroundingOwnershipOptions = {},
) {
  const steps = buildSurroundingCityChunk(chunk, id, native, false, ownership);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}
