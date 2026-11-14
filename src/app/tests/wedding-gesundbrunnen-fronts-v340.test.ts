import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { BufferAttribute, InterleavedBufferAttribute, Mesh } from "three";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { buildSurroundingCityChunk, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { weddingGesundbrunnenFrontsV340 } from "../src/WeddingGesundbrunnenFrontsV340";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import recipe from "../src/data/weddingGesundbrunnenFrontsV340.json";

const { kind, keys } = weddingGesundbrunnenFrontsV340;
const source = recipe as NeighbourhoodSourceV300;
const priorCatalogue = SOURCE_QUARTER_CATALOGUE_V309.filter(entry => entry.kind !== kind);
const loadPrevious = createSourceQuarterRecipeLoaderV309(priorCatalogue);
const loadRefined = createSourceQuarterRecipeLoaderV309([...priorCatalogue, weddingGesundbrunnenFrontsV340]);
const settings: SurroundingOwnershipOptions = {
  sourceQuartersV303: true, neighbourhoodV300: true, westKiezV302: true,
  stralauSisyphosV299: true, northFidelityV309: true, southWestSitesV326: true,
  clusterFacadesV320: clusterFacadesSourceV320,
};
function meshWords(mesh: Mesh) {
  const position = mesh.geometry.getAttribute("position");
  return (position as InterleavedBufferAttribute).data?.array ?? (position as BufferAttribute).array;
}
const bytes = (array: ArrayBufferView, length = array.byteLength) => Buffer.from(array.buffer, array.byteOffset, length);
function drain<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}
function inputs(key: string) {
  const [mode, id] = key.split(":");
  const url = new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url);
  const original = JSON.parse(gunzipSync(readFileSync(url)).toString()) as SurroundingCityChunk;
  return { id, original, native: mode === "minecraft" };
}

for (const key of keys) {
  test(`${key} preserves original paint, ink and walking data with exact facade retirement`, async () => {
    const { id, original, native } = inputs(key);
    const snapshot = JSON.stringify(original), plan = source.packets[key];
    const before = await loadPrevious(id, native), after = await loadRefined(id, native);
    const build = (recipes: typeof before) => drain(buildSurroundingCityChunk(original, id, native, false, { ...settings, sourceQuarterSourcesV303: recipes }));
    const baseline = build(before), improved = build(after);
    try {
      expect(plan.owners).toHaveLength(4);
      expect(improved.root.userData.sourceKinds.filter((item: string) => item !== kind)).toEqual(baseline.root.userData.sourceKinds);
      expect(improved.root.userData.sourceKinds).toContain(kind);
      expect(improved.nav).toEqual(baseline.nav);
      expect(improved.bufferCount).toBe(baseline.bufferCount);
      expect(improved.geometryBytes - baseline.geometryBytes).toBeGreaterThan(0);
      expect(improved.geometryBytes - baseline.geometryBytes).toBeLessThan(256 * 1024);
      const oldBody = baseline.root.children[0] as Mesh, nextBody = improved.root.children[0] as Mesh;
      const oldWords = meshWords(oldBody), nextWords = meshWords(nextBody);
      expect(bytes(nextWords, oldWords.byteLength)).toEqual(bytes(oldWords));
      const oldIndices = oldBody.geometry.index!.array, nextIndices = nextBody.geometry.index!.array;
      const expected = oldIndices.slice();
      let removals = 0;
      for (const record of plan.retire) {
        expect(original.meshes[record.mesh].kind).toBe("district-facades-v188");
        const offset = original.meshes.slice(0, record.mesh).reduce((sum, mesh) => sum + Buffer.from(mesh.indices, "base64").byteLength / 4, 0);
        for (const triangle of record.triangles) {
          const at = offset + triangle * 3;
          expect(new Set(expected.slice(at, at + 3)).size).toBe(3);
          expected[at + 1] = expected[at + 2] = expected[at];
          removals++;
        }
      }
      expect(removals).toBe(id.startsWith("district188-") ? native ? 92 : 114 : 0);
      expect(bytes(nextIndices, expected.byteLength)).toEqual(bytes(expected));
      if (baseline.root.children[1]) expect(bytes(meshWords(improved.root.children[1] as Mesh))).toEqual(bytes(meshWords(baseline.root.children[1] as Mesh)));
      if (native) for (let i = oldIndices.length; i < nextIndices.length; i += 3) {
        const [a, b, c] = [nextIndices[i] * 6, nextIndices[i + 1] * 6, nextIndices[i + 2] * 6];
        if (![0, 1, 2].some(axis => nextWords[a + axis] === nextWords[b + axis] && nextWords[b + axis] === nextWords[c + axis])) {
          throw Error(`New Native triangle ${i / 3} left its cardinal plane`);
        }
      }
      expect(JSON.stringify(original)).toBe(snapshot);
    } finally {
      for (const result of [baseline, improved]) disposeSurroundingCityRoot(result.root);
    }
  });
}

test("disabled, foreign and changed packets preserve their previous fittings", () => {
  const { id, original } = inputs("drawn:district188--1_-8"), snapshot = JSON.stringify(original);
  expect(drain(captureNeighbourhoodPacketV300(original, id, false, false, source, kind))).toBeUndefined();
  expect(drain(captureNeighbourhoodPacketV300(original, "-1_-8", false, true, source, kind))).toBeUndefined();
  const modified = structuredClone(original);
  const positions = modified.meshes[0].positions;
  modified.meshes[0].positions = (positions[0] === "A" ? "B" : "A") + positions.slice(1);
  expect(drain(captureNeighbourhoodPacketV300(modified, id, false, true, source, kind))).toBeUndefined();
  const admission = captureNeighbourhoodPacketV300(original, id, false, true, source, kind);
  admission.next();
  admission.return(undefined);
  expect(JSON.stringify(original)).toBe(snapshot);
});
