import { expect, test } from "bun:test";
import { Group, InstancedMesh, Matrix4, Mesh } from "three";
import { createAltMitteCoreV169FromSource, type AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import { createSchlossplatzContextV344 } from "../src/SchlossplatzContextV344";
import { createSourceWallHostVerifierV344 } from "../src/sourceWallHostV344";
import source from "../src/data/schlossplatzContextV344.json";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

async function actualSource(native: boolean) {
  const mode = native ? "Native" : "Drawn";
  const manifest = await Bun.file(new URL(`../src/data/altMitte${mode}V169Source.json`, import.meta.url)).json();
  const ids = new Set(source.fronts.flatMap(f => (native ? f.nativeHosts : f.drawnHosts).map(h => h.packetId)));
  const chunks: { id: string; packet: SurroundingCityChunk }[] = [];
  for (const entry of manifest.chunkFiles) if (ids.has(entry.id)) chunks.push({ id: entry.id,
    packet: await Bun.file(new URL(`../src/data/${entry.file}`, import.meta.url)).json() });
  const payload: AltMitteCoreV169Source = { schemaVersion: 1,
    sourceParents: [...new Set(source.fronts.map(f => f.family))], drawnChunks: native ? [] : chunks,
    minecraftChunks: native ? chunks : [] };
  const world = new Group();
  world.add(createAltMitteCoreV169FromSource(payload, native, { schlossplatzV239: true }));
  return world;
}

function snapshot(world: Group) {
  const result: bigint[] = [];
  world.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const p = o.geometry.getAttribute("position");
    if (p) result.push(Bun.hash(p.array));
    if (o.geometry.index) result.push(Bun.hash(o.geometry.index.array));
  });
  return result;
}

for (const native of [false, true]) test(`real ${native ? "Native" : "Drawn"} hosts admit ten families without altering any source`, async () => {
  const world = await actualSource(native), before = snapshot(world);
  const detail = createSchlossplatzContextV344(world, native);
  expect(detail.userData.admitted).toEqual(source.fronts.map(f => f.name));
  expect(detail.userData.skipped).toEqual([]);
  expect(detail.userData.sourceFamilies.length).toBe(10);
  expect(detail.userData.fullMobileIdentical).toBe(true);
  expect(detail.userData.textureFree).toBe(true);
  expect(snapshot(world)).toEqual(before);
  expect(detail.userData.windowCount).toBeGreaterThan(300);
  expect(detail.children.length).toBeLessThanOrEqual(3);
  let instances = 0;
  for (const child of detail.children) {
    expect(child instanceof InstancedMesh).toBe(true);
    const mesh = child as InstancedMesh;
    instances += mesh.count;
    expect(mesh.userData.dayMaterial).toBeDefined();
    expect(mesh.userData.nightMaterial).toBeDefined();
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    if (!native) continue;
    const matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      // Each cardinal block axis has exactly one nonzero world component.
      for (const start of [0, 4, 8]) expect(matrix.elements.slice(start, start + 3)
        .filter(v => Math.abs(v) > 1e-6).length).toBe(1);
    }
  }
  expect(instances).toBeLessThan(11000);
  console.log({ mode: native ? "Native" : "Drawn", instances, windows: detail.userData.windowCount,
    faces: detail.userData.nativeFaces, instanceBytes: instances * 76 });
});

test("absent, translated, edited, retired and wrong-mode actual hosts fail closed", async () => {
  expect(createSchlossplatzContextV344(new Group()).userData.admitted).toEqual([]);
  const world = await actualSource(false), f = source.fronts[0], host = f.drawnHosts[0];
  const verify = createSourceWallHostVerifierV344(world, false);
  expect(verify(f.drawnHosts)).toBe(true);
  expect(createSourceWallHostVerifierV344(world, true)(f.nativeHosts)).toBe(false);
  const packet = world.children[0].children.find(c => c.name.endsWith(`: ${host.packetId}`))!;
  const mesh = packet.children.find(c => c instanceof Mesh) as Mesh;
  world.traverse(o => { o.matrixWorldAutoUpdate = false; });
  packet.position.x += 1;
  packet.updateMatrix();
  expect(verify(f.drawnHosts)).toBe(false);
  packet.position.x -= 1;
  packet.updateMatrix();
  const index = mesh.geometry.index!, offset = host.triangles[0].offset;
  const old = index.getX(offset + 1);
  index.setX(offset + 1, index.getX(offset));
  expect(verify(f.drawnHosts)).toBe(false);
  expect(createSchlossplatzContextV344(world).userData.admitted).not.toContain(f.name);
  index.setX(offset + 1, old);
  expect(verify(f.drawnHosts)).toBe(true);
  const position = mesh.geometry.getAttribute("position"), vertex = index.getX(offset);
  const x = position.getX(vertex);
  position.setX(vertex, x + 1);
  expect(verify(f.drawnHosts)).toBe(false);
  position.setX(vertex, x);
  packet.remove(mesh);
  expect(verify(f.drawnHosts)).toBe(false);
  expect(createSourceWallHostVerifierV344(world, false)(f.drawnHosts)).toBe(false);
});
