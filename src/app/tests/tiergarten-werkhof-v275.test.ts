import { expect, test } from 'bun:test';
import { Group, InstancedMesh, Mesh } from 'three';
import { createTiergartenWerkhofV275 } from '../src/TiergartenWerkhofV275';
import data from '../src/data/tiergartenWerkhofV275.json';
import ownership from '../src/data/tiergartenWerkhofV275Ownership.json';
import { addRequiredSiteEnvelopesV209Steps } from '../src/RequiredSiteEnvelopesV209';
import { tiergartenWerkhofSolidsV275 } from '../src/tiergartenWerkhofV275Profile';
import { compilePedestrianObstacles, pedestrianPointIsBlocked, type PedestrianPolygonObstacle } from '../src/pedestrianNavigation';
import { createMinecraftVoxelWorld, type VoxelPayload } from '../src/MinecraftVoxelWorld';
import { preloadAltMitteNativeV169Source } from '../src/AltMitteNativeCoreV169';
import type { PrismPayload } from '../src/IsometricCityWorld';
import type { VisualMode } from '../src/visualMode';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
import { staticGeometryAudit } from './helpers/staticGeometryAudit';

const ids = new Set(ownership.previousPrisms.map(p => p.id));
const source = { schema_version: 1, classes: ['concrete', 'glass'], buildings: ownership.previousPrisms } as PrismPayload;
const scope = (index: ReturnType<typeof compilePedestrianObstacles>) =>
  [...new Set([...index.cells.values()].flat())].filter(o => o.kind === 'polygon' && ids.has(o.sourceId!)) as PedestrianPolygonObstacle[];

function inspect(native: boolean, mobileLike = false) {
  const root = createTiergartenWerkhofV275(native, { mobileLike });
  try {
    const summary = staticGeometryAudit(root);
    expect(new Set(root.userData.parentIds)).toEqual(new Set(data.parts.map(p => p.parentId)));
    expect(root.userData.parentIds).toHaveLength(20);
    root.traverse(object => {
      expect(object.matrixAutoUpdate).toBe(false);
      if (!(object instanceof Mesh)) return;
      expect(object.userData.textureFree).toBe(true);
      for (const attribute of Object.values(object.geometry.attributes)) {
        for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true);
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        expect(Object.values(material).some(value => value && typeof value === 'object' && 'isTexture' in value)).toBe(false);
      }
      if (object instanceof InstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          const matrix = object.instanceMatrix.array.subarray(i * 16, i * 16 + 16);
          expect([...matrix].every(Number.isFinite)).toBe(true);
          if (native) for (const offset of [1, 2, 4, 6, 8, 9]) expect(Math.abs(matrix[offset])).toBe(0);
          for (const offset of [0, 4, 8]) expect(Math.hypot(matrix[offset], matrix[offset + 1], matrix[offset + 2])).toBeGreaterThan(0);
        }
      }
    });
    return summary;
  } finally { disposeSurroundingCityRoot(root); }
}

test('all twenty actual bodies and fittings remain static, finite, texture-free and identical on mobile', () => {
  const drawn = inspect(false), native = inspect(true);
  expect(inspect(false, true)).toEqual(drawn);
  expect(inspect(true, true)).toEqual(native);
  expect(drawn.budget.draws).toBe(2);
  expect(native.budget.draws).toBe(1);
  // Rounded perimeter crowns replace 107 box estimates within the same batch.
  // Their known 108-byte triangles do not relax the architecture's own bound.
  expect(drawn.budget.bytes - data.counts.estimatedShrubTriangles * 108).toBeLessThan(150_000);
  expect(drawn.budget.bytes).toBeLessThan(400_000);
  expect(native.budget.bytes).toBeLessThan(700_000);
  expect(drawn.budget.instances).toBe(data.counts.drawnDetailBoxes);
  expect(native.budget.instances).toBeGreaterThan(data.counts.nativeBodyCells);
  console.log('Tiergarten Werkhof v275 submitted geometry', { drawn: drawn.budget, native: native.budget });
});

test('every independent native roof cell has its submitted body and open shelters have only thin roof slabs', () => {
  const root = createTiergartenWerkhofV275(true);
  try {
    const mesh = root.children[0] as InstancedMesh;
    const cells = new Map<string, { bottom: number; top: number }[]>();
    for (let i = 0; i < mesh.count; i++) {
      const m = mesh.instanceMatrix.array.subarray(i * 16, i * 16 + 16);
      if (Math.abs(m[0] - 1) > 1e-6 || Math.abs(m[10] - 1) > 1e-6) continue;
      const key = `${m[12] - .5}:${m[14] - .5}`;
      const rows = cells.get(key) ?? [];
      rows.push({ bottom: m[13] - m[5] / 2, top: m[13] + m[5] / 2 });
      cells.set(key, rows);
    }
    for (const part of data.parts) for (const [x, z, top] of part.nativeCells) {
      const actual = cells.get(`${x}:${z}`) ?? [];
      expect(actual.some(row => Math.abs(row.top - top) < .00001 && Math.abs(row.bottom - (top - .25)) < .00001)).toBe(true);
      if (!part.openCanopy) expect(actual.some(row => Math.abs(row.bottom - part.minY) < .00001 && Math.abs(row.top - (top - .25)) < .00001)).toBe(true);
    }
  } finally { disposeSurroundingCityRoot(root); }
});

test('the required-site transaction attaches the complete compound before its first yield in both modes', () => {
  for (const native of [false, true]) {
    const root = new Group(), steps = addRequiredSiteEnvelopesV209Steps(root, native);
    try {
      expect(steps.next().done).toBe(false);
      expect(root.children).toHaveLength(1);
      const attached = root.children[0];
      expect(attached.userData.sourceId).toBe('way/118034165');
      const standalone = createTiergartenWerkhofV275(native);
      try { expect(staticGeometryAudit(attached)).toEqual(staticGeometryAudit(standalone)); }
      finally { disposeSurroundingCityRoot(standalone); }
    } finally {
      steps.return();
      disposeSurroundingCityRoot(root);
    }
  }
});

test('actual navigation replaces the high garage and small roof while the live mode can change back', () => {
  let mode: VisualMode = 'day';
  const before = compilePedestrianObstacles(source);
  const after = compilePedestrianObstacles(source, () => mode, { tiergartenWerkhofV275: true });
  expect(new Set(scope(after).map(p => p.sourceId))).toEqual(ids);
  const garage = [-453.7155, 518.984] as const;
  const canopy = [-452.5311373, 446.0648185] as const;
  expect(pedestrianPointIsBlocked(garage[0], garage[1], 12, before)).toBe(true);
  expect(pedestrianPointIsBlocked(canopy[0], canopy[1], 12, before)).toBe(true);
  for (const native of [false, true, false]) {
    mode = native ? 'minecraft' : 'day';
    expect(pedestrianPointIsBlocked(garage[0], garage[1], 12, after)).toBe(false);
    expect(pedestrianPointIsBlocked(canopy[0], canopy[1], 12, after)).toBe(false);
    expect(pedestrianPointIsBlocked(garage[0], garage[1], 4, after)).toBe(true);
    expect(pedestrianPointIsBlocked(garage[0], garage[1], 6.5, after)).toBe(false);
    expect(pedestrianPointIsBlocked(canopy[0], canopy[1], 3.1, after)).toBe(false);
    const active = tiergartenWerkhofSolidsV275(native);
    for (const part of data.parts) {
      const sample = part.roofTriangles[0].reduce((p, v) => [p[0] + v[0] / 3, p[1] + v[2] / 3], [0, 0]);
      const roof = active.find(s => s.sourceId === part.sourceId)!;
      const obstacles = scope(after).filter(p => p.sourceId === part.sourceId);
      const heights = obstacles.map(o => o.topAt?.(sample[0], sample[1])).filter(y => y !== undefined && y !== Number.NEGATIVE_INFINITY);
      const expected = roof.topAt(sample[0], sample[1]);
      if (expected !== null) expect(heights).toContain(expected);
      for (const y of heights) expect(y!).toBeLessThanOrEqual(roof.maxY + .001);
    }
  }
});

test('changed source and unrelated worlds never silently lose their original collision', () => {
  const old = source.buildings.find(p => p.id === 'K0002L8a')!;
  const changed = { ...old, h_dm: old.h_dm + 1 };
  const index = compilePedestrianObstacles({ ...source, buildings: [changed] }, () => 'day', { tiergartenWerkhofV275: true });
  expect(scope(index)).toHaveLength(1);
  expect(pedestrianPointIsBlocked(-453.7155, 518.984, 12, index)).toBe(true);
  const empty = compilePedestrianObstacles({ ...source, buildings: [] }, () => 'day', { tiergartenWerkhofV275: true });
  expect(scope(empty)).toHaveLength(0);
});

test('all eleven canopy interiors remain clear below their actual sloping roof, while the roof and posts collide', () => {
  let mode: VisualMode = 'day';
  const index = compilePedestrianObstacles(source, () => mode, { tiergartenWerkhofV275: true });
  expect(data.parts.filter(p => p.openCanopy)).toHaveLength(11);
  for (const native of [false, true]) {
    mode = native ? 'minecraft' : 'day';
    const solids = tiergartenWerkhofSolidsV275(native);
    for (const part of data.parts.filter(p => p.openCanopy)) {
      const roof = solids.find(p => p.sourceId === part.sourceId)!;
      for (const triangle of part.roofTriangles) {
        const x = triangle.reduce((sum, p) => sum + p[0], 0) / 3;
        const z = triangle.reduce((sum, p) => sum + p[2], 0) / 3;
        const top = roof.topAt(x, z);
        if (top === null) continue;
        // Test the exact owner's obstacles: adjacent structures must not mask
        // a phantom solid wedge under a sloping shelter roof.
        const own = scope(index).filter(o => o.sourceId === part.sourceId);
        const active = own.filter(o => o.topAt?.(x, z) !== Number.NEGATIVE_INFINITY);
        const ceilings = active.filter(o => o.topAt?.(x, z) === top);
        expect(ceilings.length).toBeGreaterThan(0);
        for (const ceiling of ceilings) {
          const bottom = ceiling.bottomAt?.(x, z) ?? ceiling.minY;
          expect(bottom).toBeGreaterThanOrEqual(top - .251);
          expect(bottom).toBeLessThan(top);
        }
      }
    }
  }
  // A large, isolated shelter witness tests the actual collision query too.
  for (const native of [false, true]) {
    mode = native ? 'minecraft' : 'day';
    expect(pedestrianPointIsBlocked(-452.5311373, 446.0648185, 3.1, index)).toBe(false);
    const top = tiergartenWerkhofSolidsV275(native).find(p => p.sourceId === 'K0003Txs')!.topAt(-452.5311373, 446.0648185)!;
    expect(pedestrianPointIsBlocked(-452.5311373, 446.0648185, top - .1, index)).toBe(true);
  }
});

test('the actual native constructor removes all 166 old high columns and their generic windows only when activated', async () => {
  await preloadAltMitteNativeV169Source();
  const xs = ownership.columns.map(c => c[0]), zs = ownership.columns.map(c => c[1]);
  const minX = Math.min(...xs), minZ = Math.min(...zs);
  const cols = Math.max(...xs) - minX + 1, rows = Math.max(...zs) - minZ + 1;
  const fixture: VoxelPayload = {
    schema_version: 1, cell_m: 4,
    classes: ['grass', 'asphalt', 'water', 'concrete', 'glass', 'plazaBrick', 'bridge', 'basin', 'wall', 'pond'],
    grid: { cols, rows, min_x_idx: minX, min_z_idx: minZ },
    ground_height: { cols, rows, stride_cells: 1, y_dm: Array(cols * rows).fill(32) },
    ground_rows: [], buildings: ownership.columns as [number, number, number, number, number][], trees: [], water_top_y_m: -1.15,
  };
  const counts = (enabled: boolean) => {
    const root = createMinecraftVoxelWorld(fixture, null, null, { sourcePrisms: source.buildings, tiergartenWerkhofV275: enabled });
    try {
      return {
        bodies: (root.getObjectByName('Voxel building columns') as InstancedMesh).count,
        windows: (root.getObjectByName('Voxel facade windows') as InstancedMesh | undefined)?.count ?? 0,
      };
    } finally { disposeSurroundingCityRoot(root); }
  };
  const before = counts(false), after = counts(true);
  expect(before.bodies).toBeGreaterThanOrEqual(166);
  expect(before.windows).toBeGreaterThan(0);
  expect(after).toEqual({ bodies: 0, windows: 0 });
}, 60_000);
