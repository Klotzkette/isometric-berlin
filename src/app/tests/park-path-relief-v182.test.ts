import { expect, test } from "bun:test";
import { Vector3 } from "three";
import {
  createCoreParkPathTerrainSampler, createPathGeometry, refineCoreParkPathPoints,
  smoothParkPathPoints, type ParkPath,
} from "../src/ParkDetails";
import { coreParkReliefContains } from "../src/parkReliefV182";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import park from "../public/mesh/regierungsviertel/park-details.json";
import { districtStreetTerrainSampler } from "../src/DistrictStreets";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";

test("hill refinement keeps every smoothed endpoint and exact XZ chord, and leaves outside paths alone", () => {
  const source = [new Vector3(520, 4, -3000), new Vector3(1600, 20, -3000)];
  const points = refineCoreParkPathPoints(source);
  expect(points[0]).toBe(source[0]);
  expect(points.at(-1)).toBe(source.at(-1));
  expect(points.length).toBeGreaterThan(300);
  for (let index = 1; index < points.length; index++) {
    expect(points[index].z).toBe(-3000);
    expect(points[index].x).toBeGreaterThan(points[index - 1].x);
    const middle = points[index].clone().add(points[index - 1]).multiplyScalar(.5);
    if (coreParkReliefContains(middle.x, middle.z)) {
      expect(points[index].x - points[index - 1].x).toBeLessThanOrEqual(2.000001);
    }
  }
  const outside = [new Vector3(0, 4, 0), new Vector3(4000, 4, -2000)];
  expect(refineCoreParkPathPoints(outside)).toBe(outside);
  const bent: ParkPath = { id: "curve", kind: "path", points: [[800, 10, -3000], [840, 12, -3010], [870, 18, -3030]] };
  const smooth = smoothParkPathPoints(bent), refined = refineCoreParkPathPoints(smooth);
  for (const original of smooth) expect(refined.includes(original)).toBeTrue();
  for (const point of refined) {
    expect(smooth.slice(1).some((b, index) => {
      const a = smooth[index], dx = b.x - a.x, dz = b.z - a.z;
      const t = ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz);
      return t >= -1e-10 && t <= 1 + 1e-10 && Math.abs((point.x - a.x) * dz - (point.z - a.z) * dx) < 1e-7;
    })).toBeTrue();
  }
});

test("long stair ribbons follow the hill between original anchors without a second height addition", () => {
  const hill = (x: number) => 3 + 20 * Math.max(0, 1 - Math.abs(x - 1000) / 100);
  const path: ParkPath = { id: "steps", kind: "steps", points: [[900, 3.045, -3000], [1100, 3.045, -3000]] };
  const sample = createCoreParkPathTerrainSampler(hill);
  const geometry = createPathGeometry([path], 2, sample);
  const position = geometry.getAttribute("position");
  expect(position.count).toBe(202);
  for (let index = 0; index < position.count; index++) {
    expect(position.getY(index)).toBeCloseTo(hill(position.getX(index)) + .045 + .12, 4);
  }
  expect(sample(path, 1000, 0, 6)).toBe(6);
  geometry.dispose();
});

test("shipped hill routes retain all control points and their source clearance while other districts retain exact inputs", () => {
  const terrain = districtStreetTerrainSampler(ground as VoxelPayload);
  const sample = createCoreParkPathTerrainSampler(terrain);
  let hillPaths = 0, unchanged = 0;
  for (const path of park.paths as ParkPath[]) {
    const smooth = smoothParkPathPoints(path), refined = refineCoreParkPathPoints(smooth);
    for (const point of smooth) expect(refined.includes(point)).toBeTrue();
    const hillPoints = path.points.filter(([x, , z]) => coreParkReliefContains(x, z));
    if (!hillPoints.length && refined === smooth) {
      unchanged++;
      for (const [x, y, z] of path.points) expect(sample(path, x, z, y)).toBe(y);
    } else {
      hillPaths++;
      for (const [x, y, z] of hillPoints) expect(sample(path, x, z, y)).toBeCloseTo(y, 2);
    }
  }
  expect(hillPaths).toBeGreaterThan(50);
  expect(unchanged).toBeGreaterThan(1500);
});
