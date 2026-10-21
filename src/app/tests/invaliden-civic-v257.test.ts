import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from 'three';
import { createHbfNorthApproach } from '../src/HbfNorthApproach';
import { invalidenEntryFloorV257At, invalidenEntryTreadsV257 } from '../src/invalidenCivicV257Navigation';

describe('Invaliden civic v257 bounded additive recognition', () => {
  for (const native of [false, true]) test(`preserved prior buffers, exact steps and bounded ${native ? 'native' : 'drawn'} addition`, () => {
    const root = createHbfNorthApproach(() => 5.2, native); root.updateMatrixWorld(true);
    let draws = 0, bytes = 0; const meshes: InstancedMesh[] = [];
    root.traverse(o => { if (!(o instanceof Mesh)) return; draws++; for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength; bytes += o.geometry.index?.array.byteLength ?? 0;
      if (o instanceof InstancedMesh) { meshes.push(o); bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); }
    });
    expect(draws).toBe(native ? 1 : 2); expect(bytes).toBeLessThan(5_000_000);
    const mesh = meshes[0], priorCount = native ? 40414 : 5429;
    const hash = (a: ArrayBufferLike, size: number) => createHash('sha256').update(new Uint8Array(a, 0, size)).digest('hex');
    expect(hash(mesh.instanceMatrix.array.buffer, priorCount * 64)).toBe(native ? '917b8b9f92ae3c1ca59d13d0d560326950ae1cb448d81d542cd0dd7983e7223b' : '64fe74e44191287b4d7fb26a1fac0081af0d50f5d5395d73c56e831d1b3f8bc7');
    expect(hash(mesh.instanceColor!.array.buffer, priorCount * 12)).toBe(native ? '363b86614d4971a98b98dc8c9feeeeda9e3deafcf85dc7fd286344e3be259f2d' : '00f92935f5750c07e504f9f3a1f7e6f2a93b019f2c995298e26b7bd1583374e3');
    expect(mesh.count - priorCount).toBeLessThanOrEqual(native ? 18155 : 5552);
    if (native) { const matrix = new Matrix4(); for (let i = priorCount; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); for (const k of [1, 2, 4, 6, 8, 9]) expect(Math.abs(matrix.elements[k])).toBeLessThan(1e-7); } }
    for (const t of invalidenEntryTreadsV257(native)) {
      const floor = invalidenEntryFloorV257At(t.p[0], t.p[2], native)!;
      const hits = new Raycaster(new Vector3(t.p[0], 7, t.p[2]), new Vector3(0, -1, 0), 0, 2).intersectObject(root, true);
      expect(hits.some(hit => Math.abs(hit.point.y - floor) < .0001)).toBe(true);
    }
    expect(invalidenEntryFloorV257At(440, -1235, native)).toBeNull();
  });
  test('production walking uses exact treads without extending partial grids or overwriting other floors', async () => {
    const { createPedestrianEnvironment } = await import('../src/pedestrianNavigation');
    const ground = await Bun.file(new URL('../public/mesh/regierungsviertel/ground-context.json', import.meta.url)).json();
    const environment = createPedestrianEnvironment(ground, { water: [] });
    for (const native of [false, true]) {
      environment.visualMode = () => native ? 'minecraft' : 'day';
      for (const t of invalidenEntryTreadsV257(native)) expect(environment.groundAt(t.p[0], t.p[2])).toBeCloseTo(invalidenEntryFloorV257At(t.p[0], t.p[2], native)!, 5);
    }
    const limited = createPedestrianEnvironment({ ...ground, grid: { min_x_idx: 0, min_z_idx: 0, cols: 2, rows: 2 } }, { water: [] });
    const t = invalidenEntryTreadsV257(false)[0]; expect(limited.groundAt(t.p[0], t.p[2])).toBeNull();
    expect(environment.groundAt(-333, -1160)).toBeLessThan(-2);
  });
});
