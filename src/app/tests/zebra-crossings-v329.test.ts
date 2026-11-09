import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { InterleavedBufferAttribute, Mesh } from "three";
import { berlinSenateSourceV321 } from "../src/BerlinSenateV321";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import index from "../src/data/zebraCrossingsV329Index.json";
import access from "../src/data/ubahnAccessV326.json";
import type { SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import {
  buildSurroundingCityChunk, surroundingPolygonContains,
  type SurroundingChunkGeometry, type SurroundingCityChunk, type SurroundingOwnershipOptions,
} from "../src/SurroundingCityGeometry";
import { ubahnCandidatesV326 } from "../src/UbahnGroundRuntimeV326";

const kind = "zebra-crossings-v329";
const points = new Map(access.entries.map(row => [row.id, row.point]));
const read = (path: string) => readFileSync(new URL(path, import.meta.url));
const manifest = JSON.parse(read("../public/mesh/surrounding-berlin-v159/manifest.json").toString()) as {
  chunks: { id: string; drawn: { url: string }; minecraft: { url: string } }[];
};
const opts: SurroundingOwnershipOptions = {
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
    const n = work.next();
    if (n.done) return n.value;
  }
}
function packet(id: string, mode: "drawn" | "minecraft") {
  const desc = manifest.chunks.find(row => row.id === id)![mode];
  const bytes = read("../public/mesh/surrounding-berlin-v159/" + desc.url);
  return JSON.parse((desc.url.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString()) as SurroundingCityChunk;
}
function actualMesh(result: SurroundingChunkGeometry) {
  return result.root.children.find(c => (c as Mesh).isMesh) as Mesh;
}
function words(mesh: Mesh) {
  return {
    vertices: (mesh.geometry.attributes.position as InterleavedBufferAttribute).data.array,
    indices: mesh.geometry.index!.array,
  };
}

async function previousRecipes(id: string, native: boolean) {
  const { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } = await import("../src/SourceQuarterCatalogueV309");
  return createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(entry =>
    !["public-green-v329", "park-paths-v329", kind].includes(entry.kind)))(id, native);
}

test("every zebra packet excludes the original U-Bahn ground-mask hosts", () => {
  for (const { keys } of index.sources) for (const key of keys) {
    const [mode, id] = key.split(":") as ["drawn" | "minecraft", string];
    const raw = packet(id, mode);
    const [x, , z] = raw.origin;
    const eligible = ubahnCandidatesV326([x, z, x + 512, z + 512]).filter(id => {
      const p = points.get(id)!;
      const contains = (rows: typeof raw.nav.ground) => rows.some(r => surroundingPolygonContains(r, p[0] - x, p[1] - z));
      return contains(raw.nav.ground) && !contains(raw.nav.water);
    });
    expect(eligible).toEqual([]);
  }
}, 30_000);

for (const id of ["ring182-12_3", "-7_4", "-10_6"]) {
  for (const mode of ["drawn", "minecraft"] as const) test(`${mode} ${id} admits exact road paint after older geometry`, async () => {
    const native = mode === "minecraft", key = `${mode}:${id}`;
    const shard = index.sources.find(row => row.keys.includes(key))!;
    const source = JSON.parse(read("../src/data/" + shard.file).toString()) as SourceQuarterSourceV303;
    const raw = packet(id, mode);
    const snapshot = JSON.stringify(raw);
    const recipes = await previousRecipes(id, native);
    const baseline = drain(buildSurroundingCityChunk(raw, id, native, false, { ...opts, sourceQuarterSourcesV303: recipes }));
    const actual = drain(buildSurroundingCityChunk(raw, id, native, false, {
      ...opts, sourceQuarterSourcesV303: [...recipes, { source, kind }],
    }));
    try {
      expect(actual.root.userData.sourceKinds).toEqual([...baseline.root.userData.sourceKinds, kind]);
      expect(actual.nav).toEqual(baseline.nav);
      expect(actual.bufferCount).toBe(baseline.bufferCount);
      const oldMesh = actualMesh(baseline), newMesh = actualMesh(actual);
      const oldWords = words(oldMesh), newWords = words(newMesh);
      expect(Buffer.from(newWords.vertices.buffer, newWords.vertices.byteOffset, oldWords.vertices.byteLength))
        .toEqual(Buffer.from(oldWords.vertices.buffer, oldWords.vertices.byteOffset, oldWords.vertices.byteLength));
      expect(Array.from(newWords.indices.subarray(0, oldWords.indices.length))).toEqual(Array.from(oldWords.indices));
      expect(newMesh.geometry.groups[0]).toEqual({ start: 0, count: oldWords.indices.length, materialIndex: 0 });
      expect(Array.isArray(newMesh.material) && newMesh.material[1].polygonOffset).toBe(true);
      expect(newMesh.geometry.groups[1].count).toBeGreaterThan(0);
      const added = newWords.vertices.subarray(oldWords.vertices.length);
      for (let i = 1; i < added.length; i += 6) expect(added[i] * .01 + raw.origin[1]).toBeCloseTo(3.10, 6);
      expect(JSON.stringify(raw)).toBe(snapshot);
    } finally {
      disposeSurroundingCityRoot(actual.root);
      disposeSurroundingCityRoot(baseline.root);
    }
  });
}
