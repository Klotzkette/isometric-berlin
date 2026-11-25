import { expect, test } from "bun:test";
import { Group, InterleavedBufferAttribute, Mesh, Raycaster, Vector3 } from "three";
import { createAltMitteCoreV169FromSource, type AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import { MALL_PIAZZA_LOD2_PARENT } from "../src/mallBridgeNavigationV385";
import { retireRegisteredAltMitteGeometry, type AltMitteRegistrationV385 } from "../src/registeredAltMitteGeometryV385";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import planSource from "../src/data/mallAltMitteV385.json";

const id = "1_1-piece-1";
const plan = planSource as unknown as AltMitteRegistrationV385;
type Corner = [number, number, number];

async function input(): Promise<AltMitteCoreV169Source> {
  const file = new URL("../src/data/altMitteV169Native/packet-046.json", import.meta.url);
  const packet = await Bun.file(file).json() as SurroundingCityChunk & { id: string };
  expect(packet.id).toBe(id);
  const chunks = [{ id, packet }];
  return { schemaVersion: 1, sourceParents: [], drawnChunks: chunks, minecraftChunks: chunks };
}

function soleMesh(root: Group) {
  const meshes: Mesh[] = [];
  root.traverse(child => { if (child instanceof Mesh) meshes.push(child); });
  expect(meshes.length).toBe(1);
  const mesh = meshes[0];
  expect(mesh.geometry.groups.length).toBe(0);
  expect(Array.isArray(mesh.material)).toBe(false);
  return mesh;
}

function packedMesh(mesh: Mesh) {
  const position = mesh.geometry.getAttribute("position");
  const color = mesh.geometry.getAttribute("color");
  if (!(position instanceof InterleavedBufferAttribute) || !(color instanceof InterleavedBufferAttribute)
    || position.data !== color.data || position.data.stride !== 6
    || !(position.data.array instanceof Uint16Array) || !mesh.geometry.index)
    throw new Error("Expected the original centimetre/RGB packet");
  return { words: position.data.array, index: mesh.geometry.index, count: position.count };
}

function signedArea(a: Corner, b: Corner, c: Corner) {
  return ((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 20_000;
}

function vertex(words: Uint16Array, i: number, component = 0): Corner {
  return [words[i * 6 + component], words[i * 6 + component + 1], words[i * 6 + component + 2]];
}

test("the native mall packet retains every other face, source colour and the two adjoining wing strips", async () => {
  const source = await input();
  const old = createAltMitteCoreV169FromSource(source, true);
  const current = createAltMitteCoreV169FromSource({ ...source, sourceParents: [MALL_PIAZZA_LOD2_PARENT] }, true);
  const a = packedMesh(soleMesh(old)), b = packedMesh(soleMesh(current));
  const ordinals = new Set(plan.native[id][0].flatMap(([start, length]) =>
    Array.from({ length }, (_, offset) => start + offset)));
  expect(ordinals.size).toBe(216);
  expect(current.children[0].userData.mallBridgeFacesV385).toBe(ordinals.size);
  expect(b.words.subarray(0, a.words.length)).toEqual(a.words);
  expect(b.index.array.constructor).toBe(a.index.array.constructor);
  const expectedIndices = a.index.array.slice();
  for (const face of ordinals) expectedIndices.fill(expectedIndices[face * 3], face * 3 + 1, face * 3 + 3);
  expect(b.index.array.subarray(0, a.index.count)).toEqual(expectedIndices);
  expect(current.userData.bufferCount).toBe(old.userData.bufferCount);
  expect(current.userData.geometryBytes - old.userData.geometryBytes).toBe(
    b.words.byteLength - a.words.byteLength + b.index.array.byteLength - a.index.array.byteLength
  );

  const partial = plan.residual![id];
  expect(partial.map(([face]) => face)).toEqual([14372, 14375, 14377, 14552, 14559, 14562]);
  let sourceArea = 0, cursor = a.index.count;
  const remainingArea = [0, 0];
  for (const [face, corners] of partial) {
    const original = [0, 1, 2].map(i => vertex(a.words, a.index.getX(face * 3 + i)));
    const rgb = vertex(a.words, a.index.getX(face * 3), 3);
    const parentArea = signedArea(original[0], original[1], original[2]);
    sourceArea += Math.abs(parentArea);
    // The retained native cells form two measured 2 × 4 m rectangles, at
    // (640..642, 926..930) and (644..646, 976..980), in world metres.
    const north = face < 14552;
    const xMin = north ? 12800 : 13200, zMin = north ? 41400 : 46400;
    const triangles: Corner[] = [];
    for (const expected of corners) {
      const index = b.index.getX(cursor);
      expect(index).toBe(a.count + cursor - a.index.count);
      const p = vertex(b.words, index);
      expect(p).toEqual(expected);
      expect(vertex(b.words, index, 3)).toEqual(rgb);
      expect(p[1]).toBe(1500);
      expect(p[0] >= xMin && p[0] <= xMin + 200 && p[2] >= zMin && p[2] <= zMin + 400).toBe(true);
      // Intersections in the source's cm grid can round up to half a cm.
      for (let i = 0; i < 3; i++) {
        const s = original[i], e = original[(i + 1) % 3];
        expect(Math.sign(parentArea) * signedArea(s, e, p)).toBeGreaterThanOrEqual(-Math.hypot(e[0]-s[0], e[2]-s[2]) / 20_000);
      }
      triangles.push(p);
      cursor++;
    }
    for (let i = 0; i < triangles.length; i += 3) {
      const area = signedArea(triangles[i], triangles[i+1], triangles[i+2]);
      expect(Math.sign(area)).toBe(Math.sign(parentArea));
      remainingArea[north ? 0 : 1] += Math.abs(area);
    }
  }
  expect(cursor).toBe(b.index.count);
  expect(b.words.length - a.words.length).toBe(6 * (cursor - a.index.count));
  expect(sourceArea).toBe(96);
  expect(remainingArea[0]).toBeCloseTo(8, 6);
  expect(remainingArea[1]).toBeCloseTo(8, 6);

  for (const root of [old, current]) root.updateMatrixWorld(true);
  for (const [x, z] of [[631.6, 928.56], [635.5, 978.7]]) {
    const ray = new Raycaster(new Vector3(x, 7, z - 5), new Vector3(0, 0, 1), 0, 10);
    expect(ray.intersectObject(old, true).length).toBeGreaterThan(0);
    expect(ray.intersectObject(current, true).length).toBe(0);
  }
});

test("a changed original coordinate leaves the complete native packet untouched", async () => {
  const scene = createAltMitteCoreV169FromSource(await input(), true);
  const original = packedMesh(soleMesh(scene));
  const ordinal = plan.native[id][0][0][0];
  original.words[6 * original.index.getX(ordinal * 3)]++;
  const words = original.words.slice(), indices = original.index.array.slice();
  const root = scene.children[0] as Group;
  expect(retireRegisteredAltMitteGeometry(root, id, true, plan, "mallBridgeFacesV385", "mallBridgeLinesV385")).toBe(0);
  expect(root.userData.mallBridgeFacesV385).toBe(0);
  const fallback = packedMesh(soleMesh(scene));
  expect(fallback.words).toBe(original.words);
  expect(fallback.index).toBe(original.index);
  expect(fallback.words).toEqual(words);
  expect(fallback.index.array).toEqual(indices);
});
