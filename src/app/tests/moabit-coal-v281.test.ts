import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, Mesh } from 'three';
import { createMoabitCoalV281 } from '../src/MoabitCoalV281';
import { MOABIT_COAL_V281 as P, moabitCoalBodyBlockedV281, moabitCoalFacetsV281, moabitCoalFloorV281At, moabitCoalFrameV281, moabitCoalInsideV281, moabitCoalMembersV281, moabitCoalNativeMembersV281 } from '../src/moabitCoalV281Profile';
import source from '../../../geo_data/regierungsviertel/moabit-coal-v281-source.json';
import { disposeStaticAudit, staticGeometryAudit } from './helpers/staticGeometryAudit';

test('Moabit coal handling retains all original owners and exact selected OSM courses', () => {
  for (const [path, hash] of Object.entries(source.retainedBefore)) {
    const bytes = readFileSync(new URL('../../../' + path, import.meta.url));
    expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(hash);
  }
  for (const feature of source.features) {
    const value = P[feature.role as 'heap'];
    expect(value.id).toBe(String(feature.osmId)); expect(value.ring).toEqual(feature.worldRing);
    expect(feature.nodes.length).toBe(feature.lonLat.length); expect(feature.nodes.length).toBe(feature.worldRing.length);
  }
  expect(source.features.find(p => p.role === 'craneTravel')!.tags['crane:mobile']).toBe('rail');
  expect(P.craneTravel.id).not.toBe(P.shipUnloader.id);
});

test('open portal structure has full equal mobile geometry and independent cardinal native construction', () => {
  const audits = [];
  for (const native of [false, true]) for (const mobileLike of [false, true]) {
    const root = createMoabitCoalV281(native, { mobileLike });
    try {
      root.traverse(object => {
        expect(object.matrixAutoUpdate).toBe(false);
        if (!(object instanceof Mesh)) return;
        expect(object.userData.textureFree).toBe(true); expect(object.geometry.getAttribute('uv')).toBeUndefined();
        for (const attribute of Object.values(object.geometry.attributes)) expect([...attribute.array].every(Number.isFinite)).toBe(true);
        if (!(object instanceof InstancedMesh)) return;
        expect(object.userData.dayMaterial.vertexColors).toBe(false);
        expect(object.userData.nightMaterial.vertexColors).toBe(false);
        expect(object.instanceColor).not.toBeNull();
        expect([...object.instanceColor!.array].some(value => value > .1)).toBe(true);
        const matrix = new Matrix4();
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, matrix); expect(matrix.determinant()).toBeGreaterThan(0);
          if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[j]).toBe(0);
        }
      });
      audits.push(staticGeometryAudit(root));
    } finally { disposeStaticAudit(root); }
  }
  expect(audits[0]).toEqual(audits[1]); expect(audits[2]).toEqual(audits[3]);
  expect(audits[0].budget.draws).toBe(2); expect(audits[2].budget.draws).toBe(1);
  expect(audits[0].budget.bytes).toBeLessThan(100_000); expect(audits[2].budget.bytes).toBeLessThan(650_000);
  expect(audits[2].budget.instances).toBeGreaterThan(audits[0].budget.instances);
  console.log('Moabit coal submitted geometry', { drawn: audits[0].budget, native: audits[2].budget });
});

test('coal piles stay in the exact heap and navigation follows each mode without closing public roads', () => {
  const f = moabitCoalFrameV281();
  for (const triangle of moabitCoalFacetsV281()) for (const [x, y, z] of triangle) {
    expect(moabitCoalInsideV281(x, z, P.heap.ring)).toBe(true);
    expect(moabitCoalFloorV281At(x, z)).toBeGreaterThanOrEqual(y - .00001);
  }
  for (const native of [false, true]) {
    for (const [x, z] of [[-1607, -2160], [-1580, -2160], [-1510, -2163], [-1490, -2185]]) {
      expect(moabitCoalBodyBlockedV281(x, z, P.groundY, P.groundY + 1.8, .3, native)).toBe(false);
      expect(moabitCoalFloorV281At(x, z, native)).toBeNull();
    }
    const pile = f.at(49, 0, 22), top = moabitCoalFloorV281At(pile[0], pile[2], native)!;
    expect(top).toBeGreaterThan(P.groundY + 6);
    expect(moabitCoalBodyBlockedV281(pile[0], pile[2], top - 1, top + .8, .2, native)).toBe(true);
    expect(moabitCoalBodyBlockedV281(pile[0], pile[2], top + .01, top + 1.81, .2, native)).toBe(false);
    // The very large mapped crane area is never itself a solid ceiling/body.
    const open = f.at(5, 12, 35);
    expect(moabitCoalBodyBlockedV281(open[0], open[2], open[1], open[1] + 1.8, .2, native)).toBe(false);
  }
  const posts = moabitCoalMembersV281().filter(p => p.role === 'portal-leg');
  expect(posts.length).toBe(4);
  for (const p of posts) {
    const at = p.a.map((v, i) => (v + p.b[i]) / 2);
    expect(moabitCoalBodyBlockedV281(at[0], at[2], at[1] - .1, at[1] + .1, .1)).toBe(true);
  }
  expect(moabitCoalNativeMembersV281().every(row => row.every(Number.isFinite) && row.slice(3, 6).every(v => v > 0))).toBe(true);
});
