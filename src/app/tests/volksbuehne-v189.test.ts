import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createVolksbuehneV189 } from "../src/VolksbuehneV189";
import source from "../src/data/volksbuehneV189.json";

const [tx, tz] = source.building.frontAxis;
const outward = new Vector3(-tz, 0, tx);

function wheelRay(mesh: Mesh, u: number, height: number): number {
  const p = new Vector3(source.wheel.xz[0] + tx * u, 3 + height, source.wheel.xz[1] + tz * u);
  return new Raycaster(p.addScaledVector(outward, 6), outward.clone().negate(), 0, 12).intersectObject(mesh).length;
}

test("actual drawn and native wheel meshes retain six apertures, spokes and open legs", () => {
  for (const native of [false, true]) {
    const root = createVolksbuehneV189(native); root.updateMatrixWorld(true);
    const mesh = root.children.at(-1) as Mesh;
    expect(mesh.userData.openSectors).toBe(6);
    expect(mesh.userData.plinth).toBe(false);
    for (let i = 0; i < 6; i++) {
      const hole = (i + .5) * Math.PI / 3 + .08;
      const spoke = i * Math.PI / 3 + .08;
      expect(wheelRay(mesh, Math.cos(hole) * .82, 2.62 + Math.sin(hole) * .82)).toBe(0);
      expect(wheelRay(mesh, Math.cos(spoke) * .70, 2.62 + Math.sin(spoke) * .70)).toBeGreaterThan(0);
    }
    expect(wheelRay(mesh, 0, .7)).toBe(0);
    expect(wheelRay(mesh, -.80, .7)).toBeGreaterThan(0);
    expect(wheelRay(mesh, .90, .7)).toBeGreaterThan(0);
    expect(wheelRay(mesh, -.30, .20)).toBeGreaterThan(0);
    expect(wheelRay(mesh, 1.35, .29)).toBeGreaterThan(0);
  }
});

test("six complete grounded column assemblies preserve the measured vertical envelope", () => {
  const root = createVolksbuehneV189();
  expect(root.userData.sourceParentIds).toEqual(["DEBE01YYK00001YG"]);
  expect(root.userData.sourceGeometryRetained).toBe(true);
  const columns = root.children[1] as InstancedMesh;
  expect(columns.userData.columnCount).toBe(6);
  expect(columns.count).toBe(18);
  const m = new Matrix4();
  for (let i = 0; i < 6; i++) {
    columns.getMatrixAt(i * 3 + 1, m);
    expect(m.elements[13] - m.elements[5] / 2).toBeCloseTo(source.building.groundY, 5);
    columns.getMatrixAt(i * 3, m);
    expect(m.elements[13] - m.elements[5] / 2).toBeCloseTo(3.70, 5);
    expect(m.elements[13] + m.elements[5] / 2).toBeLessThan(source.building.topY);
  }
});

test("both bounded modes use exact-capacity image-free geometry and orthogonal native instances", () => {
  for (const native of [false, true]) {
    const root = createVolksbuehneV189(native);
    expect(root.children.length).toBe(native ? 2 : 3);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    let bytes = 0, instances = 0;
    for (const object of root.children) {
      const mesh = object as Mesh;
      expect(mesh.frustumCulled).toBe(true);
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.userData.dayMaterial.map).toBeNull();
      expect(mesh.userData.nightMaterial.map).toBeNull();
      for (const attribute of Object.values(mesh.geometry.attributes)) bytes += attribute.array.byteLength;
      if (mesh.geometry.index) bytes += mesh.geometry.index.array.byteLength;
      if (!(mesh instanceof InstancedMesh)) continue;
      instances += mesh.count;
      bytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
      expect(mesh.instanceMatrix.count).toBe(mesh.count);
      expect(mesh.boundingSphere!.radius).toBeLessThan(75);
      expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      if (native) for (let i = 0; i < mesh.count; i++)
        for (const k of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + k]).toBe(0);
    }
    expect(instances).toBeLessThan(native ? 1600 : 1300);
    expect(bytes).toBeLessThan(native ? 125_000 : 180_000);
  }
});
