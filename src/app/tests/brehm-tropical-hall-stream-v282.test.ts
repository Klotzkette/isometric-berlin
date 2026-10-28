import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Group, InstancedMesh, Material, Mesh, OrthographicCamera, type Object3D } from 'three';
import {
  createSurroundingCity, createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot,
  type SurroundingCityManifest,
} from '../src/SurroundingCity';
import type { SurroundingCityChunk } from '../src/SurroundingCityGeometry';
import hallData from '../src/data/brehmTropicalHallV282.json';

const id = 'outer187-21_4';
const probe = [11011, 17, 2376] as const;
const fixture = (native: boolean): SurroundingCityChunk => JSON.parse(zlib.gunzipSync(fs.readFileSync(
  new URL(`../public/mesh/surrounding-berlin-v159/${id}.${native ? 'minecraft' : 'drawn'}.json.gz`, import.meta.url),
)).toString());

function hall(root: Object3D): Group {
  let found: Group | undefined;
  root.traverse(object => {
    if (object instanceof Group && object.userData.brehmTropicalHallV282) {
      expect(found).toBeUndefined(); found = object;
    }
  });
  if (!found) throw new Error('Expected exactly one guarded upper hall');
  return found;
}

function disposalReceipt(root: Object3D): Map<object, number> {
  const receipt = new Map<object, number>();
  hall(root).traverse(object => {
    if (!(object instanceof Mesh)) return;
    const materials: Material[] = [object.userData.dayMaterial, object.userData.nightMaterial];
    for (const owner of [object.geometry, ...materials, ...(object instanceof InstancedMesh ? [object] : [])]) {
      if (receipt.has(owner)) continue;
      receipt.set(owner, 0);
      owner.addEventListener('dispose', () => receipt.set(owner, receipt.get(owner)! + 1));
    }
  });
  expect(receipt.size).toBeGreaterThanOrEqual(3);
  return receipt;
}

function camera(x = 11008, z = 2304): OrthographicCamera {
  const view = new OrthographicCamera(-400, 400, 400, -400, 1, 3000);
  view.position.set(x, 700, z); view.up.set(0, 0, -1); view.lookAt(x, 3, z);
  view.updateMatrixWorld(); return view;
}

async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error('Bounded tropical-hall stream did not settle');
}

function transport() {
  const raw = { drawn: JSON.stringify(fixture(false)), minecraft: JSON.stringify(fixture(true)) };
  const bounds: [number, number, number, number] = [10752, 2048, 11264, 2560];
  const manifest: SurroundingCityManifest = {
    schemaVersion: 1, groundY: 3,
    footprint: [{ ring: [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]],
      [bounds[0], bounds[3]], [bounds[0], bounds[1]]], holes: [] }],
    chunks: [{ id, bounds,
      drawn: { url: 'drawn.json', bytes: Buffer.byteLength(raw.drawn) },
      minecraft: { url: 'minecraft.json', bytes: Buffer.byteLength(raw.minecraft) } }],
  };
  const calls: string[] = [];
  const fetcher = (async input => {
    const path = new URL(String(input)).pathname; calls.push(path);
    return new Response(path.endsWith('/manifest.json') ? JSON.stringify(manifest) :
      path.endsWith('/minecraft.json') ? raw.minecraft : raw.drawn,
    { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { fetcher, calls };
}

describe('Brehm upper-hall resident navigation ownership', () => {
  test('actual packet ownership publishes one world-coordinate roof and leaves source bytes intact', async () => {
    for (const native of [false, true]) {
      const raw = fixture(native), before = JSON.stringify(raw);
      const entry = await createStreamedSurroundingCityChunkV255(raw, id, native, { yield: async () => {} });
      try {
        const roof = hall(entry.root);
        expect(roof.userData.native).toBe(native);
        expect(entry.root.userData.brehmTropicalHallSolidAt).toBe(roof.userData.solidAt);
        expect(entry.root.userData.brehmTropicalHallSolidAt(...probe)).toBe(true);
        expect(entry.root.userData.brehmTropicalHallSolidAt(probe[0], 20, probe[2])).toBe(false);
        entry.root.updateMatrixWorld(true);
        expect(roof.matrixWorld.elements).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        expect(JSON.stringify(raw)).toBe(before);
      } finally { disposeSurroundingCityRoot(entry.root); }
    }
  });

  test('a changed complete parent fails closed without removing the original source building', async () => {
    for (const native of [false, true]) {
      const raw = fixture(native);
      const parent = raw.nav.buildings.find(row => (row as typeof row & { partId?: string }).partId === hallData.parentId)!;
      parent.height += .01;
      const before = JSON.stringify(raw), sourceHeight = parent.height;
      const entry = await createStreamedSurroundingCityChunkV255(raw, id, native, { yield: async () => {} });
      try {
        expect(entry.root.userData.brehmTropicalHallSolidAt).toBeUndefined();
        let upperHalls = 0;
        entry.root.traverse(object => { if (object.userData.brehmTropicalHallV282) upperHalls++; });
        expect(upperHalls).toBe(0);
        expect(entry.root.children.some(object => object.userData.zooHousesV282)).toBe(true);
        expect(entry.nav.buildings.some(row => row.sourceId === hallData.parentId && row.height === sourceHeight)).toBe(true);
        expect(JSON.stringify(raw)).toBe(before);
      } finally { disposeSurroundingCityRoot(entry.root); }
    }
  });

  test('publication, theme reuse, family replacement, eviction and reload keep solids atomic', async () => {
    const { fetcher, calls } = transport(), view = camera(), errors: string[] = [];
    const receipts: Map<object, number>[] = [], roots: Group[] = [];
    let now = 0;
    const city = createSurroundingCity({ manifestUrl: new URL('https://test.invalid/manifest.json'), camera: view,
      now: () => now, retireMs: 1, fetch: fetcher,
      onAttach: root => {
        expect(city.solidAt(...probe)).toBe(false);
        expect(root.userData.brehmTropicalHallSolidAt(...probe)).toBe(true);
        roots.push(root); receipts.push(disposalReceipt(root));
      },
      onError: error => errors.push(error),
    });
    try {
      expect(city.solidAt(...probe)).toBe(false);
      await city.ready; await until(() => city.residentChunkCount === 1 && !city.pending);
      expect(errors).toEqual([]); expect(city.solidAt(...probe)).toBe(true);
      const first = city.root.children[0], requestCount = calls.length;
      for (const mode of ['night', 'snowstorm', 'schwellenraum', 'flood', 'day'] as const) {
        city.setMode(mode);
        expect(city.root.children[0]).toBe(first);
        expect(city.solidAt(...probe)).toBe(true); expect(calls.length).toBe(requestCount);
      }
      now += 200; city.setMode('minecraft');
      expect(city.residentChunkCount).toBe(0); expect(city.solidAt(...probe)).toBe(false);
      expect([...receipts[0].values()]).toEqual([1, 1, 1]);
      await until(() => city.residentChunkCount === 1 && !city.pending);
      expect(errors).toEqual([]); expect(roots).toHaveLength(2);
      expect(hall(roots[1]).userData.native).toBe(true); expect(city.solidAt(...probe)).toBe(true);
      const nativeBytes = city.residentGeometryBytes, nativeBuffers = city.residentBufferCount;
      view.position.set(0, 700, 0); view.lookAt(0, 3, 0); view.updateMatrixWorld(); now += 2000; city.refresh(now);
      expect(city.residentChunkCount).toBe(0); expect(city.solidAt(...probe)).toBe(false);
      expect(city.residentGeometryBytes).toBe(0); expect(city.residentBufferCount).toBe(0);
      expect([...receipts[1].values()]).toEqual([1, 1, 1, 1]);
      view.position.set(11008, 700, 2304); view.lookAt(11008, 3, 2304); view.updateMatrixWorld(); now += 2000; city.refresh(now);
      await until(() => city.residentChunkCount === 1 && !city.pending);
      expect(errors).toEqual([]); expect(roots).toHaveLength(3);
      expect(city.residentGeometryBytes).toBe(nativeBytes); expect(city.residentBufferCount).toBe(nativeBuffers);
      expect(city.solidAt(...probe)).toBe(true);
      city.dispose();
      expect(city.solidAt(...probe)).toBe(false); expect(city.navigationTiles).toHaveLength(0);
      expect(city.residentGeometryBytes).toBe(0); expect(city.residentBufferCount).toBe(0);
      expect([...receipts[2].values()]).toEqual([1, 1, 1, 1]);
    } finally { city.dispose(); }
  });

  test('cancelling after roof construction disposes unpublished geometry, materials and instances', async () => {
    for (const native of [false, true]) {
      const abort = new AbortController(), originalAdd = Group.prototype.add;
      let receipt: Map<object, number> | undefined;
      Group.prototype.add = function (...objects: Object3D[]) {
        for (const object of objects) if (object.userData.zooHousesV282) {
          receipt = disposalReceipt(object); abort.abort();
        }
        return originalAdd.apply(this, objects);
      };
      try {
        await expect(createStreamedSurroundingCityChunkV255(fixture(native), id, native,
          { signal: abort.signal, yield: async () => {} })).rejects.toMatchObject({ name: 'AbortError' });
        expect(receipt).toBeDefined();
        expect([...receipt!.values()]).toEqual(native ? [1, 1, 1, 1] : [1, 1, 1]);
      } finally { Group.prototype.add = originalAdd; }
    }
  });

  test('disposal inside attachment never publishes a roof solid', async () => {
    const { fetcher } = transport(), errors: string[] = [];
    let receipt: Map<object, number> | undefined;
    const city = createSurroundingCity({ manifestUrl: new URL('https://test.invalid/manifest.json'), camera: camera(),
      fetch: fetcher, onError: error => errors.push(error),
      onAttach: root => { receipt = disposalReceipt(root); city.dispose(); },
    });
    try {
      await city.ready; await until(() => receipt !== undefined && !city.pending);
      expect(errors).toEqual([]); expect(city.solidAt(...probe)).toBe(false);
      expect(city.residentChunkCount).toBe(0); expect(city.root.children).toHaveLength(0);
      expect(city.residentGeometryBytes).toBe(0); expect(city.residentBufferCount).toBe(0);
      expect([...receipt!.values()]).toEqual([1, 1, 1]);
    } finally { city.dispose(); }
  });
});
