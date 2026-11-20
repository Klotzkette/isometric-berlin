import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { InterleavedBufferAttribute, Material, Mesh } from "three";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { createMinecraftMaterialState, disposeMinecraftMaterialState, setMinecraftMaterialPresentation } from "../src/visual-modes/minecraft/materialMode";
import { berlinSenateSourceV321 } from "../src/BerlinSenateV321";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { buildSurroundingCityChunk, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import index from "../src/data/parkPathsV329Index.json";
import recipe from "../src/data/parkPathsV329Packets.json";
import manifest from "../public/mesh/surrounding-berlin-v159/manifest.json";

const kind = "park-paths-v329";
const source = recipe as unknown as NeighbourhoodSourceV300;
const descriptors = new Map(manifest.chunks.map(chunk => [chunk.id, chunk]));
const catalogue = createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309);
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
function drain<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}
function loadRaw(id: string, native: boolean): SurroundingCityChunk {
  const descriptor = descriptors.get(id)!;
  const path = descriptor[native ? "minecraft" : "drawn"].url;
  const raw = readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${path}`, import.meta.url));
  return JSON.parse((path.endsWith(".gz") ? gunzipSync(raw) : raw).toString()) as SurroundingCityChunk;
}
function byteView(values: ArrayBufferView, length = values.byteLength) {
  return Buffer.from(values.buffer, values.byteOffset, length);
}

test("the finite lazy catalogue indexes all 53 physical park path packets", () => {
  expect(index.sources).toEqual([{ file: "parkPathsV329Packets.json", keys: source.keys }]);
  expect(source.keys.length).toBe(53);
});

test.each(source.keys)("the physical park path packet renders in %s", async key => {
  const [mode, id] = key.split(":"), native = mode === "minecraft";
  const raw = loadRaw(id, native), loaded = await catalogue(id, native);
  const entry = loaded.find(item => item.kind === kind);
  expect(entry).toBeDefined();
  expect(source.packets[key].retire).toEqual([]);
  const current = drain(buildSurroundingCityChunk(raw, id, native, false, {
    ...flags,
    sourceQuarterSourcesV303: loaded.filter(item => !item.kind.endsWith("-v329") || item.kind === kind),
  }));
  try {
    expect(current.root.userData.sourceKinds).toContain(kind);
    expect(current.geometryBytes).toBeLessThan(24 * 1024 * 1024);
    const ground = current.root.children[0] as Mesh;
    expect(ground.geometry.groups).toHaveLength(2);
    // Additional road finishes can share this group. Verify every path vertex
    // and triangle against the survey at its actual offset in the combined buffer.
    const path = source.packets[key].append;
    const group = ground.geometry.groups[1];
    const indices = Buffer.from(path.indices, "base64");
    const positions = Buffer.from(path.positions, "base64");
    const rendered = ground.geometry.index!.array;
    const base = rendered[group.start] - indices.readUInt32LE(0);
    const vertices = (ground.geometry.getAttribute("position") as InterleavedBufferAttribute).data;
    const actualVertices = Buffer.alloc(positions.length);
    for (let v = 0; v < positions.length / 6; v++) {
      const start = (base + v) * vertices.stride;
      for (let axis = 0; axis < 3; axis++) actualVertices.writeUInt16LE(vertices.array[start + axis], v * 6 + axis * 2);
    }
    expect(actualVertices.equals(positions)).toBe(true);
    expect(group.count).toBeGreaterThanOrEqual(indices.length / 4);
    const expected = Array.from({ length: indices.length / 4 }, (_, i) => base + indices.readUInt32LE(i * 4));
    expect(Array.from(rendered.subarray(group.start, group.start + expected.length))).toEqual(expected);
    expect((ground.material as Material[])[1].polygonOffset).toBe(true);
  } finally {
    disposeSurroundingCityRoot(current.root);
  }
}, 60_000);

for (const key of ["drawn:ring182-6_7", "minecraft:ring182-5_7", "drawn:-12_2", "minecraft:north190-12_-8"]) {
  test(`park path presentation retains geometry, ink and walking in ${key}`, async () => {
    const [mode, id] = key.split(":"), native = mode === "minecraft";
    const raw = loadRaw(id, native), saved = JSON.stringify(raw);
    const recipes = (await catalogue(id, native)).filter(item => !item.kind.endsWith("-v329") || item.kind === kind);
    const before = drain(buildSurroundingCityChunk(raw, id, native, false, {
      ...flags, groundOverlaysV329: false, sourceQuarterSourcesV303: recipes,
    }));
    const after = drain(buildSurroundingCityChunk(raw, id, native, true, {
      ...flags, sourceQuarterSourcesV303: recipes,
    }));
    try {
      expect(before.root.userData.sourceKinds).not.toContain(kind);
      expect(after.root.userData.sourceKinds).toContain(kind);
      expect(after.root.userData.sourceKinds.filter((entry: string) => entry !== kind))
        .toEqual(before.root.userData.sourceKinds);
      expect(after.nav).toEqual(before.nav);
      const old = (before.root.children[0] as Mesh).geometry;
      const current = (after.root.children[0] as Mesh).geometry;
      const a = (old.getAttribute("position") as InterleavedBufferAttribute).data.array;
      const b = (current.getAttribute("position") as InterleavedBufferAttribute).data.array;
      // Park paths precede the independently attached street finishes. Removing
      // precisely their insertion must restore every old vertex and triangle.
      const path = source.packets[key].append;
      const pathCount = Buffer.from(path.positions, "base64").length / 6;
      const pathIndex = Buffer.from(path.indices, "base64");
      const start = current.groups[1].start;
      const offset = current.index!.array[start] - pathIndex.readUInt32LE(0);
      const stride = (old.getAttribute("position") as InterleavedBufferAttribute).data.stride;
      expect(byteView(b.subarray(0, offset * stride))).toEqual(byteView(a.subarray(0, offset * stride)));
      expect(byteView(b.subarray((offset + pathCount) * stride))).toEqual(byteView(a.subarray(offset * stride)));
      const rendered = current.index!.array;
      expect(Array.from(rendered.subarray(0, start))).toEqual(Array.from(old.index!.array.subarray(0, start)));
      expect(Array.from(rendered.subarray(start + pathIndex.length / 4), value => value - pathCount))
        .toEqual(Array.from(old.index!.array.subarray(start)));
      expect(current.groups[0]).toEqual({ start: 0, count: start, materialIndex: 0 });
      if (!native && before.root.children[1] && after.root.children[1]) {
        const oldInk = ((before.root.children[1] as Mesh).geometry.getAttribute("position") as InterleavedBufferAttribute).data.array;
        const newInk = ((after.root.children[1] as Mesh).geometry.getAttribute("position") as InterleavedBufferAttribute).data.array;
        expect(byteView(newInk)).toEqual(byteView(oldInk));
      }
      const mesh = after.root.children[0] as Mesh;
      const groups = structuredClone(current.groups);
      if (native) {
        const original = mesh.material;
        const materialState = createMinecraftMaterialState();
        try {
          setMinecraftMaterialPresentation(after.root, materialState, true);
          const toon = mesh.material as Material[];
          expect(toon).toHaveLength(2);
          expect(toon.every(material => material.type === "MeshToonMaterial")).toBe(true);
          expect(toon[0].polygonOffset).toBe(false);
          expect(toon[1].polygonOffset).toBe(true);
          setMinecraftMaterialPresentation(after.root, materialState, false);
          expect(mesh.material).toBe(original);
        } finally {
          disposeMinecraftMaterialState(materialState);
        }
      } else {
        const day = mesh.userData.groundOverlayDayV329 as Material;
        const night = mesh.userData.groundOverlayNightV329 as Material;
        setIsoNightPresentation(after.root, true, true, "night");
        expect((mesh.material as Material[])[1]).toBe(night);
        expect(night.polygonOffset).toBe(true);
        setIsoNightPresentation(after.root, false, true, "schwellenraum");
        const grade = (mesh.material as Material[])[1];
        expect(grade.userData.schwellenraumMaterialGrade).toBe(true);
        expect(grade.polygonOffset).toBe(true);
        setIsoNightPresentation(after.root, false, true, "day");
        expect((mesh.material as Material[])[1]).toBe(day);
        expect(day.polygonOffset).toBe(true);
      }
      expect(current.groups).toEqual(groups);
      expect(JSON.stringify(raw)).toBe(saved);
    } finally {
      disposeSurroundingCityRoot(before.root);
      disposeSurroundingCityRoot(after.root);
    }
  });
}

test("foreign and altered source never prepare park paths", () => {
  const id = "ring182-6_7", raw = loadRaw(id, false);
  expect(drain(captureNeighbourhoodPacketV300(raw, "3_-3", false, true, source, kind))).toBeUndefined();
  expect(drain(captureNeighbourhoodPacketV300(raw, id, false, false, source, kind))).toBeUndefined();
  const color = raw.meshes[0].colors;
  raw.meshes[0].colors = (color[0] === "A" ? "B" : "A") + color.slice(1);
  expect(drain(captureNeighbourhoodPacketV300(raw, id, false, true, source, kind))).toBeUndefined();
});

test("park paths reconcile only the surveyed sports append for the matching host", () => {
  const id = "outer187--7_15";
  const raw = loadRaw(id, false);
  const capture = () => drain(captureNeighbourhoodPacketV300(raw, id, false, true, source, kind));
  expect(capture()).toBeFunction();
  const sports = raw.meshes.pop()!;
  expect(capture()).toBeFunction();
  raw.meshes.push({ ...sports, colors: (sports.colors[0] === "A" ? "B" : "A") + sports.colors.slice(1) });
  expect(capture()).toBeUndefined();
  raw.meshes.push(sports);
  expect(capture()).toBeUndefined();
});
