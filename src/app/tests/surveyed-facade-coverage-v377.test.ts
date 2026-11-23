import { Mesh } from "three";
import { createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import routes from "../src/data/surveyedFacadeTilesV377.json";
import catalog from "../src/data/surveyedBuildingFacadesV377.json";
import {
  createSurveyedBuildingFacadesV377, verifiedSplitFacadePacketV377,
  type FacadeCatalogV377,
} from "../src/surveyedBuildingFacadesV377";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const root = resolve(import.meta.dir, "../../..");
const directory = resolve(root, "src/app/public/mesh/surrounding-berlin-v159");
const rank = JSON.parse(readFileSync(resolve(root, "geo_data/regierungsviertel/windowless-buildings-v377.json"), "utf8"));
const ids = rank.targets.map((target: {id:string}) => target.id).sort();
type Descriptor = { id: string; drawn: { url: string }; minecraft: { url: string } };
const descriptors: Descriptor[] = JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")).chunks;
const buildings = catalog as FacadeCatalogV377;

test("the published Drawn and native packet owners both produce real facade triangles for every ranked building", async () => {
  expect(new Set(ids).size).toBe(50);
  expect(routes).toEqual(Object.keys(buildings.tiles));
  const coverage = { drawn: new Set<string>(), minecraft: new Set<string>() };
  for (const key of routes) {
    const [family, tile] = key.split(":") as ["drawn" | "minecraft", string];
    const descriptor = descriptors.find(entry => entry.id === tile)!;
    const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(resolve(directory, descriptor[family].url))).toString("utf8"));
    const guard = verifiedSplitFacadePacketV377(key, packet);
    let result = guard.next();
    while (!result.done) result = guard.next();
    const shell = buildings.tiles[key].some(entry => entry.owner.startsWith("surveyed-shell:"));
    const entry = shell ? await createStreamedSurroundingCityChunkV255(packet, tile, false, { yield: async () => undefined }) : undefined;
    const model = entry ? entry.root.getObjectByName("Surveyed building facades v377") as Mesh | undefined
      : createSurveyedBuildingFacadesV377(tile, family === "minecraft", packet.origin,
        new Set(packet.nav.buildings.map(building => building.sourceId)), buildings, result.value);
    expect(model).toBeDefined();
    if (!model) continue;
    const registered = new Set<string>();
    let consumed = 0;
    for (const span of model.userData.facadeOwnersV377) {
      expect(span.start).toBe(consumed);
      expect(span.count).toBeGreaterThan(0);
      consumed += span.count;
      registered.add(span.id);
      coverage[family].add(span.id);
    }
    expect(consumed).toBe(model.geometry.index?.count);
    expect([...registered].sort()).toEqual([...new Set(buildings.tiles[key].map(plan => plan.id))].sort());
    if (entry) disposeSurroundingCityRoot(entry.root);
    else {
      model.geometry.dispose();
      model.userData.dayMaterial.dispose();
      if (model.userData.nightMaterial !== model.userData.dayMaterial) model.userData.nightMaterial.dispose();
    }
  }
  expect([...coverage.drawn].sort()).toEqual(ids);
  expect([...coverage.minecraft].sort()).toEqual(ids);
}, 30_000);
