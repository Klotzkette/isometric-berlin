import { expect, test } from "bun:test";
import { CatmullRomCurve3, LineSegments, Vector3 } from "three";
import { createPathGeometry, smoothParkPathPoints, type ParkPath } from "../src/ParkDetails";
import { createKerbLinesSteps } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import paths from "../public/mesh/regierungsviertel/park-details.json";
import innerCityPavement from "../src/data/innerCityPavementEdgesV368.json";
import pavement from "../src/data/mittePavementEdgesV367.json";

const byId = new Map((paths.paths as ParkPath[]).map(p => [p.id, p]));

function chordOffset(v: Vector3, a: Vector3, b: Vector3): number {
  const d = b.clone().sub(a);
  const u = Math.max(0, Math.min(1, ((v.x - a.x) * d.x + (v.z - a.z) * d.z) / (d.x ** 2 + d.z ** 2)));
  return Math.hypot(v.x - a.x - u * d.x, v.z - a.z - u * d.z);
}

for (const [id, oldMinimum] of [["121145552:0", 21], ["365734801:0", 8], ["1127998710:0", 3]] as const) {
  test(`mapped hardscape ${id} keeps its exact straight approaches, corners and centreline`, () => {
    const path = byId.get(id)!;
    const source = path.points.map(p => new Vector3(...p));
    const legacy = new CatmullRomCurve3(source, false, "centripetal");
    const actual = smoothParkPathPoints(path);
    let oldOffset = 0, j = 1;
    expect(actual[0]).toEqual(source[0]);
    for (let i = 0; i < source.length - 1; i++) {
      const a = source[i], b = source[i + 1];
      const n = Math.min(6, Math.max(1, Math.ceil(a.distanceTo(b) / 1.75)));
      for (let k = 1; k <= n; k++, j++) {
        const before = legacy.getPoint((i + k / n) / (source.length - 1));
        oldOffset = Math.max(oldOffset, chordOffset(before, a, b));
        expect(chordOffset(actual[j], a, b)).toBeLessThan(1e-8);
      }
      expect(actual[j - 1]).toEqual(b);
    }
    expect(j).toBe(actual.length);
    expect(oldOffset).toBeGreaterThan(oldMinimum);
  });
}

test("the path around the two Moabit pitches has matching bevels on both sides of the closing seam", () => {
  const geometry = createPathGeometry([byId.get("121145552:0")!], 2.4);
  const p = geometry.getAttribute("position");
  for (const side of [0, 1]) {
    expect(new Vector3().fromBufferAttribute(p, side)).toEqual(
      new Vector3().fromBufferAttribute(p, p.count - 2 + side));
  }
  geometry.dispose();
});

test("gradual paved bends stay within a decimetre and natural paths retain their free curve", () => {
  const path: ParkPath = { id: "fixture", kind: "footway", m: "p", points: [[0, 5, 0], [30, 5, 0], [45, 5, 7]] };
  const paved = smoothParkPathPoints(path), gravel = smoothParkPathPoints({ ...path, m: "g" });
  expect(Math.max(...paved.slice(0, 7).map(p => Math.abs(p.z)))).toBeCloseTo(.1, 6);
  expect(Math.max(...gravel.slice(0, 7).map(p => Math.abs(p.z)))).toBeGreaterThan(.3);
  for (const p of path.points) expect(paved.some(v => v.equals(new Vector3(...p)))).toBeTrue();
});

test("mapped arc through four pavement nodes keeps its original curved course", () => {
  const angles = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2];
  const points: [number, number, number][] = angles.map(a => [40 * Math.cos(a), 5, 40 * Math.sin(a)]);
  const path: ParkPath = { id: "traced arc", kind: "footway", m: "p", points };
  expect(smoothParkPathPoints(path)).toEqual(smoothParkPathPoints({ ...path, m: "g" }));
});

function kerbKeys(mask?: ReadonlySet<number>): Set<number> {
  const data = ground as unknown as VoxelPayload;
  const steps = createKerbLinesSteps(data, new Set(["asphalt", "water", "basin"]), undefined, mask);
  let result = steps.next();
  while (!result.done) result = steps.next();
  const mesh = result.value as LineSegments;
  const positions = mesh.geometry.getAttribute("position");
  const keys = new Set<number>();
  for (let i = 0; i < positions.count; i += 2) {
    const vertical = positions.getX(i) === positions.getX(i + 1);
    const col = positions.getX(i) / data.cell_m - data.grid.min_x_idx - Number(vertical);
    const row = positions.getZ(i) / data.cell_m - data.grid.min_z_idx - Number(!vertical);
    keys.add(2 * (row * data.grid.cols + col) + Number(!vertical));
  }
  mesh.geometry.dispose();
  return keys;
}

test("only grid ink completely inside vector paving is removed from the real core", () => {
  const original = kerbKeys(), corrected = kerbKeys(new Set(pavement.edges));
  expect([...original].filter(k => !corrected.has(k)).sort((a, b) => a - b)).toEqual(pavement.edges);
  expect([...corrected].every(k => original.has(k))).toBeTrue();
  expect(pavement.edges.length).toBe(194);
});


test("the core extension removes only the 33 additional verified grid edges", () => {
  const previous = kerbKeys(new Set(pavement.edges));
  const updated = kerbKeys(new Set([...pavement.edges, ...innerCityPavement.edges]));
  const removed = [...previous].filter(edge => !updated.has(edge)).sort((a, b) => a - b);
  expect(removed).toEqual(innerCityPavement.edges);
  expect(removed).toHaveLength(33);
  expect(updated.size).toBe(previous.size - removed.length);
});
