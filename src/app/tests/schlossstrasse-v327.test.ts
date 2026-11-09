import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { InterleavedBufferAttribute, LineSegments, Mesh } from "three";
import { captureSourceQuarterPacketV303, type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import {
  buildSurroundingCityChunk,
  surroundingBuildingSolidAt,
  type SurroundingCityChunk,
  type SurroundingOwnershipOptions,
} from "../src/SurroundingCityGeometry";
import data from "../src/data/schlossstrasseV327Packets.json";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { berlinSenateSourceV321 } from "../src/BerlinSenateV321";

const SOURCE = data as unknown as SourceQuarterSourceV303;
const KIND = "schlossstrasse-v327";
const flags: SurroundingOwnershipOptions = {
  schlossplatzV239: true, staatsoperV240: true, architectureV241: true, mitteEnsembleV281: true,
  prenzlbergV264: true, chariteBridgesV265: true, operaTheatresV274: true, northernSitesV266: true,
  golgathaV270: true, tachelesFrontsV270: true, southFidelityV294: true, littenStadthausV297: true,
  wallGalleryV298: true, stralauSisyphosV299: true, neighbourhoodV300: true, westKiezV302: true,
  sourceQuartersV303: true, neukoellnLandmarksV305: true, northFidelityV309: true,
  treptowWaterfrontV317: true, governmentOfficesV321: true, universitiesV322: true,
  wilhelmHousingV324: true, wilhelmStreetFrontsV325: true, southWestSitesV326: true,
  clusterFacadesV320: clusterFacadesSourceV320, berlinSenateV321: berlinSenateSourceV321,
};

function drain<T>(work: Generator<void, T>): T {
  for (;;) {
    const next = work.next();
    if (next.done) return next.value;
  }
}

function rawPacket(key: string): SurroundingCityChunk {
  const [mode, id] = key.split(":");
  const path = new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url);
  return JSON.parse(gunzipSync(readFileSync(path)).toString()) as SurroundingCityChunk;
}

for (const key of SOURCE.keys) {
  test(`${key} replaces only its exact source family after the published road transaction`, async () => {
    const raw = rawPacket(key), snapshot = JSON.stringify(raw);
    const [mode, id] = key.split(":"), native = mode === "minecraft";
    const plan = SOURCE.packets[key];
    const catalogue = await loadSourceQuarterRecipesV309(id, native);
    expect(catalogue.map(entry => entry.kind)).toEqual(["network-fidelity-v326", KIND]);
    const older = catalogue.slice(0, -1);
    const before = drain(buildSurroundingCityChunk(raw, id, native, false, {
      ...flags, sourceQuarterSourcesV303: older,
    }));
    const after = drain(buildSurroundingCityChunk(raw, id, native, true, {
      ...flags, sourceQuarterSourcesV303: catalogue,
    }));
    try {
      expect(before.root.userData.sourceKinds).toContain("network-fidelity-v326");
      expect(after.root.userData.sourceKinds).toEqual([...before.root.userData.sourceKinds, KIND]);
      expect(after.root.userData.sourceQuarterOwnersV303).toEqual([
        ...before.root.userData.sourceQuarterOwnersV303, ...plan.owners,
      ]);
      const mesh = (before.root.children[0] as Mesh).geometry;
      const replacement = (after.root.children[0] as Mesh).geometry;
      const oldWords = (mesh.getAttribute("position") as InterleavedBufferAttribute).data.array;
      const newWords = (replacement.getAttribute("position") as InterleavedBufferAttribute).data.array;
      expect(Buffer.from(newWords.buffer, newWords.byteOffset, oldWords.byteLength)).toEqual(
        Buffer.from(oldWords.buffer, oldWords.byteOffset, oldWords.byteLength),
      );
      const priorIndex = mesh.index!.array;
      const nextIndex = replacement.index!.array;
      const retired = new Set(plan.retire[0].triangles);
      for (let at = 0; at < priorIndex.length; at += 3) {
        const old = [priorIndex[at], priorIndex[at + 1], priorIndex[at + 2]];
        const next = [nextIndex[at], nextIndex[at + 1], nextIndex[at + 2]];
        if (retired.has(at / 3)) {
          if (next.some(index => index !== old[0])) throw Error(`Undeleted source face ${at / 3}`);
        } else if (next.some((index, i) => index !== old[i])) throw Error(`Changed outside index ${at / 3}`);
      }
      const addedVertices = (newWords.length - oldWords.length) / 6;
      const addedIndices = nextIndex.length - priorIndex.length;
      expect(addedVertices).toBeGreaterThan(0);
      expect(addedIndices).toBeGreaterThan(0);
      expect(addedVertices * 12 + addedIndices * 4).toBeLessThan(130 * 1024);
      expect(after.geometryBytes).toBeLessThan(24 * 1024 * 1024);
      expect(after.bufferCount).toBe(before.bufferCount);
      if (!native) {
        const oldInk = ((before.root.children[1] as LineSegments).geometry.getAttribute("position") as InterleavedBufferAttribute).data.array;
        const newInk = ((after.root.children[1] as LineSegments).geometry.getAttribute("position") as InterleavedBufferAttribute).data.array;
        expect(newInk.length).toBe(oldInk.length);
        const retiredInk = new Set(plan.retireLines);
        for (let i = 0; i < oldInk.length; ++i) {
          const degenerated = retiredInk.has(Math.floor(i / 12)) && i % 12 >= 6 && i % 6 < 3;
          if (newInk[i] !== oldInk[degenerated ? i - 6 : i]) throw Error(`Changed outside ink word ${i}`);
        }
      } else {
        for (let i = priorIndex.length; i < nextIndex.length; i += 3) {
          const v = [nextIndex[i], nextIndex[i + 1], nextIndex[i + 2]];
          const cardinal = [0, 1, 2].some(axis =>
            newWords[v[0] * 6 + axis] === newWords[v[1] * 6 + axis] &&
            newWords[v[1] * 6 + axis] === newWords[v[2] * 6 + axis],
          );
          if (!cardinal) throw Error(`Non-cardinal Native face ${i / 3}`);
        }
      }
      const { buildings: previousBuildings, ...otherPrevious } = before.nav;
      const { buildings: nextBuildings, ...otherNext } = after.nav;
      expect(otherNext).toEqual(otherPrevious);
      expect(nextBuildings).toEqual([
        ...previousBuildings.filter(b => !plan.owners.includes(b.sourceId)),
        ...plan.appendNav,
      ]);
      if (id.endsWith("_12")) {
        const solid = (x: number, y: number, z: number) =>
          surroundingBuildingSolidAt(after.nav, x - after.origin[0], y, z - after.origin[2]);
        expect(solid(-3310.5, 5, 6316.5)).toBe(false);
        expect(solid(-3310.5, 36, 6316.5)).toBe(true);
        expect(solid(-3318.5, 7, 6314.5)).toBe(true);
      }
      expect(JSON.stringify(raw)).toBe(snapshot);
    } finally {
      disposeSurroundingCityRoot(before.root);
      disposeSurroundingCityRoot(after.root);
    }
  });
}

test("closed defaults, wrong source and cancelled preparation leave the originals intact", () => {
  const key = "drawn:ring182--7_12";
  const raw = rawPacket(key), snapshot = JSON.stringify(raw);
  const id = "ring182--7_12";
  expect(drain(captureSourceQuarterPacketV303(raw, id, false, false, SOURCE, KIND))).toBeUndefined();
  expect(drain(captureSourceQuarterPacketV303(raw, "ring182--7_13", false, true, SOURCE, KIND))).toBeUndefined();
  const badSource = structuredClone(raw);
  const colors = badSource.meshes[0].colors;
  badSource.meshes[0].colors = (colors[0] === "A" ? "B" : "A") + colors.slice(1);
  expect(drain(captureSourceQuarterPacketV303(badSource, id, false, true, SOURCE, KIND))).toBeUndefined();
  const work = captureSourceQuarterPacketV303(raw, id, false, true, SOURCE, KIND);
  expect(work.next().done).toBe(false);
  work.return(undefined);
  expect(JSON.stringify(raw)).toBe(snapshot);
});
