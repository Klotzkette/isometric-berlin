import { describe, expect, test } from "bun:test";
import { Box3, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Vector3 } from "three";
import { createLegoGiraffeV216, LEGO_GIRAFFE_V216_PROFILE } from "../src/LegoGiraffeV216";

function instances(mesh: InstancedMesh): Box3[] {
  const matrix = new Matrix4(), unit = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5));
  return Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, matrix);
    return unit.clone().applyMatrix4(matrix);
  });
}

describe("current May 2022 LEGO giraffe v216", () => {
  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: one bounded batch has six-metre feet-to-horn bounds and four open legs`, () => {
    const root = createLegoGiraffeV216(native), mesh = root.children[0] as InstancedMesh;
    expect(root.children).toHaveLength(1);
    expect(mesh).toBeInstanceOf(InstancedMesh);
    expect(mesh.count).toBeLessThanOrEqual(native ? 500 : 1500);
    expect(root.userData.gpuBytes).toBeLessThan(native ? 40_000 : 120_000);
    expect(mesh.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(mesh.boundingBox!.max.y).toBeCloseTo(6, 6);
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(root.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(root.userData.nativeMinecraft).toBe(native);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    const boxes = instances(mesh);
    const feet = boxes.filter((box) => box.min.y < .01);
    expect(feet).toHaveLength(4);
    expect(new Set(feet.map((box) => {
      const p = box.getCenter(new Vector3());
      return `${Math.sign(p.x)}:${Math.sign(p.z)}`;
    })).size).toBe(4);
    // Both the longitudinal belly opening and the transverse leg gaps must stay empty.
    for (const point of [[0, .5, -.67], [0, 1.2, 1.0], [.4, 1.5, 0], [0, 2, 0]]) {
      expect(boxes.some((box) => box.containsPoint(new Vector3(...point)))).toBe(false);
    }
    // Long neck joins the body to the forward (-Z) head; broad ears stay above the body.
    expect(boxes.some((box) => box.min.y < 4.1 && box.max.y > 4.1 && box.min.z < -.8)).toBe(true);
    expect(boxes.some((box) => box.max.z < -1.4 && box.min.y > 5)).toBe(true);
    expect(boxes.some((box) => box.max.x > .89 && box.min.y > 5.3)).toBe(true);
    expect(boxes.some((box) => box.min.x < -.89 && box.min.y > 5.3)).toBe(true);
    expect(boxes.some((box) => box.min.z > 1.4 && box.max.y < 2.2)).toBe(true);
    expect(root.userData.interiorCellsOmitted).toBeGreaterThan(0);
    // Stored geometry really is orthogonal boxes, not a marker on smooth primitives.
    const matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      expect([1, 2, 4, 6, 8, 9].every((j) => matrix.elements[j] === 0)).toBe(true);
      expect([0, 5, 10].every((j) => matrix.elements[j] > 0)).toBe(true);
    }
    expect(mesh.geometry.getAttribute("position").count).toBe(24);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect((mesh.material as MeshBasicMaterial).map).toBeNull();
  });

  test("both independent readings retain the current rainbow, cyan cuffs, red lips and white eyes", () => {
    for (const native of [false, true]) {
      const root = createLegoGiraffeV216(native), mesh = root.children[0] as InstancedMesh;
      const colour = new Color(), matrix = new Matrix4();
      const colours = new Set<number>(), cuffs: number[] = [], lips: number[] = [], eyes: number[] = [];
      for (let i = 0; i < mesh.count; i++) {
        mesh.getColorAt(i, colour); mesh.getMatrixAt(i, matrix);
        const hex = colour.getHex(), y = matrix.elements[13], z = matrix.elements[14];
        colours.add(hex);
        if (hex === 0x4dd7e8 && y < .3) cuffs.push(i);
        if (hex === 0xf23b20 && y > 5 && z < -1.5) lips.push(i);
        if (hex === 0xfffbea && y > 5) eyes.push(i);
      }
      for (const hex of [0xffcf06, 0xff8b12, 0xf23b20, 0x4dd7e8, 0x0754d9, 0x682fc1, 0x079650, 0x17171b, 0xfffbea]) {
        expect(colours.has(hex)).toBe(true);
      }
      expect(cuffs).toHaveLength(4);
      expect(lips.length).toBeGreaterThanOrEqual(2);
      expect(eyes).toHaveLength(4);
    }
  });

  test("fresh deterministic buffers and source metadata permit independent disposal and placement", () => {
    const first = createLegoGiraffeV216(), second = createLegoGiraffeV216();
    const a = first.children[0] as InstancedMesh, b = second.children[0] as InstancedMesh;
    expect(a.geometry).not.toBe(b.geometry);
    expect(a.material).not.toBe(b.material);
    expect(a.instanceMatrix.array).not.toBe(b.instanceMatrix.array);
    expect(Array.from(a.instanceMatrix.array)).toEqual(Array.from(b.instanceMatrix.array));
    expect(Array.from(a.instanceColor!.array)).toEqual(Array.from(b.instanceColor!.array));
    first.position.set(10, 4, 20); first.updateMatrixWorld(true);
    expect(new Box3().setFromObject(first).min.y).toBeCloseTo(4, 6);
    expect(new Box3().setFromObject(second).min.y).toBeCloseTo(0, 6);
    expect(LEGO_GIRAFFE_V216_PROFILE.reference.license).toBe("CC0-1.0");
    expect(LEGO_GIRAFFE_V216_PROFILE.reference.author).toBe("Singlespeedfahrer");
    expect(first.userData.geometryStatus).toContain("display estimates");
  });
});
