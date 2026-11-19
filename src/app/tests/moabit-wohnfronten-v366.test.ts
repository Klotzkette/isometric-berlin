import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { GendarmenmarktFacadeBuilder } from "../src/GendarmenmarktFacadeBuilder";
import { appendMoabitWohnfrontenV366 } from "../src/MoabitWohnfrontenV366";
import sites from "../src/data/moabitWohnfrontenV366.json";
import type { VoxelPayload } from "../src/terrainPayload";

import { coreHousePaintV273, moabitRoofColourV366 } from "../src/CoreHouseColoursV273";
import roofSamples from "../src/data/moabitRoofSamplesV366.json";
import type { PrismBuilding } from "../src/IsometricCityWorld";

const file = (name: string) => JSON.parse(readFileSync(new URL(
  "../public/mesh/regierungsviertel/" + name + ".json", import.meta.url), "utf8"));
test("four documented Moabit fronts match shipped buildings and independent voxel faces", () => {
  const parts = file("lod2-prisms").buildings;
  const voxels: VoxelPayload = file("minecraft-voxels");
  for (const native of [false, true]) {
    const builder = new GendarmenmarktFacadeBuilder(native, false, 0);
    expect(appendMoabitWohnfrontenV366(builder, parts, native ? voxels : undefined)).toEqual(
      sites.map(site => site.prism.id));
    expect(builder.batches.get("glass")!.length).toBeGreaterThan(30);
    expect(builder.batches.get("stone")!.length).toBeGreaterThan(200);
    const changed = sites.map(site => ({...site.prism, h_dm: 9999}));
    expect(appendMoabitWohnfrontenV366(builder, changed, native ? voxels : undefined)).toEqual([]);
    // The adjacent Wilsnacker 61 also touches the search radius around no. 60.
    expect(appendMoabitWohnfrontenV366(builder, parts.filter((p: {id: string}) => p.id === "65243986"),
      native ? voxels : undefined)).toEqual([]);
  }
});
test("duplicated buildings and vacant cardinal cells do not acquire façades", () => {
  const originals = sites.map(s => s.prism);
  const b = new GendarmenmarktFacadeBuilder(false);
  expect(appendMoabitWohnfrontenV366(b,[...originals, ...originals])).toEqual([]);
  const v: VoxelPayload = file("minecraft-voxels");
  expect(appendMoabitWohnfrontenV366(new GendarmenmarktFacadeBuilder(true, false, 0),originals,
    {...v, building_rows: []})).toEqual([]);
});


test("orthophoto midtones attach only to their original residential roof records", () => {
  const roofs: Record<string, number[]> = roofSamples;
  const matched = new Set<string>();
  for (const part of file("lod2-prisms").buildings as PrismBuilding[]) {
    const sample = roofs[part.id];
    if (!sample) continue;
    const row = coreHousePaintV273(part);
    const result = moabitRoofColourV366(part.id, row);
    if (result === undefined) continue;
    expect(result).toBe(sample[2]);
    expect(moabitRoofColourV366(part.id, coreHousePaintV273({...part, h_dm: part.h_dm + 1}))).toBeUndefined();
    matched.add(part.id);
  }
  expect(matched.size).toBe(Object.keys(roofs).length);
});
