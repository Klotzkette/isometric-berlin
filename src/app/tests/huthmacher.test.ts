import { afterAll, describe, expect, test } from "bun:test";
import { Box3, BufferGeometry, Group, InstancedMesh, Material, Mesh, Texture } from "three";
import { createHuthmacherHaus, createMinecraftHuthmacherHaus, HUTHMACHER_RENDER_BUDGET } from "../src/HuthmacherHaus";
import { HUTHMACHER_PRISM_IDS, huthmacherContains, huthmacherRoofAt, huthmacherSourceColumn } from "../src/huthmacherProfile";
import source from "../src/data/huthmacherSource.json";
import nav from "../src/data/huthmacherNavigation.json";

const drawn = createHuthmacherHaus(), mobile = createHuthmacherHaus({ mobileLike: true });
const native = createMinecraftHuthmacherHaus(), nativeMobile = createMinecraftHuthmacherHaus({ mobileLike: true });
function signature(root: Group) {
  return (root.children as Mesh[]).map(m => ({ positions: [...m.geometry.getAttribute("position").array],
    ...(m instanceof InstancedMesh ? { matrices: [...m.instanceMatrix.array], colors: [...m.instanceColor!.array] } : {}) }));
}
afterAll(() => {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  for (const root of [drawn, mobile, native, nativeMobile]) root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    geometries.add(o.geometry);
    for (const m of [o.material, o.userData.dayMaterial, o.userData.nightMaterial].flat()) if (m instanceof Material) materials.add(m);
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
});

describe("Huthmacher complete source skyline", () => {
  test("retains ten measured parts including the lower backs and technical roof crown", () => {
    expect(HUTHMACHER_PRISM_IDS).toEqual(new Set(["64359480"]));
    expect(source.parts).toHaveLength(10);
    expect(source.surfaces).toHaveLength(64);
    expect(new Set(source.parts.map(p => p.parentId))).toEqual(new Set(["DEBE00YY1EZ0000e"]));
    expect(new Set(source.parts.map(p => p.id))).toEqual(new Set(source.surfaces.map(s => s.partId)));
    expect(Math.max(...source.parts.map(p => p.heightM))).toBe(61.703);
    expect(Math.min(...source.parts.map(p => p.heightM))).toBe(4.622);
    expect(source.legacyPrisms[0].h_dm).toBe(480);
    expect(source.sourceConflict.legacyOnlyAreaM2).toBeCloseTo(56.060005, 4);
    expect(source.sourceConflict.officialOnlyAreaM2).toBeCloseTo(202.930612, 4);
    const bounds = new Box3().setFromObject(drawn);
    expect(bounds.max.y).toBeCloseTo(66.902, 2);
    expect(bounds.min.x).toBeGreaterThan(-2635); expect(bounds.max.x).toBeLessThan(-2572);
  });
  test("walkable roof samples match every source roof triangle and native top", () => {
    for (const [a,b,c] of nav.roofTriangles) {
      const x=(a[0]+b[0]+c[0])/3, z=(a[2]+b[2]+c[2])/3;
      expect(huthmacherContains(x,z)).toBe(true);
      expect(huthmacherRoofAt(x,z)!).toBeGreaterThanOrEqual((a[1]+b[1]+c[1])/3-.002);
    }
    for (const [x,z,y] of nav.nativeRoofCells) expect(huthmacherRoofAt(x,z,true)).toBe(y);
    expect(huthmacherSourceColumn(-2600,1338,5.2,53.2)).toBe(true);
    expect(huthmacherSourceColumn(-2600,1338,5.2,57.2)).toBe(false);
    expect(huthmacherSourceColumn(-2600,1338,9.2,57.2)).toBe(false);
    expect(huthmacherSourceColumn(-2450,1400,5.2,53.2)).toBe(false);
    expect(huthmacherRoofAt(-2450,1400)).toBeNull();
  });
  test("both touch profiles retain all static detail in bounded texture-free batches", () => {
    expect(signature(drawn)).toEqual(signature(mobile));
    expect(signature(native)).toEqual(signature(nativeMobile));
    expect(drawn.children).toHaveLength(2); expect(native.children).toHaveLength(1);
    expect((drawn.children[1] as InstancedMesh).count).toBe(HUTHMACHER_RENDER_BUDGET.facadeInstances);
    expect((native.children[0] as InstancedMesh).count).toBe(HUTHMACHER_RENDER_BUDGET.nativeBlocks);
    for (const [root,budget] of [[drawn,220000],[native,320000]] as const) {
      let bytes=0;
      root.traverse(o => {
        expect(o.matrixAutoUpdate).toBe(false);
        if (!(o instanceof Mesh)) return;
        for (const a of Object.values(o.geometry.attributes)) { bytes+=a.array.byteLength; expect([...a.array].every(Number.isFinite)).toBe(true); }
        bytes+=o.geometry.index?.array.byteLength??0;
        if (o instanceof InstancedMesh) { bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength; expect([...o.instanceMatrix.array].every(Number.isFinite)).toBe(true); }
        for (const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat()) if (m instanceof Material) expect(Object.values(m).some(v=>v instanceof Texture)).toBe(false);
      });
      expect(bytes).toBeLessThan(budget);
    }
  });
  test("native rendering is exterior cuboids with clear pale spandrels, without a smooth double", () => {
    const mesh=native.children[0] as InstancedMesh;
    expect(mesh.userData.blockNative).toBe(true);
    expect(mesh.geometry.getAttribute("position").count).toBe(24);
    expect(source.nativeBlocks.filter(b=>b[3]===0xd1cec0).length/source.nativeBlocks.length).toBeGreaterThan(.65);
    expect(new Set(source.nativeBlocks.map(b=>b.slice(0,3).join(","))).size).toBe(source.nativeBlocks.length);
  });
});
