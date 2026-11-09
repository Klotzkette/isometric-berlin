import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { InterleavedBufferAttribute, Mesh } from "three";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { buildSurroundingCityChunk, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import recipe from "../src/data/heesestrasseV328Packets.json";

const source = recipe as unknown as NeighbourhoodSourceV300;
const id = "ring182--7_13", kind = "heesestrasse-v328";
const options: SurroundingOwnershipOptions = {
  sourceQuartersV303: true, neighbourhoodV300: true, westKiezV302: true,
  stralauSisyphosV299: true, northFidelityV309: true, southWestSitesV326: true,
};
function drain<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}
function raw(mode: string): SurroundingCityChunk {
  const url = new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url);
  return JSON.parse(gunzipSync(readFileSync(url)).toString()) as SurroundingCityChunk;
}
function stream(mesh: Mesh, attribute: string) {
  return (mesh.geometry.getAttribute(attribute) as InterleavedBufferAttribute).data.array;
}
function bytes(array: ArrayBufferView, length = array.byteLength) {
  return Buffer.from(array.buffer, array.byteOffset, length);
}
const loadPrevious = createSourceQuarterRecipeLoaderV309(
  SOURCE_QUARTER_CATALOGUE_V309.filter(entry => !entry.kind.endsWith("-v328")),
);
const excluded = ["DEBE06YYB00008wL", "DEBE06YYB0000waY", "DEBE06YYB0000AUq"];
for (const mode of ["drawn", "minecraft"]) {
  test(`Heesestraße ${mode} retains every original word and adds bounded wall details`, async () => {
    const native = mode === "minecraft", key = `${mode}:${id}`;
    const original = raw(mode), snapshot = JSON.stringify(original);
    const previous = await loadPrevious(id, native);
    const current = [...previous, { source, kind }];
    const plan = source.packets[key], otherPlan = clusterFacadesSourceV320.packets[key];
    expect(new Set(plan.owners).size).toBe(17);
    expect(plan.retire).toEqual([]);
    expect(plan.owners.some(owner => [...excluded, ...otherPlan.owners].includes(owner))).toBe(false);
    for (const owner of plan.owners) expect(original.nav.buildings.filter(b => b.sourceId === owner)).toHaveLength(1);
    const build = (settings: SurroundingOwnershipOptions) => drain(buildSurroundingCityChunk(original, id, native, false, settings));
    const baseline = build({ ...options, sourceQuarterSourcesV303: previous });
    const improved = build({ ...options, sourceQuarterSourcesV303: current });
    const complete = build({
      ...options, sourceQuarterSourcesV303: current, clusterFacadesV320: clusterFacadesSourceV320,
    });
    try {
      expect(baseline.root.userData.sourceKinds).toContain("network-fidelity-v326");
      expect(improved.root.userData.sourceKinds).toEqual([...baseline.root.userData.sourceKinds, kind]);
      expect(complete.root.userData.sourceKinds).toEqual([...improved.root.userData.sourceKinds, "cluster-facades-v320"]);
      expect(improved.nav).toEqual(baseline.nav);
      expect(complete.nav).toEqual(baseline.nav);
      expect(improved.bufferCount).toBe(baseline.bufferCount);
      expect(improved.geometryBytes - baseline.geometryBytes).toBeGreaterThan(0);
      expect(improved.geometryBytes - baseline.geometryBytes).toBeLessThan(256 * 1024);
      const a = baseline.root.children[0] as Mesh, b = improved.root.children[0] as Mesh;
      const oldVertices = stream(a, "position"), nextVertices = stream(b, "position");
      expect(bytes(nextVertices, oldVertices.byteLength)).toEqual(bytes(oldVertices));
      const oldIndices = a.geometry.index!.array, nextIndices = b.geometry.index!.array;
      expect(Array.from(nextIndices.subarray(0, oldIndices.length))).toEqual(Array.from(oldIndices));
      if (!native) expect(bytes(stream(improved.root.children[1] as Mesh, "position"))).toEqual(bytes(stream(baseline.root.children[1] as Mesh, "position")));
      if (native) for (let i = oldIndices.length; i < nextIndices.length; i += 3) {
        const [a, b, c] = [nextIndices[i] * 6, nextIndices[i + 1] * 6, nextIndices[i + 2] * 6];
        if (![0, 1, 2].some(axis => nextVertices[a + axis] === nextVertices[b + axis] &&
          nextVertices[b + axis] === nextVertices[c + axis])) throw Error(`Non-cardinal face ${i / 3}`);
      }
      expect(JSON.stringify(original)).toBe(snapshot);
    } finally {
      for (const result of [baseline, improved, complete]) disposeSurroundingCityRoot(result.root);
    }
  });
}

test("disabled, foreign and changed predecessors leave the old facades intact", () => {
  const original = raw("drawn"), snapshot = JSON.stringify(original);
  expect(drain(captureNeighbourhoodPacketV300(original, id, false, false, source, kind))).toBeUndefined();
  expect(drain(captureNeighbourhoodPacketV300(original, "ring182--7_12", false, true, source, kind))).toBeUndefined();
  const modified = structuredClone(original);
  const positions = modified.meshes[0].positions;
  modified.meshes[0].positions = (positions[0] === "A" ? "B" : "A") + positions.slice(1);
  expect(drain(captureNeighbourhoodPacketV300(modified, id, false, true, source, kind))).toBeUndefined();
  const steps = captureNeighbourhoodPacketV300(original, id, false, true, source, kind);
  expect(steps.next().done).toBe(false);
  steps.return(undefined);
  expect(JSON.stringify(original)).toBe(snapshot);
});
