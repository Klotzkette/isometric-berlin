import { expect, test } from 'bun:test';
import { InstancedMesh, Mesh } from 'three';
import { CHARITE_LESSER_V261_IDS, CHARITE_RAIL_V261_PROFILE, chariteRailRowsV261, createChariteRailV261 } from '../src/ChariteRailV261';

test('Ruska and Lesser keep distinct identities and bounded facade-only additions', () => {
  expect(CHARITE_LESSER_V261_IDS.size).toBe(4);
  expect(CHARITE_RAIL_V261_PROFILE.virologyBayWindows).toBe(2);
  expect(CHARITE_RAIL_V261_PROFILE.lesserFloors).toBe(5);
  for (const native of [false, true]) {
    const rows = chariteRailRowsV261(native);
    for (const r of rows) {
      expect(r.every(Number.isFinite)).toBe(true);
      expect(r.slice(3, 6).every(v => v > 0)).toBe(true);
      expect(r[0]).toBeGreaterThan(430); expect(r[0]).toBeLessThan(520);
      expect(r[2]).toBeGreaterThan(-935); expect(r[2]).toBeLessThan(-845);
      expect(r[1] - r[4] / 2).toBeGreaterThan(5);
      expect(r[1] + r[4] / 2).toBeLessThan(32);
      if (native) expect(r[6]).toBe(0);
    }
    const root = createChariteRailV261(native);
    expect(root.userData.sourceEnvelopeRetained).toBe(true);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    let calls = 0, bytes = 0;
    root.traverse(o => {
      expect(o.matrixAutoUpdate).toBe(false);
      if (!(o instanceof Mesh)) return;
      calls++; expect(o.userData.textureFree).toBe(true);
      expect(o).toBeInstanceOf(InstancedMesh);
      const mesh = o as InstancedMesh;
      bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      expect(mesh.count).toBe(rows.length);
      mesh.geometry.dispose();
      o.userData.dayMaterial.dispose(); o.userData.nightMaterial.dispose();
    });
    expect(calls).toBe(1); expect(bytes).toBeLessThan(1_500_000);
    console.log({ native, instances: rows.length, bytes });
  }
});
