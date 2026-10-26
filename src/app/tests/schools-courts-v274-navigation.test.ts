import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { compilePedestrianObstacles, pedestrianPointIsBlocked, type PedestrianPolygonObstacle } from "../src/pedestrianNavigation";
import { SCHOOLS_COURTS_V274_BASE_PRISM_ID, SCHOOLS_COURTS_V274_UPPER_PARTS, SCHOOLS_COURTS_V274_NATIVE_UPPER_PART, schoolsCourtsV274RoofAt } from "../src/schoolsCourtsV274Navigation";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VisualMode } from "../src/visualMode";
import nav from "../src/data/schoolsCourtsV274Navigation.json";

const source = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8")) as PrismPayload;
const base = source.buildings.find(b => b.id === SCHOOLS_COURTS_V274_BASE_PRISM_ID)!;
const upperIds = new Set(SCHOOLS_COURTS_V274_UPPER_PARTS.map(p => p.id));
function polygons(index: ReturnType<typeof compilePedestrianObstacles>): PedestrianPolygonObstacle[] {
  return [...new Set([...index.cells.values()].flat())].filter(o => o.kind === "polygon") as PedestrianPolygonObstacle[];
}

describe("BMS upper roofs in the actual pedestrian compiler", () => {
  test("five measured additions retain the old ground floor and open court", () => {
    const index = compilePedestrianObstacles({ buildings: [base] });
    const all = polygons(index), upper = all.filter(p => upperIds.has(p.sourceId!));
    expect(upper.length).toBe(5);
    expect(all.filter(p => p.sourceId === base.id).length).toBe(1);
    expect(pedestrianPointIsBlocked(1270, -930, 10, index)).toBe(true);
    expect(pedestrianPointIsBlocked(1290, -900, 10, index)).toBe(false);
    expect(pedestrianPointIsBlocked(1290, -900, 25, index)).toBe(false);
    expect(pedestrianPointIsBlocked(1330, -890, 10, index)).toBe(false);
    for (const part of SCHOOLS_COURTS_V274_UPPER_PARTS) {
      const obstacle = upper.find(p => p.sourceId === part.id)!;
      expect(obstacle.ring).toEqual(part.polygons[0].ring);
      expect(obstacle.holes).toEqual(part.polygons[0].holes);
      expect(obstacle.minY).toBe(23.2);
    }
  });
  test("the live mode getter follows independent native roofs without rebuilding", () => {
    let mode: VisualMode = "day";
    const index = compilePedestrianObstacles({ buildings: [base] }, () => mode);
    const upper = polygons(index).filter(p => upperIds.has(p.sourceId!));
    const nativeUpper = polygons(index).filter(p => p.sourceId === SCHOOLS_COURTS_V274_NATIVE_UPPER_PART.id);
    expect(nativeUpper.length).toBeGreaterThan(0);
    for (const native of [false, true, false]) {
      mode = native ? "minecraft" : "day";
      for (const triangle of nav.roofTriangles) {
        const x = triangle.reduce((sum, p) => sum + p[0], 0) / 3;
        const z = triangle.reduce((sum, p) => sum + p[2], 0) / 3;
        for (const obstacle of upper) {
          expect(obstacle.topAt!(x, z)).toBe(native ? Number.NEGATIVE_INFINITY : schoolsCourtsV274RoofAt(x,z));
        }
        for (const obstacle of nativeUpper) expect(obstacle.topAt!(x,z)).toBe(native ? schoolsCourtsV274RoofAt(x,z,true) : Number.NEGATIVE_INFINITY);
      }
      const y = schoolsCourtsV274RoofAt(1270, -930, native)!;
      expect(y).toBeGreaterThan(23.2);
      expect(pedestrianPointIsBlocked(1270, -930, 24, index)).toBe(true);
      expect(pedestrianPointIsBlocked(1270, -930, y + 0.05, index)).toBe(false);
    }
    mode = "minecraft";
    for (const [x,z,y] of nav.nativeRoofCells) {
      expect(pedestrianPointIsBlocked(x,z,y-0.3,index)).toBe(true);
      expect(pedestrianPointIsBlocked(x,z,y+0.05,index)).toBe(false);
    }
    expect(pedestrianPointIsBlocked(1290,-900,25,index)).toBe(false);
  });
  test("unrelated synthetic worlds do not acquire the school upper volumes", () => {
    const index = compilePedestrianObstacles({ buildings: [] });
    expect(polygons(index).some(p => upperIds.has(p.sourceId!))).toBe(false);
    expect(polygons(index).some(p => p.sourceId === SCHOOLS_COURTS_V274_NATIVE_UPPER_PART.id)).toBe(false);
  });
});
