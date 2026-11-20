import { expect, test } from "bun:test";
import { Box3, Matrix4, Mesh, Raycaster, Vector3, type InstancedMesh } from "three";
import { createSteelRailBridgesV369, type SteelRailSpanV369 } from "../src/SteelRailBridgesV369";

const straight: SteelRailSpanV369 = { course: [[0, 10, 0], [24, 10, 0]], width: 5, form: "steel" };
const matrix = new Matrix4();
const cube = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5));

function members(mesh: InstancedMesh) {
  return Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, matrix);
    expect(matrix.determinant()).toBeGreaterThan(0);
    return cube.clone().applyMatrix4(matrix);
  });
}

function heightAt(object: Mesh, x: number, z: number) {
  object.updateMatrixWorld();
  return new Raycaster(new Vector3(x, 40, z), new Vector3(0, -1, 0)).intersectObject(object)[0]?.point.y ?? null;
}

test("host finishing follows varying rail level and leaves the track and street passage clear", () => {
  const course = [[0, 10, 0], [13, 10.5, 0], [26, 11, 2]];
  for (const native of [false, true]) {
    const mesh = createSteelRailBridgesV369([{ ...straight, course, form: "girder" }], native)!;
    expect(mesh.children.length).toBe(0);
    expect(mesh.boundingBox!.min.y).toBeGreaterThan(8.95);
    expect(mesh.boundingBox!.max.y).toBeLessThan(10.83);
    expect(mesh.boundingSphere!.radius).toBeGreaterThan(13);
    const boxes = members(mesh);
    expect(boxes.some(b => b.min.x > 20 && b.min.y > 9.6)).toBe(true);
    const trackLevel = new Vector3(10, 10.4, 0);
    expect(boxes.some(b => b.containsPoint(trackLevel))).toBe(false);
    const fromBelow = new Raycaster(new Vector3(8, 4, -20), new Vector3(0, 0, 1));
    mesh.updateMatrixWorld();
    expect(fromBelow.intersectObject(mesh)).toHaveLength(0);
    if (native) for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      expect([1, 2, 4, 6, 8, 9].map(k => matrix.elements[k])).toEqual([0, 0, 0, 0, 0, 0]);
    }
  }
});

test("steel or material-only truss tags do not create an overhead frame", () => {
  for (const form of ["steel", "arch", "truss"] as const) {
    const mesh = createSteelRailBridgesV369([{ ...straight, form, trussHeight: 5 }])!;
    expect(mesh.boundingBox!.max.y).toBeLessThan(10);
  }
  const confirmed = createSteelRailBridgesV369([{ ...straight, form: "truss", through: true, trussHeight: 5 }])!;
  const boxes = members(confirmed);
  expect(confirmed.boundingBox!.max.y).toBeGreaterThan(14.7);
  // No upper portal across an unmeasured railway loading gauge.
  expect(boxes.filter(b => b.max.y > 13).every(b => b.min.z > 2 || b.max.z < -2)).toBe(true);
  const arch = createSteelRailBridgesV369([{ ...straight, form: "arch", through: true, trussHeight: 5 }])!;
  expect(arch.count).toBeLessThan(confirmed.count);
});

test("registered skew outline is the actual raised bed, with rails only on given tracks", () => {
  const span: SteelRailSpanV369 = {
    ...straight, deck: true, trackOffsets: [0], abutmentBaseY: [null, 3],
    edges: [[[-3, 2.5], [21, 2.5]], [[3, -2.5], [27, -2.5]]],
  };
  const mesh = createSteelRailBridgesV369([span])!;
  const slab = mesh.children[0] as Mesh;
  expect(heightAt(slab, -1.1, 2)).toBeCloseTo(9.76);
  expect(heightAt(slab, -1.1, -2)).toBe(null);
  expect(heightAt(slab, 25, -2)).toBeCloseTo(9.76);
  expect(heightAt(slab, 25, 2)).toBe(null);
  expect(heightAt(mesh, 12, .7175)).toBeCloseTo(10);
  expect(heightAt(mesh, 12, -.7175)).toBeCloseTo(10);
  const boxes = members(mesh);
  expect(boxes.filter(b => b.min.y < 7)).toHaveLength(1);
  expect(boxes.find(b => b.min.y < 7)!.min.x).toBeGreaterThan(20);
  const native = createSteelRailBridgesV369([span], true)!;
  expect(heightAt(native, -1.1, 2)).toBeGreaterThan(9);
  expect(heightAt(native, -1.1, -2)).toBe(null);
  // A mapped bridge does not establish a track count or a track at its centre.
  expect(heightAt(createSteelRailBridgesV369([{ ...span, trackOffsets: [] }])!, 12, 0)).toBeCloseTo(9.76);
});

test("new full-width Native deck uses cardinal scanlines, including wide diagonal spans", () => {
  const span: SteelRailSpanV369 = { ...straight, course: [[0, 10, 0], [100, 10, 50]], width: 18, deck: true };
  const mesh = createSteelRailBridgesV369([span], true)!;
  expect(mesh.count).toBeLessThan(1500);
  expect(heightAt(mesh, 50, 25)).toBeCloseTo(9.76);
  expect(heightAt(mesh, 50, 42)).toBe(null);
});

test("invalid and zero horizontal courses fail closed; coincident source vertices do not create geometry", () => {
  expect(createSteelRailBridgesV369([])).toBe(null);
  expect(createSteelRailBridgesV369([{ ...straight, course: [[1, 1, 1], [1, 2, 1]] }])).toBe(null);
  expect(createSteelRailBridgesV369([{ ...straight, course: [[0, 10, 0], [1, NaN, 2]] }])).toBe(null);
  expect(createSteelRailBridgesV369([{ ...straight, edges: [[[1, 2]], [[3, 4]]] }])).toBe(null);
  const duplicate = createSteelRailBridgesV369([{ ...straight, course: [[0, 10, 0], ...straight.course] }])!;
  expect(duplicate.count).toBe(createSteelRailBridgesV369([straight])!.count);
});

test("documented riveted work adds paired fastener rows at intermediate panel joints only", () => {
  const riveted = createSteelRailBridgesV369([{ ...straight, form: "girder", riveted: true }])!;
  const heads = riveted.children.find(child => child.name.includes("riveted")) as InstancedMesh;
  expect(heads.count).toBeGreaterThan(0);
  expect(heads.count % 12).toBe(0);
  for (let i = 0; i < heads.count; i++) {
    heads.getMatrixAt(i, matrix);
    expect(matrix.determinant()).toBeGreaterThan(0);
    expect(Math.abs(matrix.elements[14])).toBeCloseTo(2.629);
    expect(matrix.elements[12]).toBeGreaterThan(2);
    expect(matrix.elements[12]).toBeLessThan(22);
  }
  expect(createSteelRailBridgesV369([{ ...straight, form: "girder" }])!.children).toHaveLength(0);
});

test("individually surveyed pier positions and elevations support new spans only", () => {
  const pier = { a: [6, -1], b: [6, 1], width: .55, low: 2, high: 9 };
  for (const native of [false, true]) {
    const span = { ...straight, piers: [pier] };
    expect(createSteelRailBridgesV369([span], native)!.boundingBox!.min.y).toBeGreaterThan(8);
    const boxes = members(createSteelRailBridgesV369([{ ...span, deck: true }], native)!);
    const supports = boxes.filter(box => box.min.y < 3);
    expect(supports).toHaveLength(1);
    expect(supports[0].min.x).toBeCloseTo(5.725);
    expect(supports[0].max.z).toBeCloseTo(1);
    expect(supports[0].min.y).toBe(2);
  }
});

test("a surveyed crossing of unknown construction emits its two railheads and deck only", () => {
  const span: SteelRailSpanV369 = {
    form: "unclassified", width: 5, course: [[0, 10, 0], [12, 10, 0]],
    deck: true, trackOffsets: [0], deckThickness: .7, riveted: true,
  };
  const mesh = createSteelRailBridgesV369([span])!;
  expect(mesh.count).toBe(2);
  expect(mesh.children.map(child => child.name)).toEqual(["Mapped railway bridge decks v369"]);
  expect(createSteelRailBridgesV369([{...span, trackOffsets: []}])).toBeNull();
  expect(createSteelRailBridgesV369([{...span, deck: false}])).toBeNull();
  const native = createSteelRailBridgesV369([span], true)!;
  expect(native.count).toBeGreaterThan(2);
  expect(native.children).toHaveLength(0);
});
