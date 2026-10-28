import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Group, InstancedMesh, Mesh, Line, Points, OrthographicCamera, Vector3, type Object3D } from 'three';
import { createSurroundingCity, createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot, type SurroundingCityManifest } from '../src/SurroundingCity';
import { prepareTierparkV255 } from '../src/TierparkV255';
import { prepareTierparkV276 } from '../src/TierparkV276';
import { transferTierparkAnimalsV282 } from '../src/tierparkAnimalTransferV282';
import { createZooAnimalsV282, createZooAnimalRuntimeV282, type ZooAnimalHandleV282 } from '../src/ZooAnimalsV282';
import { prepareZooAnimalRouteV282, sampleZooAnimalPoseV282 } from '../src/zooAnimalMotionV282';
import type { SurroundingCityChunk } from '../src/SurroundingCityGeometry';
import placements from '../src/data/zooAnimalsV282.json';
import houses from '../src/data/zooHousesV282.json';

const id = 'outer187-20_4';
const finish = <T>(steps: Generator<void, T>): T => { let step = steps.next(); while (!step.done) step = steps.next(); return step.value; };
const fixture = (native: boolean, packet = id): SurroundingCityChunk => JSON.parse(zlib.gunzipSync(fs.readFileSync(
  new URL(`../public/mesh/surrounding-berlin-v159/${packet}.${native ? 'minecraft' : 'drawn'}.json.gz`, import.meta.url),
)).toString());
const transferred = (native: boolean) => transferTierparkAnimalsV282(
  finish(prepareTierparkV276(finish(prepareTierparkV255(fixture(native), id, native)), id, native)), id, native,
);
function animalRoot(root: Group): Group {
  const child = root.children.find(object => object.userData.zooAnimalsV282);
  if (!(child instanceof Group)) throw new Error('Expected one independently owned animal batch');
  return child;
}
function measured(root: Object3D): { bytes: number; buffers: number } {
  const arrays = new Set<ArrayBufferView>();
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    for (const attribute of Object.values(object.geometry.attributes)) arrays.add('data' in attribute ? attribute.data.array : attribute.array);
    if (object.geometry.index) arrays.add(object.geometry.index.array);
    if (object instanceof InstancedMesh) {
      arrays.add(object.instanceMatrix.array); if (object.instanceColor) arrays.add(object.instanceColor.array);
    }
  });
  return { bytes: [...arrays].reduce((n, array) => n + array.byteLength, 0), buffers: arrays.size };
}
function camera(): OrthographicCamera {
  const result = new OrthographicCamera(-400, 400, 400, -400, 1, 3000);
  result.position.set(10496, 700, 2304); result.up.set(0, 0, -1); result.lookAt(10496, 3, 2304);
  result.updateMatrixWorld(); return result;
}
async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 2)); }
  throw new Error('Bounded Tierpark stream did not settle');
}

describe('Tierpark v282 streamed ownership and lifecycle', () => {
  test('real packets publish every existing animal exactly once and account for every GPU array', async () => {
    for (const native of [false, true]) {
      const raw = fixture(native), before = JSON.stringify(raw), transfer = transferred(native);
      const entry = await createStreamedSurroundingCityChunkV255(raw, id, native, { yield: async () => {} });
      try {
        const figures = animalRoot(entry.root), handle = figures.userData.zooAnimalsV282 as ZooAnimalHandleV282;
        const expected = [...transfer.animals.map(animal => animal.id), ...placements.animals.filter(animal => animal.siteId === 'tierpark' &&
          `outer187-${Math.floor(animal.routeXZ[0][0] / 512)}_${Math.floor(animal.routeXZ[0][1] / 512)}` === id).map(animal => animal.id)];
        expect(figures.userData.animalIds).toEqual(expected);
        expect(new Set(figures.userData.animalIds).size).toBe(expected.length);
        expect(expected.filter(name => name.startsWith('tierpark-v276-'))).toHaveLength(47);
        expect(measured(figures)).toEqual({ bytes: handle.geometryBytes, buffers: handle.bufferCount });
        expect(measured(entry.root)).toEqual({ bytes: entry.geometryBytes, buffers: entry.bufferCount });
        expect(entry.geometryBytes).toBeLessThan(16 * 1024 * 1024);
        entry.root.updateMatrixWorld(true);
        expect(figures.matrixWorld.elements).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        expect(JSON.stringify(raw)).toBe(before);
      } finally { disposeSurroundingCityRoot(entry.root); }
    }
  });

  test('retained source headings face forward on the shared +X route convention', () => {
    for (const native of [false, true]) for (const old of transferred(native).animals.filter(animal => /^tierpark-v276-flamingo-[0-3]$/.test(animal.id))) {
      // An unrelated tile excludes new figures, leaving only this actual v276 bird.
      const root = createZooAnimalsV282('tierpark', native, [old], 'test-no-additive-figures');
      try {
        const route = placements.retainedRoutes.find(row => row.id === old.id)!;
        const prepared = prepareZooAnimalRouteV282({ ...route, animalId: route.id, routeXZ: route.routeXZ as [number, number][] });
        const pose = { x: 0, y: 0, z: 0, quarterTurn: 0 as 0 | 1 | 2 | 3, gait: 0 };
        const mesh = root.children.find(child => child instanceof Mesh) as Mesh;
        const position = mesh.geometry.getAttribute('position'), color = mesh.geometry.getAttribute('color');
        const beakRed = Math.min(...old.surfaces.map(surface => surface.color >> 16 & 255)) / 255;
        for (const seconds of [0, 31, 75, 150]) {
          sampleZooAnimalPoseV282(prepared, seconds, pose);
          (root.userData.zooAnimalsV282 as ZooAnimalHandleV282).update(seconds);
          let dx = 0, dz = 0, count = 0;
          for (let i = 0; i < position.count; i++) {
            // The source's dark beak shares its packed linear colour with the
            // legs, but lies above them. Its centre marks the authored front.
            if (Math.abs(color.getX(i) - beakRed) > 1e-6 || position.getY(i) < pose.y + 1.15) continue;
            dx += position.getX(i) - pose.x; dz += position.getZ(i) - pose.z; count++;
          }
          expect(count).toBeGreaterThan(0); dx /= count; dz /= count;
          const directions = [[1, 0], [0, -1], [-1, 0], [0, 1]], [fx, fz] = directions[pose.quarterTurn];
          expect(dx * fx + dz * fz).toBeGreaterThan(.45);
          expect(Math.abs(dx * fz - dz * fx)).toBeLessThan(.012);
        }
      } finally { disposeSurroundingCityRoot(root); }
    }
  });

  test('cancellation after animal attachment releases instances and unregisters the unpublished owner', async () => {
    for (const native of [false, true]) {
      const controller = new AbortController(), runtime = createZooAnimalRuntimeV282();
      const add = Group.prototype.add, instances: InstancedMesh[] = [], disposed = new Set<InstancedMesh>();
      let handle: ZooAnimalHandleV282 | undefined;
      Group.prototype.add = function (...objects: Object3D[]) {
        for (const object of objects) if (object.userData.zooAnimalsV282) {
          handle = object.userData.zooAnimalsV282; runtime.register(object);
          object.traverse(child => { if (child instanceof InstancedMesh) {
            instances.push(child); child.addEventListener('dispose', () => disposed.add(child));
          } });
          controller.abort();
        }
        return add.apply(this, objects);
      };
      try {
        await expect(createStreamedSurroundingCityChunkV255(fixture(native), id, native, {
          signal: controller.signal, yield: async () => {},
        })).rejects.toMatchObject({ name: 'AbortError' });
        expect(handle?.disposed).toBe(true); expect(runtime.size).toBe(0);
        expect(disposed.size).toBe(instances.length);
        if (native) expect(instances.length).toBeGreaterThan(0);
      } finally { Group.prototype.add = add; runtime.dispose(); }
    }
  });

  test('Brehm facade attachment remains in world coordinates and owns exactly its accounted arrays', async () => {
    for (const native of [false, true]) {
      const entry = await createStreamedSurroundingCityChunkV255(fixture(native, houses.brehm.packetId), houses.brehm.packetId, native, { yield: async () => {} });
      try {
        const house = entry.root.children.find(child => child.userData.zooHousesV282) as Group;
        expect(house).toBeDefined(); expect(house.userData.preservedBrehmEnvelope).toBe(true);
        expect(house.userData.native).toBe(native);
        entry.root.updateMatrixWorld(true);
        expect(house.matrixWorld.elements).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        expect(measured(entry.root)).toEqual({ bytes: entry.geometryBytes, buffers: entry.bufferCount });
        expect(entry.geometryBytes).toBeLessThan(16 * 1024 * 1024);
      } finally { disposeSurroundingCityRoot(entry.root); }
    }
  });

  test('cancellation after Brehm facade attachment disposes the unpublished instance buffer owner', async () => {
    for (const native of [false, true]) {
      const controller = new AbortController(), runtime = createZooAnimalRuntimeV282();
      const add = Group.prototype.add, instances: InstancedMesh[] = [], disposed = new Set<InstancedMesh>();
      Group.prototype.add = function (...objects: Object3D[]) {
        for (const object of objects) {
          if (object.userData.zooAnimalsV282) runtime.register(object);
          if (!object.userData.zooHousesV282) continue;
          object.traverse(child => { if (child instanceof InstancedMesh) {
            instances.push(child); child.addEventListener('dispose', () => disposed.add(child));
          } });
          controller.abort();
        }
        return add.apply(this, objects);
      };
      try {
        await expect(createStreamedSurroundingCityChunkV255(fixture(native, houses.brehm.packetId), houses.brehm.packetId, native, {
          signal: controller.signal, yield: async () => {},
        })).rejects.toMatchObject({ name: 'AbortError' });
        expect(instances.length).toBeGreaterThan(0);
        expect(disposed.size).toBe(instances.length);
        expect(runtime.size).toBe(0);
      } finally { Group.prototype.add = add; runtime.dispose(); }
    }
  });

  test('a visible enclosure still moves when the larger animal batch centre lies outside a close view', async () => {
    const entry = await createStreamedSurroundingCityChunkV255(fixture(false), id, false, { yield: async () => {} });
    const runtime = createZooAnimalRuntimeV282();
    try {
      const figures = animalRoot(entry.root), handle = figures.userData.zooAnimalsV282 as ZooAnimalHandleV282;
      const route = placements.retainedRoutes.find(row => row.id === 'tierpark-v276-wood-bison-0')!;
      const [x, z] = route.routeXZ[0], view = new OrthographicCamera(-10, 10, 10, -10, 1, 200);
      view.position.set(x, 100, z); view.up.set(0, 0, -1); view.lookAt(x, 3, z); view.updateMatrixWorld();
      const centre = handle.bounds.center.clone().project(view);
      expect(Math.max(Math.abs(centre.x), Math.abs(centre.y))).toBeGreaterThan(1.35);
      const mesh = figures.children.find(child => child instanceof Mesh) as Mesh, position = mesh.geometry.getAttribute('position');
      const point = new Vector3(position.getX(0), position.getY(0), position.getZ(0)).project(view);
      expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1);
      runtime.register(entry.root);
      expect(runtime.update(0, view, false, false)).toBe(true);
      expect(runtime.update(100, view, false, false)).toBe(true);
    } finally { runtime.dispose(); disposeSurroundingCityRoot(entry.root); }
  });

  test('controller keeps drawn themes resident, replaces native owners and releases all counters on eviction', async () => {
    const raw = { drawn: JSON.stringify(fixture(false)), minecraft: JSON.stringify(fixture(true)) }, calls: string[] = [];
    const manifest: SurroundingCityManifest = { schemaVersion: 1, groundY: 3,
      footprint: [{ ring: [[10240, 2048], [10752, 2048], [10752, 2560], [10240, 2560], [10240, 2048]], holes: [] }],
      chunks: [{ id, bounds: [10240, 2048, 10752, 2560],
        drawn: { url: 'drawn.json', bytes: Buffer.byteLength(raw.drawn) },
        minecraft: { url: 'minecraft.json', bytes: Buffer.byteLength(raw.minecraft) } }],
    };
    const view = camera(), runtime = createZooAnimalRuntimeV282(), handles: ZooAnimalHandleV282[] = [], errors: string[] = [];
    let now = 0;
    const city = createSurroundingCity({ manifestUrl: new URL('https://test.invalid/manifest.json'), camera: view,
      now: () => now, retireMs: 1,
      fetch: (async input => {
        const path = new URL(String(input)).pathname; calls.push(path);
        return new Response(path.endsWith('/manifest.json') ? JSON.stringify(manifest) : path.endsWith('/minecraft.json') ? raw.minecraft : raw.drawn,
          { headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch,
      onAttach: root => { runtime.register(root); handles.push(animalRoot(root).userData.zooAnimalsV282); },
      onError: message => errors.push(message),
    });
    try {
      await city.ready; await until(() => city.residentChunkCount === 1 && !city.pending);
      expect(errors).toEqual([]); expect(runtime.size).toBe(1);
      const drawnRoot = city.root.children[0], drawnIds = [...animalRoot(drawnRoot as Group).userData.animalIds];
      const bytes = city.residentGeometryBytes, buffers = city.residentBufferCount, requestCount = calls.length;
      for (const theme of ['night', 'snowstorm', 'schwellenraum', 'flood'] as const) {
        city.setMode(theme); expect(city.root.children[0]).toBe(drawnRoot);
        expect(city.residentGeometryBytes).toBe(bytes); expect(city.residentBufferCount).toBe(buffers);
        expect(calls.length).toBe(requestCount); expect(runtime.size).toBe(1);
      }
      now += 200; city.setMode('minecraft');
      expect(handles[0].disposed).toBe(true);
      await until(() => city.residentChunkCount === 1 && !city.pending);
      expect(errors).toEqual([]); expect(runtime.size).toBe(1); expect(handles).toHaveLength(2);
      expect(animalRoot(city.root.children[0] as Group).userData.animalIds).toEqual(drawnIds);
      expect(measured(city.root)).toEqual({ bytes: city.residentGeometryBytes, buffers: city.residentBufferCount });
      view.position.set(0, 700, 0); view.lookAt(0, 3, 0); view.updateMatrixWorld(); now += 2000; city.refresh(now);
      expect(city.residentChunkCount).toBe(0); expect(city.residentGeometryBytes).toBe(0); expect(city.residentBufferCount).toBe(0);
      expect(runtime.size).toBe(0); expect(handles.every(handle => handle.disposed)).toBe(true);
    } finally { city.dispose(); runtime.dispose(); }
  });
});
