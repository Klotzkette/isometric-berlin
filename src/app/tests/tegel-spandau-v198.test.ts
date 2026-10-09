import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createTegelSpandauV198, tegelSpandauV198GroundAt, tegelSpandauV198WaterAt } from "../src/TegelSpandauV198";
import nav from "../src/data/tegelSpandauV198Navigation.json";
import { staticGeometryAudit } from "./helpers/staticGeometryAudit";

test("both styles keep fixed, final-count, texture-free independently culled geometry under 1 MiB", () => {
  for (const native of [false, true]) {
    const root = createTegelSpandauV198(native), matrix = new Matrix4();
    const { budget: audit } = staticGeometryAudit(root);
    expect(root.children).toHaveLength(4);
    expect(audit.bytes).toBeLessThan(1024 * 1024);
    expect(audit.draws).toBe(native ? 4 : 5);
    expect(audit.instances).toBe(native ? 7861 : 884);
    root.traverse(o => {
      expect(o.matrixAutoUpdate).toBe(false);
      if (!(o instanceof Mesh)) return;
      expect(o.frustumCulled).toBe(true);
      expect(o.geometry.boundingSphere).not.toBeNull();
      expect(o.geometry.boundingBox).not.toBeNull();
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      expect(o.userData.dayMaterial.map).toBeNull();
      expect(o.userData.nightMaterial.map).toBeNull();
      expect(o.userData.blockNative).toBe(native);
      if (o instanceof InstancedMesh) {
        expect(o.count).toBe(o.instanceMatrix.count);
        expect(o.instanceColor?.count).toBe(o.count);
        expect(o.boundingSphere).not.toBeNull();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, matrix);
          expect(matrix.elements.every(Number.isFinite)).toBe(true);
          if (native) for (const index of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[index]).toBe(0);
        }
      }
    });
  }
});

test("harbour water agrees with actual submitted triangles and leaves the retained separating pier dry", () => {
  for (const native of [false, true]) {
    const root = createTegelSpandauV198(native);
    const water = root.children[3].children[0] as Mesh;
    const positions = water.geometry.getAttribute("position"), indices = water.geometry.index!;
    for (let i = 0; i < indices.count; i += 3) {
      let x = 0, z = 0;
      for (let j = 0; j < 3; j++) {
        const index = indices.getX(i + j);
        x += positions.getX(index) / 3; z += positions.getZ(index) / 3;
        expect(positions.getY(index)).toBeCloseTo(-1.15, 5);
      }
      expect(tegelSpandauV198WaterAt(x, z, native)).toBe(-1.15);
    }
    expect(tegelSpandauV198WaterAt(-6619, -8063, native)).toBeNull();
    expect(tegelSpandauV198WaterAt(0, 0, native)).toBeNull();
    // A walking query takes deck support before the water below the same bridge.
    expect(tegelSpandauV198WaterAt(-6608, -8048, native)).toBe(-1.15);
    expect(tegelSpandauV198GroundAt(-6608, -8048, native)).toBeCloseTo(nav.deckY, 8);
  }
});

test("walking callback covers actual deck in each style and never fills neighbouring water", () => {
  for (const native of [false, true]) {
    expect(tegelSpandauV198GroundAt(-6600, -8041, native)).toBeCloseTo(nav.deckY, 8);
    expect(tegelSpandauV198GroundAt(-6600, -8010, native)).toBeNull();
    expect(tegelSpandauV198GroundAt(-8000, -6500, native)).toBeNull();
    expect(tegelSpandauV198GroundAt(0, 0, native)).toBeNull();
  }
  for (const r of nav.nativeDeck) expect(tegelSpandauV198GroundAt(r[0], r[2], true)).toBeCloseTo(r[1] + r[4] / 2, 8);
});
