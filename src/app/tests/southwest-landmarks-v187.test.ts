import { expect, test } from "bun:test";
import { BufferGeometry, InstancedMesh, Matrix4, Mesh } from "three";
import { createSouthWestLandmarksV187 } from "../src/SouthWestLandmarksV187";
import source from "../src/data/southWestLandmarksV187.json";

test("southwest sites retain complete measured shells in independently culled groups", () => {
  const root = createSouthWestLandmarksV187();
  expect(root.children).toHaveLength(4);
  expect(root.userData.textureFree).toBe(true);
  expect(root.userData.fullStaticDetailOnTouch).toBe(true);
  expect(source.sites.map(s => s.key)).toEqual(["fu", "dahlem", "mexiko", "steglitz"]);
  expect(source.sites[3].surfaces.length).toBe(0);
  let bytes = 0, shells = 0;
  root.traverse(object => {
    expect(object.matrixAutoUpdate).toBe(false);
    if (!(object instanceof Mesh)) return;
    expect(object.frustumCulled).toBe(true);
    const geometry = object.geometry as BufferGeometry;
    expect(geometry.getAttribute("uv")).toBeUndefined();
    for (const a of Object.values(geometry.attributes)) bytes += a.array.byteLength;
    if (object instanceof InstancedMesh) {
      bytes += object.instanceMatrix.array.byteLength + object.instanceColor!.array.byteLength;
      expect(object.boundingSphere!.radius).toBeLessThan(250);
    } else if (object.userData.fullSourceShell) {
      shells++;
      expect(geometry.boundingSphere!.radius).toBeLessThan(250);
      expect([...geometry.getAttribute("position").array].every(Number.isFinite)).toBe(true);
    }
  });
  expect(shells).toBe(3);
  expect(bytes).toBeLessThan(1_600_000);
});

test("native mode uses only bounded independent exterior boxes, without drawn double", () => {
  const root = createSouthWestLandmarksV187(true), m = new Matrix4();
  expect(root.userData.blockNative).toBe(true);
  let instances = 0;
  for (const site of root.children) {
    expect(site.children).toHaveLength(1);
    const mesh = site.children[0] as InstancedMesh;
    expect(mesh).toBeInstanceOf(InstancedMesh);
    expect(mesh.userData.blockNative).toBe(true);
    instances += mesh.count;
    for (let i=0; i<mesh.count; i++) {
      mesh.getMatrixAt(i,m);
      for (const j of [1,2,4,6,8,9]) expect(m.elements[j]).toBe(0);
      expect(m.elements.every(Number.isFinite)).toBe(true);
    }
  }
  expect(instances).toBeLessThan(55_000);
});
