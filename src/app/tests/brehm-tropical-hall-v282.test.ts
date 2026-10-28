import { describe, expect, test } from 'bun:test';
import { InstancedMesh, Mesh } from 'three';
import { createBrehmTropicalHallV282 } from '../src/BrehmTropicalHallV282';
import { createTierparkHouseV282 } from '../src/ZooHousesV282';
import {
  brehmTropicalHallRoofAtV282 as roofAt,
  brehmTropicalHallSolidAtV282 as solidAt,
  hasBrehmTropicalHallParentV282 as guarded,
} from '../src/brehmTropicalHallV282Profile';
import type { SurroundingCityChunk } from '../src/SurroundingCityGeometry';
import data from '../src/data/brehmTropicalHallV282.json';
import receipt from '../../../geo_data/regierungsviertel/brehm-tropical-hall-v282-receipt.json';

const packet = (): SurroundingCityChunk => ({ schemaVersion: 1, origin: [...data.packetOrigin] as [number, number, number],
  meshes: [], nav: { ground: [], water: [], groundY: data.groundY, buildings: [structuredClone(data.parentGuard)] } });

function dispose(root: ReturnType<typeof createBrehmTropicalHallV282>): void {
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose(); object.userData.dayMaterial.dispose(); object.userData.nightMaterial.dispose();
  });
}

describe('v282 source-supported Brehm tropical hall', () => {
  test('one complete static batch per family, finite buffers and cardinal native solids', () => {
    for (const native of [false, true]) {
      const root = createBrehmTropicalHallV282(native);
      try {
        expect(root.userData.additiveOnly).toBe(true);
        expect(root.userData.fullStaticDetailOnTouch).toBe(true);
        expect(root.children).toHaveLength(1);
        const mesh = root.children[0] as Mesh;
        let bytes = 0;
        root.traverse(object => expect(object.matrixAutoUpdate).toBe(false));
        for (const attribute of Object.values(mesh.geometry.attributes)) {
          bytes += attribute.array.byteLength;
          for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true);
        }
        for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) expect(material.map).toBeNull();
        if (native) {
          expect(mesh).toBeInstanceOf(InstancedMesh);
          const batch = mesh as InstancedMesh;
          expect(batch.count).toBe(data.nativeRuns.length * 2);
          bytes += batch.instanceMatrix.array.byteLength + batch.instanceColor!.array.byteLength;
          for (let i = 0; i < batch.count; i++) {
            const m = batch.instanceMatrix.array.slice(i * 16, i * 16 + 16);
            for (const key of [1, 2, 4, 6, 8, 9]) expect(m[key]).toBe(0);
            for (const value of m) expect(Number.isFinite(value)).toBe(true);
            expect(m[0]).toBeGreaterThan(0); expect(m[5]).toBeGreaterThan(0); expect(m[10]).toBe(1);
            const expected = data.nativeRuns[Math.floor(i / 2)];
            expect(m[12]).toBe(expected[0] + expected[2] / 2);
            expect(m[14]).toBe(expected[1] + .5);
            expect(m[13] + m[5] / 2).toBe(expected[3] - (i % 2 ? 0 : .5));
          }
        } else {
          expect(mesh).not.toBeInstanceOf(InstancedMesh);
          expect(mesh.geometry.getAttribute('position').count).toBe((250 + 16 * 2) * 3);
          expect(mesh.geometry.getAttribute('normal').count).toBe(mesh.geometry.getAttribute('position').count);
        }
        expect(bytes).toBeLessThan(80_000);
      } finally { dispose(root); }
    }
  });

  test('visible triangles preserve all accepted sample heights and the complete perimeter', () => {
    for (const [x, z, nhn] of receipt.safePoints) expect(roofAt(false, x, z)).toBeCloseTo(nhn - receipt.terrainMedianNHN + 3, 3);
    for (const [x, z] of data.ring) expect(roofAt(false, x, z)).toBeCloseTo(data.eaveY, 6);
    for (const [ia, ib, ic] of data.roofIndices) {
      const tri = [data.roofVertices[ia], data.roofVertices[ib], data.roofVertices[ic]];
      const x = tri.reduce((sum, p) => sum + p[0] / 3, 0), z = tri.reduce((sum, p) => sum + p[2] / 3, 0);
      const top = tri.reduce((sum, p) => sum + p[1] / 3, 0);
      expect(roofAt(false, x, z)).toBeCloseTo(top, 5);
      expect(solidAt(false, x, top - .01, z)).toBe(true);
      expect(solidAt(false, x, top + .01, z)).toBe(false);
      expect(solidAt(false, x, data.bottomY - .01, z)).toBe(false);
    }
    expect(roofAt(false, 0, 0)).toBeNull();
    expect(roofAt(false, 11011, 2376)).toBeCloseTo(18.91, 6);
    expect(roofAt(false, 11010, 2406)).toBeLessThan(15.5);
  });

  test('native navigation follows every occupied column, including its lower wall and cap', () => {
    let columns = 0;
    for (const [x, z, width, top] of data.nativeRuns) for (let offset = 0; offset < width; offset++) {
      const cx = x + offset + .5, cz = z + .5;
      columns++;
      expect(roofAt(true, cx, cz)).toBe(top);
      expect(solidAt(true, cx, top - .001, cz)).toBe(true);
      expect(solidAt(true, cx, top + .001, cz)).toBe(false);
      expect(solidAt(true, cx, data.nativeBottomY + .001, cz)).toBe(true);
      const drawn = roofAt(false, cx, cz)!;
      expect(top - drawn).toBeGreaterThan(-.002);
      expect(top - drawn).toBeLessThan(.502);
    }
    expect(columns).toBe(1275);
    expect(roofAt(true, 0, 0)).toBeNull();
  });

  test('collision radius follows local roof slopes instead of the maximum-height footprint', () => {
    for (const native of [false, true]) {
      for (const [x, z] of [[11011, 2376], [11010, 2391], [11010, 2406], [11000, 2367]]) {
        const top = roofAt(native, x, z, .4)!;
        expect(top).not.toBeNull();
        // Dense probes are a lower bound on the exact disc/plane maximum.
        let sampled = -Infinity;
        for (let i = 0; i < 96; i++) {
          const angle = i * Math.PI / 48;
          sampled = Math.max(sampled, roofAt(native, x + .399 * Math.cos(angle), z + .399 * Math.sin(angle)) ?? -Infinity);
        }
        expect(top).toBeGreaterThanOrEqual(sampled - 1e-6);
        expect(top - sampled).toBeLessThan(.025);
        expect(solidAt(native, x, top + .05, z, .4)).toBe(false);
        expect(solidAt(native, x, top - .05, z, .4)).toBe(true);
      }
    }
  });

  test('only the exact retained parent in its streamed packet receives an upper hall and callback', () => {
    const source = packet();
    expect(guarded(source, data.packetId)).toBe(true);
    // Drawn packets legitimately also retain wall projections with the same
    // parent sourceId, but only one complete part witness is admissible.
    source.nav.buildings.push({ sourceId: data.parentId, ring: [[0, 0], [1, 0], [1, 1]], holes: [], height: 8.57, minHeight: 0 });
    expect(guarded(source, data.packetId)).toBe(true);
    const bad = [packet(), packet(), packet(), packet(), packet()];
    bad[0].origin[0]++;
    bad[1].nav.buildings.length = 0;
    bad[2].nav.buildings.push(structuredClone(data.parentGuard));
    bad[3].nav.buildings[0].height += .01;
    bad[4].nav.buildings[0].ring[0][0] += .01;
    for (const p of bad) {
      expect(guarded(p, data.packetId)).toBe(false);
      const root = createTierparkHouseV282(data.packetId, false, p)!;
      try { expect(root.userData.brehmTropicalHallSolidAt).toBeUndefined(); }
      finally { dispose(root); }
    }
    expect(guarded(source, 'outer187-20_4')).toBe(false);
    for (const native of [false, true]) {
      const root = createTierparkHouseV282(data.packetId, native, source)!;
      try {
        expect(typeof root.userData.brehmTropicalHallSolidAt).toBe('function');
        expect(root.userData.brehmTropicalHallSolidAt(11011, 18.8, 2376)).toBe(true);
        expect(root.userData.brehmTropicalHallSolidAt(11011, 19.1, 2376)).toBe(false);
        expect(root.userData.preservedBrehmEnvelope).toBe(true);
      } finally { dispose(root); }
    }
  });
});
