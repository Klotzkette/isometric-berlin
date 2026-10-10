import { expect, test } from "bun:test";
import { Raycaster, Vector3 } from "three";
import { createVolksbuehneEnvelopeV209 } from "../src/VolksbuehneEnvelopeV209";
import { volksbuehneV209SolidAt as solidAt } from "../src/volksbuehneV209Navigation";
import data from "../src/data/volksbuehneV209Navigation.json";

function world(u: number, v: number): [number, number] {
  const { origin: [x, z], axis: [tx, tz] } = data.rearRoof;
  return [x + tx * u - tz * v, z + tz * u + tx * v];
}

function at(u: number, v: number, y: number, radius = 0): boolean {
  const [x, z] = world(u, v);
  return solidAt(x, y, z, radius);
}

test("upper collision meets rendered stage, auditorium and sloping rear roof", () => {
  const root = createVolksbuehneEnvelopeV209();
  root.updateMatrixWorld(true);
  for (const [u, v] of [[0, -48], [0, -25], [0, -63], [-5.75, -63], [10, -63]]) {
    const [x, z] = world(u, v);
    const hit = new Raycaster(new Vector3(x, 70, z), new Vector3(0, -1, 0))
      .intersectObject(root, true)[0];
    expect(hit).toBeDefined();
    expect(solidAt(x, hit.point.y - 0.01, z)).toBe(true);
    expect(solidAt(x, hit.point.y + 0.01, z)).toBe(false);
  }
  for (const child of root.children) {
    const mesh = child as import("three").Mesh;
    mesh.geometry.dispose();
  }
});

test("collision leaves the lower owner, rear courts and adjacent footprint free", () => {
  expect(at(0, -48, 23.55)).toBe(false);
  expect(at(0, -48, 42.27)).toBe(false);
  expect(at(0, -25, 28.9)).toBe(false);
  expect(at(22, -30, 30)).toBe(false);
  expect(at(15, -6, 25)).toBe(false);
  for (const [x, z] of [[2774.5, -882], [2789, -874.5]]) {
    expect(solidAt(x, 25, z, 0.25)).toBe(false);
    expect(solidAt(x, 35, z, 0.25)).toBe(false);
  }
});

test("stage radius follows exact edges and circular corner distance", () => {
  expect(at(-12.5, -48, 40, 0.31)).toBe(true);
  expect(at(-12.5, -48, 40, 0.29)).toBe(false);
  expect(at(-12.5, -56.3, 40, 0.43)).toBe(true);
  expect(at(-12.5, -56.3, 40, 0.42)).toBe(false);
});

test("rear collision narrows toward the measured ridge instead of raising the whole footprint", () => {
  const { lowY, highY } = data.rearRoof;
  const middleY = (lowY + highY) / 2;
  expect(at(5.75, -63, middleY - 0.01)).toBe(true);
  expect(at(5.75, -63, middleY + 0.01)).toBe(false);
  expect(at(10, -63, 30)).toBe(false);
  expect(at(10, -63, 24)).toBe(true);
  expect(at(0, -63, highY)).toBe(true);
  expect(at(0, -63, highY + 0.001)).toBe(false);
  expect(at(6.05, -69.3, middleY, 0.43)).toBe(true);
  expect(at(6.05, -69.3, middleY, 0.42)).toBe(false);
});

test("invalid navigation queries cannot introduce solid space", () => {
  const [x, z] = world(0, -48);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    expect(solidAt(invalid, 30, z)).toBe(false);
    expect(solidAt(x, invalid, z)).toBe(false);
    expect(solidAt(x, 30, invalid)).toBe(false);
    expect(solidAt(x, 30, z, invalid)).toBe(false);
  }
  expect(solidAt(x, 30, z, -1)).toBe(false);
});
