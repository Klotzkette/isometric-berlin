import { describe, expect, it } from "bun:test";
import { Box3, InstancedMesh, Mesh } from "three";
import { createBreitscheidTowers, createMinecraftBreitscheidTowers, BREITSCHEID_TOWER_RENDER_BUDGET } from "../src/BreitscheidTowers";
import { BREITSCHEID_TOWER_PRISM_IDS, breitscheidTowerRoofAt, breitscheidTowerSourceColumn } from "../src/breitscheidTowersProfile";
import source from "../src/data/breitscheidTowersSource.json";
import nav from "../src/data/breitscheidTowersNavigation.json";

function signature(mobileLike: boolean) {
  const root = createBreitscheidTowers({ mobileLike });
  return root.children.map(child => {
    const mesh = child as Mesh;
    return { positions: [...mesh.geometry.getAttribute("position").array], ...(child instanceof InstancedMesh ? { matrices: [...child.instanceMatrix.array], colors: [...child.instanceColor!.array] } : {}) };
  });
}
describe("Breitscheidplatz measured tower forms", () => {
  it("retains all thirty measured source parts instead of two full-height base prisms", () => {
    expect(BREITSCHEID_TOWER_PRISM_IDS).toEqual(new Set(["74901812", "15777905"]));
    expect(source.parts.filter(p => p.building === "Upper West")).toHaveLength(19);
    expect(source.parts.filter(p => p.building.startsWith("Zoofenster"))).toHaveLength(11);
    expect(source.surfaces).toHaveLength(BREITSCHEID_TOWER_RENDER_BUDGET.sourceSurfaces);
    const zoofenster = source.parts.filter(p => p.building.startsWith("Zoofenster"));
    expect(Math.max(...zoofenster.map(p => p.topY)) - Math.min(...zoofenster.map(p => p.topY))).toBeGreaterThan(90);
    expect(new Set(source.parts.map(p => p.id)).size).toBe(30);
  });
  it("preserves both source roofs for navigation and limits native ownership to exact old cells", () => {
    for (const [a,b,c] of nav.roofTriangles) {
      const x = (a[0]+b[0]+c[0])/3, z = (a[2]+b[2]+c[2])/3;
      const y = breitscheidTowerRoofAt(x,z);
      expect(y).not.toBeNull(); expect(y!).toBeGreaterThanOrEqual((a[1]+b[1]+c[1])/3-.002);
    }
    for (const [x,z,y] of nav.nativeRoofCells) expect(breitscheidTowerRoofAt(x,z,true)).toBe(y);
    expect(breitscheidTowerSourceColumn(-2650,1420,5.2,125.2)).toBe(true);
    expect(breitscheidTowerSourceColumn(-2650,1420,5.2,21.2)).toBe(false);
    expect(breitscheidTowerSourceColumn(-2650,1420,20,140)).toBe(false);
    expect(breitscheidTowerSourceColumn(-2490,1420,5.2,125.2)).toBe(false);
    expect(breitscheidTowerRoofAt(-2490,1420)).toBeNull();
  });
  it("uses identical full mobile detail with only two drawn batches", () => {
    expect(signature(true)).toEqual(signature(false));
    const root = createBreitscheidTowers();
    expect(root.children).toHaveLength(2);
    expect((root.children[1] as InstancedMesh).count).toBe(BREITSCHEID_TOWER_RENDER_BUDGET.facadeInstances);
    for (const mesh of root.children as Mesh[]) {
      expect(mesh.userData.textureFree).toBe(true);
      expect([...mesh.geometry.getAttribute("position").array].every(Number.isFinite)).toBe(true);
    }
    const b = new Box3().setFromObject(root);
    expect(b.max.y).toBeGreaterThan(123); expect(b.max.y).toBeLessThan(128);
    expect(b.min.x).toBeGreaterThan(-2720); expect(b.max.x).toBeLessThan(-2590);
  });
  it("uses only an independent native surface skin with actual window colours", () => {
    const native = createMinecraftBreitscheidTowers();
    expect(native.children).toHaveLength(1);
    const mesh = native.children[0] as InstancedMesh;
    expect(mesh.userData.blockNative).toBe(true);
    expect(mesh.count).toBe(BREITSCHEID_TOWER_RENDER_BUDGET.nativeBlocks);
    expect(mesh.geometry.getAttribute("position").count).toBe(24);
    expect(new Set(source.nativeBlocks.map(b => b[3])).size).toBeGreaterThan(6);
    const upper = source.nativeBlocks.filter(b => b[2] > 1460 && b[1] > 10);
    const zoo = source.nativeBlocks.filter(b => b[2] < 1460 && b[1] > 10);
    // Windows must not dilate across the white aluminium or limestone skin.
    expect(upper.filter(b => b[3] === 0xe4e5dd).length / upper.length).toBeGreaterThan(.45);
    expect(zoo.filter(b => b[3] === 0xcfc8b0).length / zoo.length).toBeGreaterThan(.35);
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(1300000);
  });
});
