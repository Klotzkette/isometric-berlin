import { describe, expect, test } from 'bun:test';
import { InstancedMesh, Mesh } from 'three';
import { createTierparkHouseV282, createZooHousesV282 } from '../src/ZooHousesV282';
import { createZooHouseColumnTesterV282, isZooHouseSourceV282 } from '../src/zooHousesV282Ownership';
import { penguinRoofAtV282, zooAviarySolidsV282, zooHouseSolidsV282 } from '../src/zooHousesV282Profile';
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from '../src/pedestrianNavigation';
import type { PrismPayload } from '../src/IsometricCityWorld';
import type { VisualMode } from '../src/visualMode';
import data from '../src/data/zooHousesV282.json';
import receipt from '../src/data/zooHousesV282Ownership.json';

describe('v282 complete Penguin house and retained Brehm recognition', () => {
  test('complete source geometry is finite, static and texture-free in both families', () => {
    for (const site of ['zoo', 'tierpark'] as const) for (const native of [false, true]) {
      const root = createZooHousesV282(site, native);
      let calls = 0, bytes = 0;
      try {
        expect(root.userData.fullStaticDetailOnTouch).toBe(true);
        expect(root.userData.measuredPenguinParts).toBe(site === 'zoo' ? 4 : 0);
        expect(root.userData.measuredAviarySheets).toBe(site === 'zoo' ? 5 : 0);
        root.traverse(o => {
          expect(o.matrixAutoUpdate).toBe(false);
          if (!(o instanceof Mesh)) return;
          calls++;
          for (const attribute of Object.values(o.geometry.attributes)) {
            bytes += attribute.array.byteLength;
            for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true);
          }
          for (const material of [o.userData.dayMaterial, o.userData.nightMaterial]) expect(material.map).toBeNull();
          if (o instanceof InstancedMesh) {
            bytes += o.instanceMatrix.array.byteLength + o.instanceColor!.array.byteLength;
            for (const value of o.instanceMatrix.array) expect(Number.isFinite(value)).toBe(true);
            if (native) for (let i = 0; i < o.count; i++) for (const k of [1, 2, 4, 6, 8, 9])
              expect(o.instanceMatrix.array[i * 16 + k]).toBe(0);
          } else {
            expect(native).toBe(false);
            expect(o.geometry.getAttribute('position').count).toBe(data.penguin.surfaces.reduce((n, s) => n + s.triangles.length * 3, 0));
            expect(o.geometry.getAttribute('normal').count).toBe(o.geometry.getAttribute('position').count);
          }
        });
        expect(calls).toBe(site === 'zoo' && !native ? 2 : 1);
        expect(bytes).toBeLessThan(350_000);
      } finally {
        root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); o.userData.dayMaterial.dispose(); o.userData.nightMaterial.dispose(); } });
      }
    }
    expect(createTierparkHouseV282('outer187-20_4')).toBeNull();
    const right = createTierparkHouseV282('outer187-21_4')!;
    expect(right.userData.preservedBrehmEnvelope).toBe(true);
    right.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); o.userData.dayMaterial.dispose(); o.userData.nightMaterial.dispose(); } });
  });

  test('receipts fail closed for missing, changed and duplicate sources', () => {
    const all = [...receipt.previousPrisms, ...receipt.neighbours];
    for (const p of receipt.previousPrisms) {
      expect(isZooHouseSourceV282(p)).toBe(true);
      expect(isZooHouseSourceV282({ ...p, h_dm: p.h_dm + 1 })).toBe(false);
    }
    expect(isZooHouseSourceV282(null)).toBe(false);
    const yes = createZooHouseColumnTesterV282(all, 4);
    for (const [x, z, low, high, kind] of receipt.columns) {
      expect(yes(x, z, low, high, kind)).toBe(true);
      expect(yes(x, z, low, high + 1, kind)).toBe(false);
      expect(yes(x, z, low - 1, high, kind)).toBe(false);
    }
    for (const records of [all.slice(1), [...all, all[0]], all.map((p, i) => i ? p : { ...p, h_dm: p.h_dm + 1 })]) {
      const no = createZooHouseColumnTesterV282(records, 4);
      for (const [x, z, low, high, kind] of receipt.columns) expect(no(x, z, low, high, kind)).toBe(false);
    }
    const [x, z, low, high, kind] = receipt.columns[0];
    const foreign = { ...all[0], id: 'new-source', ring: [[x * 40, z * 40], [x * 40 + 40, z * 40], [x * 40 + 40, z * 40 + 40], [x * 40, z * 40 + 40]] };
    expect(createZooHouseColumnTesterV282([...all, foreign], 4)(x, z, low, high, kind)).toBe(false);
    expect(createZooHouseColumnTesterV282(all, 2)(x, z, low, high, kind)).toBe(false);
  });

  test('walking follows complete drawn roof triangles and independently occupied native cells', () => {
    const native = zooHouseSolidsV282(true), drawn = zooHouseSolidsV282(false);
    for (const p of data.penguin.parts) {
      const n = native.find(s => s.sourceId === p.sourceId)!, d = drawn.find(s => s.sourceId === p.sourceId)!;
      expect(d.ring).toEqual(p.ring); expect(d.holes).toEqual(p.holes);
      for (const [x, z, y] of p.nativeCells) expect(n.topAt(x + .5, z + .5)).toBe(y);
      for (const tri of p.roofTriangles) {
        const x = tri.reduce((v, p) => v + p[0] / 3, 0), z = tri.reduce((v, p) => v + p[2] / 3, 0);
        expect(d.topAt(x, z)).toBe(penguinRoofAtV282(p.roofTriangles, x, z));
      }
      expect(n.topAt(0, 0)).toBeNull(); expect(d.topAt(0, 0)).toBeNull();
    }
    expect(Math.max(...drawn.map(p => p.maxY))).toBe(12.018);
    const source = { schema_version: 1, classes: ['concrete'], buildings: receipt.previousPrisms } as PrismPayload;
    let mode: VisualMode = 'day';
    const before = compilePedestrianObstacles(source), after = compilePedestrianObstacles(source, () => mode, { zooHousesV282: true });
    // Stable point in the main measured roof. The old basement-height prism
    // blocked air at 14 m; the complete corrected dome leaves it clear.
    const [x, z] = [-2154, 1058];
    expect(pedestrianPointIsBlocked(x, z, 14, before)).toBe(true);
    for (mode of ['day', 'night', 'minecraft', 'day']) {
      expect(pedestrianPointIsBlocked(x, z, 14, after)).toBe(false);
      expect(pedestrianPointIsBlocked(x, z, 5.2, after)).toBe(true);
    }
    const modified = { ...source, buildings: source.buildings.map(p => ({ ...p, h_dm: p.h_dm + 1 })) };
    expect(pedestrianPointIsBlocked(x, z, 14, compilePedestrianObstacles(modified, () => mode, { zooHousesV282: true }))).toBe(true);
  });

  test('the added aviary is transaction-gated and keeps surrounding paths open', () => {
    const source = { schema_version: 1, classes: ['concrete'], buildings: [] } as unknown as PrismPayload;
    let mode: VisualMode = 'day';
    const before = compilePedestrianObstacles(source);
    const after = compilePedestrianObstacles(source, () => mode, { zooHousesV282: true });
    const [solid] = zooAviarySolidsV282();
    expect(solid.ring).toEqual(data.aviary.ring);
    expect(solid.maxY).toBeCloseTo(8.67, 6);
    expect(pedestrianPointIsBlocked(-2420.3, 1201.1, 5.32, before)).toBe(false);
    for (mode of ['day', 'night', 'minecraft', 'day']) {
      expect(pedestrianPointIsBlocked(-2420.3, 1201.1, 5.32, after)).toBe(true);
      expect(pedestrianPointIsBlocked(-2420.3, 1201.1, 9, after)).toBe(false);
      expect(pedestrianPointIsBlocked(-2423, 1201.1, 5.32, after)).toBe(false);
    }
    expect(solid.topAt(0, 0)).toBeNull();
    const root = createZooHousesV282('zoo', true);
    try {
      const batch = root.children.find(o => o instanceof InstancedMesh) as InstancedMesh;
      const matrices = batch.instanceMatrix.array;
      let bars = 0;
      for (let i = 0; i < batch.count; i++) {
        const x = matrices[i * 16 + 12], z = matrices[i * 16 + 14];
        if (x < -2417 && x > -2423 && z > 1199 && z < 1204) {
          bars++;
          // A diagonal wire is independently stepped into <=.4 m cardinal
          // cells; its narrowest dimension is at most .4/sqrt(3).
          expect(Math.min(matrices[i * 16], matrices[i * 16 + 5], matrices[i * 16 + 10])).toBeLessThanOrEqual(.232);
          expect(Math.max(matrices[i * 16], matrices[i * 16 + 5], matrices[i * 16 + 10])).toBeLessThanOrEqual(.401);
        }
      }
      expect(bars).toBeGreaterThan(100);
      // Native is a permeable wire lattice, never a hidden solid-filled cage.
      expect(bars).toBeLessThan(1200);
    } finally {
      root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); o.userData.dayMaterial.dispose(); o.userData.nightMaterial.dispose(); } });
    }
  });
});
