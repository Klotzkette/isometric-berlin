import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import source from "../src/bikiniSource.json";

type Point = number[];
type Ring = Point[];
type Prism = { id: string; ring: Ring; holes: Ring[]; y0_dm: number; h_dm: number };
const parts = source.parts;
const byId = new Map(parts.map(part => [part.id, part]));
const area = (ring: Ring): number => Math.abs(ring.reduce((sum, p, i) => {
  const next = ring[(i + 1) % ring.length];
  return sum + p[0] * next[1] - next[0] * p[1];
}, 0)) / 2;

function inside(point: Point, ring: Ring): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const cross = (point[0] - a[0]) * dz - (point[1] - a[1]) * dx;
    if (Math.abs(cross) < 1e-6 && Math.min(a[0], b[0]) - 1e-6 <= point[0] &&
        point[0] <= Math.max(a[0], b[0]) + 1e-6 && Math.min(a[1], b[1]) - 1e-6 <= point[1] &&
        point[1] <= Math.max(a[1], b[1]) + 1e-6) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < dx * (point[1] - a[1]) / dz + a[0]) result = !result;
  }
  return result;
}

// Clip to an axis-aligned raster cell; signed pieces remain additive even for
// concave rings, so holes can be subtracted without changing source ownership.
function clipCell(ring: Ring, x: number, z: number, size: number): Ring {
  let output = ring.slice(0, -1);
  for (const [axis, boundary, sign] of [[0, x, 1], [0, x + size, -1], [1, z, 1], [1, z + size, -1]]) {
    const input = output; output = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i], b = input[(i + 1) % input.length];
      const ai = (a[axis] - boundary) * sign >= 0, bi = (b[axis] - boundary) * sign >= 0;
      if (ai) output.push(a);
      if (ai !== bi) {
        const t = (boundary - a[axis]) / (b[axis] - a[axis]);
        output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  return output;
}
const close = (ring: Ring): Ring => [...ring, ring[0]];

function cellArea(prism: Prism, x: number, z: number): number {
  const exterior = close(prism.ring.map(([a, b]) => [a / 10, b / 10]));
  const holes = prism.holes.map(hole => close(hole.map(([a, b]) => [a / 10, b / 10])));
  return area(clipCell(exterior, x, z, 4)) - holes.reduce((sum, hole) => sum + area(clipCell(hole, x, z, 4)), 0);
}

describe("Bikini Berlin source geometry", () => {
  test("keeps all mapped parts, source tags and the three separate upper levels", () => {
    expect(parts).toHaveLength(103);
    expect(new Set(parts.map(part => part.id)).size).toBe(103);
    expect(parts.filter(part => part.id.startsWith("relation-"))).toHaveLength(2);
    expect(source.replacementPrismIds).toEqual(["64457341", "-5419303"]);
    expect(source.groundY).toBe(5.2);
    for (const [id, bottom, top] of [["364457330", 7, 10], ["364457336", 10, 19], ["364457331", 19, 23]] as const) {
      expect(byId.get(id)?.bottom).toBe(bottom);
      expect(byId.get(id)?.top).toBe(top);
    }
    for (const part of parts) {
      expect(part.ring[0]).toEqual(part.ring.at(-1));
      expect(part.top).toBe(Number(part.tags.height));
      expect(part.top).toBeGreaterThan(part.bottom);
      expect(part.top).toBeLessThanOrEqual(23);
      for (const [x, z] of part.ring) {
        expect(x).toBeGreaterThan(-2560); expect(x).toBeLessThan(-2310);
        expect(z).toBeGreaterThan(1350); expect(z).toBeLessThan(1470);
      }
    }
  });

  test("covers the source mall footprint without flattening terrace levels", () => {
    let checked = 0;
    for (let z = 1357.37; z < 1464; z += 1.7) for (let x = -2554.23; x < -2317; x += 1.7) {
      const point = [x, z];
      if (!inside(point, source.parentRing)) continue;
      checked++;
      expect(parts.some(part => inside(point, part.ring) && !part.holes.some(hole => inside(point, hole)))).toBe(true);
    }
    expect(checked).toBeGreaterThan(3500);
    expect(byId.get("364457308")?.top).toBe(7);
    expect(source.provenance.parentNotCoveredByPartFootprintsM2).toBeLessThan(.16);
  });

  test("preserves both planted-roof glass cutouts and the western inner ring", () => {
    const roof = byId.get("relation-5424774")!;
    const structuralMember = byId.get("364868139")!;
    expect(roof.holes).toHaveLength(2);
    expect(roof.holes).toEqual([byId.get("364868137")!.ring, byId.get("364868136")!.ring]);
    expect(structuralMember.renderRoofHoles).toEqual(roof.holes);
    expect(byId.get("relation-5419303")!.holes).toEqual([byId.get("364457334")!.ring]);
    expect(roof.holes.reduce((sum, hole) => sum + area(hole), 0)).toBeGreaterThan(250);
  });

  test("slices every mapped stair without adding area or reversing its tagged slope", () => {
    const stairs = parts.filter(part => part.kind === "steps");
    expect(stairs).toHaveLength(4);
    for (const stair of stairs) {
      const bearing = Number(stair.tags["roof:direction"]);
      const axis = [Math.sin(bearing * Math.PI / 180), -Math.cos(bearing * Math.PI / 180)];
      let previous = -Infinity;
      expect(stair.steps.reduce((sum, step) => sum + area(step.ring), 0)).toBeCloseTo(area(stair.ring), 4);
      for (const step of stair.steps) {
        expect(step.ring[0]).toEqual(step.ring.at(-1));
        expect(step.bottom).toBe(stair.bottom);
        expect(step.top).toBeGreaterThan(stair.bottom);
        expect(step.top).toBeLessThanOrEqual(stair.top);
        const centroid = step.ring.slice(0, -1).reduce((sum, p) => sum + p[0] * axis[0] + p[1] * axis[1], 0) / (step.ring.length - 1);
        expect(centroid).toBeGreaterThan(previous); previous = centroid;
        const centre = step.ring.slice(0, -1).reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1]], [0, 0]).map(v => v / (step.ring.length - 1));
        expect(inside(centre, stair.ring)).toBe(true);
      }
      expect(stair.steps[0].top).toBe(stair.top);
      expect(stair.steps.at(-1)!.top - stair.bottom).toBeLessThanOrEqual(.180001);
      expect(stair.steps.every((step, i) => i === 0 || step.top < stair.steps[i - 1].top)).toBe(true);
    }
  });

  test("native replacement never takes a neighbouring source contribution", () => {
    const all = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8")).buildings as Prism[];
    const ownedIds = new Set(source.replacementPrismIds);
    const minX = Math.min(...source.parentRing.map(point => point[0])) - 4;
    const maxX = Math.max(...source.parentRing.map(point => point[0])) + 4;
    const minZ = Math.min(...source.parentRing.map(point => point[1])) - 4;
    const maxZ = Math.max(...source.parentRing.map(point => point[1])) + 4;
    const neighbours = all.filter(prism => !ownedIds.has(prism.id) &&
      Math.min(...prism.ring.map(point => point[0] / 10)) <= maxX &&
      Math.max(...prism.ring.map(point => point[0] / 10)) >= minX &&
      Math.min(...prism.ring.map(point => point[1] / 10)) <= maxZ &&
      Math.max(...prism.ring.map(point => point[1] / 10)) >= minZ);
    expect(neighbours).toHaveLength(5);
    expect(neighbours.every(prism => !ownedIds.has(prism.id))).toBe(true);
    expect(source.native.cellSizeM).toBe(4);
    expect(source.native.safeWholeCells).toHaveLength(590);
    expect(source.native.exclusiveOccupiedCells).toHaveLength(660);
    expect(source.native.mixedOccupiedCells).toHaveLength(29);
    const exclusive = new Set(source.native.exclusiveOccupiedCells.map(cell => cell.join(",")));
    expect(exclusive.size).toBe(660);
    for (const [x, z] of source.native.exclusiveOccupiedCells) {
      expect(Math.abs(x % 4)).toBe(0); expect(Math.abs(z % 4)).toBe(0);
      const overlap = neighbours.reduce((sum, prism) => sum + Math.max(0, cellArea(prism, x, z)), 0);
      expect(overlap).toBeLessThan(1e-7);
    }
    for (const [x, z] of source.native.mixedOccupiedCells) {
      expect(exclusive.has([x, z].join(","))).toBe(false);
      expect(neighbours.some(prism => cellArea(prism, x, z) > 1e-7)).toBe(true);
    }
  });
});
