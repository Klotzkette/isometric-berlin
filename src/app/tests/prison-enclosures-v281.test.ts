import { expect, test } from 'bun:test';
import { InstancedMesh, Matrix4, Mesh } from 'three';
import { createPrisonEnclosuresV281, PRISON_ENCLOSURES_V281_PROFILE as profile,
  prisonEnclosuresV281SolidAt as solid } from '../src/PrisonEnclosuresV281';

function snapshot(native: boolean, mobileLike = false) {
  const root = createPrisonEnclosuresV281(native, { mobileLike });
  let bytes = 0, instances = 0;
  const arrays: number[][] = [], m = new Matrix4();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    expect(object.matrixAutoUpdate).toBe(false);
    expect(object.geometry.getAttribute('uv')).toBeUndefined();
    expect(object.userData.dayMaterial.map).toBeNull();
    for (const a of Object.values(object.geometry.attributes)) bytes += a.array.byteLength;
    bytes += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) {
      expect(object.userData.dayMaterial.vertexColors).toBe(false);
      expect(object.userData.nightMaterial.vertexColors).toBe(false);
      expect(object.instanceColor).not.toBeNull();
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      instances += object.count; arrays.push([...object.instanceMatrix.array]);
      if (native) for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, m);
        for (const k of [1, 2, 4, 6, 8, 9]) expect(m.elements[k]).toBe(0);
      }
    }
  });
  return { root, bytes, instances, arrays };
}

test('two separately culled sites retain full mobile detail and bounded independent families', () => {
  for (const native of [false, true]) {
    const full = snapshot(native), mobile = snapshot(native, true);
    expect(full.root.children).toHaveLength(2);
    expect(full.root.userData.historicalParkUnchanged).toBe(true);
    expect(full.root.userData.noSourceReplacement).toBe(true);
    expect(full.arrays).toEqual(mobile.arrays);
    expect(full.bytes).toBeLessThan(native ? 58_000 : 35_000);
    expect(full.instances).toBe(native ? 740 : 333);
  }
});

test('every mapped gate stays open and represented outer walls collide in both families', () => {
  for (const native of [false, true]) {
    for (const [x, z] of profile.gatePoints) expect(solid(x, 7, z, .2, native)).toBe(false);
    const [ax, az, bx, bz] = profile.walls[1];
    expect(solid((ax + bx) / 2, 7, (az + bz) / 2, 0, native)).toBe(true);
    expect(solid(-1090, 7, -690, 0, native)).toBe(false);
    expect(solid(8900, 5, -2345, 0, native)).toBe(false);
    expect(solid(-1018, 30, -581, 0, native)).toBe(false);
  }
});

test('worlds own their buffers and materials independently', () => {
  const a = createPrisonEnclosuresV281(), b = createPrisonEnclosuresV281();
  const aa = a.children[0].children[0] as InstancedMesh;
  const bb = b.children[0].children[0] as InstancedMesh;
  expect(aa.geometry).not.toBe(bb.geometry); expect(aa.material).not.toBe(bb.material);
  expect(aa.instanceMatrix.array).not.toBe(bb.instanceMatrix.array);
});

test('native wall collision agrees with every packed visible one-metre cell', () => {
  const mesh = createPrisonEnclosuresV281(true, {}, 'moabit').children[0] as InstancedMesh;
  const matrix = new Matrix4();
  let checked = 0;
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    const m = matrix.elements;
    if (m[5] !== 5) continue;
    for (let x = m[12] - m[0] / 2 + .5; x < m[12] + m[0] / 2; x++)
      for (let z = m[14] - m[10] / 2 + .5; z < m[14] + m[10] / 2; z++) {
        expect(solid(x, 7, z, 0, true)).toBe(true); checked++;
      }
  }
  expect(checked).toBeGreaterThan(400);
  const tower = profile.towers[2], [a, b] = tower.ring;
  expect(solid((a[0] + b[0]) / 2, 8, (a[1] + b[1]) / 2)).toBe(true);
  expect(solid((a[0] + b[0]) / 2, 5, (a[1] + b[1]) / 2)).toBe(false);
});
