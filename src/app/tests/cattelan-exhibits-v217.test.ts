import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { CATTELAN_EXHIBITS_V217, createCattelanExhibitsV217, createCattelanRooftopFigureV217 } from "../src/CattelanExhibitsV217";

describe("photo-informed Cattelan exhibition v217", () => {
  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: bounded full exhibition keeps finite independent texture-free buffers`, () => {
    const root = createCattelanExhibitsV217(native), bounds = new Box3().setFromObject(root);
    expect(root.userData.exhibitInventory).toHaveLength(6);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.nativeMinecraft).toBe(native);
    expect(root.userData.geometryStatus).toContain("estimates");
    expect(root.userData.gpuBytes).toBeLessThan(200_000);
    expect(root.children.length).toBeLessThanOrEqual(4);
    expect(bounds.min.y).toBeGreaterThan(-.00001);
    expect(bounds.max.y).toBeLessThan(8.3);
    expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThan(23);
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      expect((object.material as MeshBasicMaterial).map).toBeNull();
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      for (const attribute of Object.values(object.geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      const positionCount = object.geometry.getAttribute("position").count;
      if (object.geometry.index) expect(Array.from(object.geometry.index.array).every(i => i >= 0 && i < positionCount)).toBe(true);
      if (native) {
        expect(object).toBeInstanceOf(InstancedMesh);
        const instanced = object as InstancedMesh, matrix = new Matrix4();
        expect(instanced.geometry.getAttribute("position").count).toBe(24);
        let orthogonal = true;
        for (let i = 0; i < instanced.count; i++) {
          instanced.getMatrixAt(i, matrix);
          orthogonal &&= [1, 2, 4, 6, 8, 9].every(j => matrix.elements[j] === 0)
            && [0, 5, 10].every(j => matrix.elements[j] > 0);
        }
        expect(orthogonal).toBe(true);
      }
    });
    const second = createCattelanExhibitsV217(native);
    expect((root.children[0] as Mesh).geometry).not.toBe((second.children[0] as Mesh).geometry);
    root.position.set(0, 12, 0); root.updateMatrixWorld(true);
    expect(new Box3().setFromObject(root).min.y).toBeCloseTo(12, 5);
    expect(new Box3().setFromObject(second).min.y).toBeCloseTo(0, 5);
  });

  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: steel tube has two open ends and a real surrounding shell`, () => {
    const root = createCattelanExhibitsV217(native); root.updateMatrixWorld(true);
    const { center: [x, y, z], length } = CATTELAN_EXHIBITS_V217.tube;
    // A body-sized set of rays must pass all the way through both ends; a cap would fail this.
    for (const dy of [-.55, 0, .55]) for (const dz of [-.45, 0, .45]) {
      const ray = new Raycaster(new Vector3(x - length / 2 - .2, y + dy, z + dz), new Vector3(1, 0, 0), 0, length + .4);
      expect(ray.intersectObject(root, true)).toHaveLength(0);
    }
    const wallRay = new Raycaster(new Vector3(x, y, z), new Vector3(0, 0, 1), 0, 2);
    expect(wallRay.intersectObject(root, true).length).toBeGreaterThan(0);
  });

  test("four white floor shrouds contain actual indexed cloth folds, not flat bounding boxes", () => {
    const root = createCattelanExhibitsV217();
    const cloth = root.children.find(child => child instanceof Mesh && !(child instanceof InstancedMesh)) as Mesh;
    expect(cloth).toBeDefined();
    const vertices = cloth.geometry.getAttribute("position"), normals = cloth.geometry.getAttribute("normal");
    for (const [x, , z] of CATTELAN_EXHIBITS_V217.marbleShrouds) {
      const heights: number[] = [], slopes: number[] = [];
      for (let i = 0; i < vertices.count; i++) {
        if (Math.abs(vertices.getX(i) - x) < .7 && Math.abs(vertices.getZ(i) - z) < 1.4) {
          heights.push(vertices.getY(i)); slopes.push(normals.getY(i));
        }
      }
      expect(heights.length).toBeGreaterThan(500);
      expect(Math.min(...heights)).toBeLessThan(.015);
      expect(Math.max(...heights)).toBeGreaterThan(.36);
      expect(Math.max(...heights)).toBeLessThan(.65);
      expect(new Set(heights.map(h => Math.round(h * 1000))).size).toBeGreaterThan(100);
      expect(Math.min(...slopes)).toBeLessThan(.8);
    }
  });

  test("small seated rooftop drummer retains hanging feet and separate native construction", () => {
    for (const native of [false, true]) {
      const root = createCattelanRooftopFigureV217(native), bounds = new Box3().setFromObject(root);
      expect(root.userData.gpuBytes).toBeLessThan(12_000);
      expect(bounds.min.y).toBeLessThan(-.3);
      expect(bounds.max.y).toBeGreaterThan(.9);
      expect(bounds.max.y).toBeLessThan(1);
      expect(root.userData.nativeMinecraft).toBe(native);
    }
  });
});
