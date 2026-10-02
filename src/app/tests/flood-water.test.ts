import { afterAll, describe, expect, test } from "bun:test";
import { DoubleSide, Mesh, Raycaster, Vector3 } from "three";

import {
  createFloodWater, FLOOD_FRAME_INTERVAL_MS, FLOOD_WATER_LEVEL_M,
  FLOOD_WATER_MAX_SWELL_M, updateFloodWater,
} from "../src/FloodWater";
import sourceScope from "../src/data/surroundingCityScope.json";

type Ring = readonly (readonly number[])[];
type Polygon = { ring: Ring; holes: readonly Ring[] };

const sourceSnapshot = JSON.stringify(sourceScope);
const water = createFloodWater();
const geometry = water.geometry;
const positions = geometry.getAttribute("position");
const indices = geometry.index!.array;
const sourcePolygons: Polygon[] = [sourceScope.core, ...sourceScope.footprint];

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

function ringContains(ring: Ring, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) &&
        x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonContains(polygon: Polygon, x: number, z: number): boolean {
  return ringContains(polygon.ring, x, z) &&
    !polygon.holes.some(hole => ringContains(hole, x, z));
}

function boundaryDistanceSquared(ring: Ring, x: number, z: number): number {
  let closest = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared));
    closest = Math.min(closest, (x - a[0] - t * dx) ** 2 +
      (z - a[1] - t * dz) ** 2);
  }
  return closest;
}

afterAll(() => {
  geometry.dispose();
  water.material.dispose();
});

describe("bounded, additive flooded Berlin water", () => {
  test("covers exactly the approved polygon union, including the core hole filled once", () => {
    const expectedArea = sourcePolygons.reduce((sum, polygon) =>
      sum + ringArea(polygon.ring) - polygon.holes.reduce((n, hole) => n + ringArea(hole), 0), 0);
    let actualArea = 0, invalidCentroids = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];
      const ax = positions.getX(a), az = positions.getZ(a);
      const bx = positions.getX(b), bz = positions.getZ(b);
      const cx = positions.getX(c), cz = positions.getZ(c);
      actualArea += Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
      const x = (ax + bx + cx) / 3, z = (az + bz + cz) / 3;
      if (!sourcePolygons.some(polygon => polygonContains(polygon, x, z))) {
        // Float32 coordinates can move tiny sliver centroids fractions of a
        // millimetre across the exact source boundary; no broad buffer passes.
        const boundaryDistance = Math.min(...sourcePolygons.flatMap(polygon =>
          [polygon.ring, ...polygon.holes].map(ring => boundaryDistanceSquared(ring, x, z))));
        if (boundaryDistance > 0.001 ** 2) invalidCentroids++;
      }
    }
    expect(Math.abs(actualArea - expectedArea)).toBeLessThan(2);
    expect(invalidCentroids).toBe(0);

    // The surrounding scope deliberately excludes the old city as a hole.
    // Its independent fill must be present once, without doubling the centre.
    expect(sourceScope.footprint.some(p => p.holes.some(hole => ringContains(hole, 0, 0)))).toBeTrue();
    expect(sourcePolygons.filter(p => polygonContains(p, 0, 0))).toHaveLength(1);
    expect(sourcePolygons.some(p => polygonContains(p, -6100, -4300))).toBeFalse();
  });

  test("retains all geographic tails and contains the full moving surface in its bounds", () => {
    const sourcePoints = sourcePolygons.flatMap(p => [p.ring, ...p.holes].flat());
    const xs = sourcePoints.map(p => p[0]), zs = sourcePoints.map(p => p[1]);
    const bounds = geometry.boundingBox!, sphere = geometry.boundingSphere!;
    expect(bounds.min.x).toBeCloseTo(Math.min(...xs), 2);
    expect(bounds.max.x).toBeCloseTo(Math.max(...xs), 2);
    expect(bounds.min.z).toBeCloseTo(Math.min(...zs), 2);
    expect(bounds.max.z).toBeCloseTo(Math.max(...zs), 2);
    expect(FLOOD_WATER_LEVEL_M).toBeCloseTo(4.2 + 3, 6);
    const point = new Vector3();
    let invalidVertices = 0;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      if (![x, y, z].every(Number.isFinite) || Math.abs(y - FLOOD_WATER_LEVEL_M) > 1e-6) invalidVertices++;
      for (const dy of [-FLOOD_WATER_MAX_SWELL_M, FLOOD_WATER_MAX_SWELL_M]) {
        point.set(x, y + dy, z);
        if (!bounds.containsPoint(point) || !sphere.containsPoint(point)) invalidVertices++;
      }
    }
    expect(invalidVertices).toBe(0);
  });

  test("keeps one texture-free draw call and less than one MiB of geometry", () => {
    expect(water.children).toHaveLength(0);
    expect(Array.isArray(water.material)).toBeFalse();
    expect(positions.count).toBeLessThan(45_000);
    expect(indices.length / 3).toBeLessThan(90_000);
    const bytes = Object.values(geometry.attributes).reduce((n, a) => n + a.array.byteLength,
      geometry.index!.array.byteLength);
    expect(bytes).toBeLessThan(1024 * 1024);
    expect(water.material.transparent).toBeFalse();
    expect(water.material.depthTest).toBeTrue();
    expect(water.material.depthWrite).toBeTrue();
    expect(water.material.side).toBe(DoubleSide);
    expect(water.material.toneMapped).toBeFalse();
    expect(water.castShadow).toBeFalse();
    expect(Object.values(water.material.uniforms).every(uniform =>
      typeof uniform.value === "number")).toBeTrue();
    expect(FLOOD_FRAME_INTERVAL_MS).toBeGreaterThanOrEqual(1000 / 30);
  });

  test("advances only its bounded time uniform while source, buffers and material remain unchanged", () => {
    const material = water.material, uniform = material.uniforms.time;
    const positionBuffer = positions.array, indexBuffer = geometry.index!.array;
    const positionSnapshot = positionBuffer.slice(), indexSnapshot = indexBuffer.slice();
    for (let frame = 0; frame < 1000; frame++) updateFloodWater(water, frame / 24);
    expect(uniform.value).toBe(999 / 24);
    expect(water.geometry).toBe(geometry);
    expect(water.material).toBe(material);
    expect(material.uniforms.time).toBe(uniform);
    expect(positions.array).toBe(positionBuffer);
    expect(geometry.index!.array).toBe(indexBuffer);
    expect(positionBuffer).toEqual(positionSnapshot);
    expect(indexBuffer).toEqual(indexSnapshot);
    expect(JSON.stringify(sourceScope)).toBe(sourceSnapshot);

    updateFloodWater(water, NaN);
    updateFloodWater(water, Infinity);
    expect(uniform.value).toBe(999 / 24);
    updateFloodWater(water, -5);
    expect(uniform.value).toBe(0);
  });

  test("never intercepts click-to-walk or adds a physical walking floor", () => {
    const ray = new Raycaster(new Vector3(12.345, 100, -22.543), new Vector3(0, -1, 0));
    water.updateMatrixWorld(true);
    const ordinaryIntersections: ReturnType<Raycaster["intersectObject"]> = [];
    Mesh.prototype.raycast.call(water, ray, ordinaryIntersections);
    expect(ordinaryIntersections.length).toBeGreaterThan(0);
    expect(ray.intersectObject(water, true)).toHaveLength(0);
    expect(water.userData.fictionalPresentation).toContain("not a hazard map");
  });

  test("owns only ordinary disposable geometry and material resources", () => {
    const isolated = createFloodWater();
    let geometryDisposed = 0, materialDisposed = 0;
    isolated.geometry.addEventListener("dispose", () => geometryDisposed++);
    isolated.material.addEventListener("dispose", () => materialDisposed++);
    isolated.geometry.dispose(); isolated.material.dispose();
    expect(geometryDisposed).toBe(1);
    expect(materialDisposed).toBe(1);
    expect(isolated.children).toHaveLength(0);
    expect(isolated.geometry).not.toBe(geometry);
    expect(isolated.material).not.toBe(water.material);
  });
});
