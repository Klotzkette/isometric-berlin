import kerbOwners from "./data/cityKerbCrossingOwnersV365.json";
import type { CrossingKerbPlan } from "./cityKerbCrossingsV365";
import index from "./data/primaryColoursV273Index.json";
import type { GreyClusterColourSourceV263 } from "./greyClusterColoursV263";

const kerbTiles = new Set<string>(kerbOwners);

const locations: Readonly<Record<string, number>> = index;

export function primaryColourBankIndexV362(id: string, native: boolean): number | undefined {
  return locations[`${native ? "minecraft" : "drawn"}:${id}`];
}

export async function loadPrimaryColourBankV362(bank: number): Promise<GreyClusterColourSourceV263> {
  const name = String(bank).padStart(2, "0");
  const module = await import(`./data/primaryColoursV273_${name}.json?colour-bank`);
  return module.default as GreyClusterColourSourceV263;
}

import type { NeighbourhoodSourceV300 } from "./NeighbourhoodPacketV300";
import type { MauerparkTerrainEvidenceV298 } from "./MauerparkTerrainV298Packets";
import type { SurroundingOwnershipOptions } from "./SurroundingCityGeometry";

export type SurroundingDetailSourcesV362 = {
  crossingKerbs?: CrossingKerbPlan;
  primaryColours?: GreyClusterColourSourceV263;
  eastHousing?: NeighbourhoodSourceV300;
  mauerpark?: MauerparkTerrainEvidenceV298;
};

const eastTiles = new Set([
  "6_-1", "6_0", "6_4", "7_0",
  "7_1", "8_-1", "8_0", "8_1",
  "8_4", "district188-7_1", "district188-8_-1", "district188-8_4",
  "district188-ring182-12_1", "district188-ring182-5_5", "ring182-11_0", "ring182-5_5",
]);
const mauerparkTiles = new Set(["3_-6", "3_-5", "4_-6", "4_-5"]);

export async function loadSurroundingDetailSourcesV362(id: string, native: boolean, ownership: SurroundingOwnershipOptions): Promise<SurroundingDetailSourcesV362> {
  const bank = primaryColourBankIndexV362(id, native);
  const [primaryColours, east, mauerpark, kerbs] = await Promise.all([
    bank === undefined ? undefined : loadPrimaryColourBankV362(bank),
    ownership.neighbourhoodV300 && eastTiles.has(id) ? import("./eastHousingSourceV362") : undefined,
    ownership.wallGalleryV298 && mauerparkTiles.has(id) ? import("./mauerparkSourceV362") : undefined,
    kerbTiles.has(id) ? import("./cityKerbCrossingSourceV365") : undefined,
  ]);
  return {
    primaryColours,
    crossingKerbs: kerbs?.default[`${native ? "minecraft" : "drawn"}:${id}`],
    eastHousing: east?.default as unknown as NeighbourhoodSourceV300 | undefined,
    mauerpark: mauerpark?.default as unknown as MauerparkTerrainEvidenceV298 | undefined,
  };
}
