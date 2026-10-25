import { expect, test } from 'bun:test';
import { InstancedMesh, Mesh } from 'three';
import data from '../src/data/potsdamerWestV266.json';
import { createPotsdamerWestV266, potsdamerWestRecordsV266, POTSDAMER_WEST_V266_PROFILE } from '../src/PotsdamerWestV266';

function cleanup(root: ReturnType<typeof createPotsdamerWestV266>): void {
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    object.userData.dayMaterial.dispose(); object.userData.nightMaterial.dispose();
  });
}

test('source-part upper completion, separate green shaft and unchanged owner policy', () => {
  expect(POTSDAMER_WEST_V266_PROFILE.publishedShaftHeightM).toBe(106);
  expect(POTSDAMER_WEST_V266_PROFILE.estimatedOfficeRoofHeightM).toBe(85);
  expect(data.profile.shaftOsmId).toBe(591305860);
  expect(data.profile.roles['green-cube-square']).toBe(64);
  expect(data.profile.roles['rogers-secondary-vertical-rail']).toBe(36);
  expect(data.profile.suppressionIds).toEqual([]);
});

test('full drawn detail equals mobile, two bounded texture-free frozen draws', () => {
  const roots = [createPotsdamerWestV266(), createPotsdamerWestV266(false, {mobileLike:true})];
  for (const root of roots) {
    expect(root.children.length).toBe(2); expect(root.matrixAutoUpdate).toBe(false);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.additiveOnly).toBe(true);
    const shell = root.children[0] as Mesh, fittings = root.children[1] as InstancedMesh;
    expect(shell.geometry.getAttribute('position').count).toBe(data.colors.length);
    expect(shell.geometry.getAttribute('uv')).toBeUndefined();
    expect(fittings.instanceMatrix.array.byteLength + fittings.instanceColor!.array.byteLength).toBeLessThan(100_000);
    expect(fittings.userData.dayMaterial.map).toBeNull();
    expect(fittings.matrixAutoUpdate).toBe(false);
  }
  expect((roots[0].children[1] as InstancedMesh).instanceMatrix.array).toEqual((roots[1].children[1] as InstancedMesh).instanceMatrix.array);
  roots.forEach(cleanup);
});

test('native rows are ephemeral recipes with positive dimensions', () => {
  const rows = potsdamerWestRecordsV266(true);
  expect(rows.length).toBe(data.profile.nativeBlocks);
  for (const row of rows) expect((row.slice(3,6) as number[]).every(n => n > 0 && Number.isFinite(n))).toBe(true);
});

test('one independent orthogonal native surface batch with no smooth shell double', () => {
  const root = createPotsdamerWestV266(true), mesh = root.children[0] as InstancedMesh;
  expect(root.children.length).toBe(1); expect(mesh.isInstancedMesh).toBe(true);
  expect(mesh.userData.nativeMinecraft).toBe(true);
  expect(mesh.count).toBe(data.profile.nativeBlocks);
  expect(mesh.count).toBeLessThan(14_000);
  expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(1_064_000);
  const matrix = mesh.instanceMatrix.array;
  for (let i = 0; i < mesh.count; i++) for (const j of [1,2,4,6,8,9]) expect(matrix[i*16+j]).toBe(0);
  expect([...matrix].every(Number.isFinite)).toBe(true);
  cleanup(root);
});
