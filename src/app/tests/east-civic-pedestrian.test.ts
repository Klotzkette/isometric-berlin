import { describe, expect, test } from "bun:test";
import type { PrismPayload } from "../src/IsometricCityWorld";
import {
  compilePedestrianObstacles, createPedestrianState, pedestrianPointIsBlocked,
  PEDESTRIAN_IDLE_INPUT, stepPedestrian, type PedestrianEnvironment,
  type PedestrianPolygonObstacle,
} from "../src/pedestrianNavigation";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";
import {
  EAST_CIVIC_SOURCES, EAST_CIVIC_PRISM_IDS, EAST_CIVIC_LOGGIA_POSTS,
  eastCivicPartRoofAt, eastCivicPartBaseAt,
} from "../src/eastCivicProfile";
import { DHM_PARTS, DHM_PRISM_IDS, DHM_COURTYARD_ROOF_ID, dhmPartBaseAt, dhmPartRoofAt } from "../src/dhmProfile";
import {
  RUSSIAN_EMBASSY_SOURCE_IDS, RUSSIAN_EMBASSY_SOURCE_PARTS,
  RUSSIAN_EMBASSY_SOURCE_DY, russianEmbassyRoofAt,
} from "../src/RussianEmbassySourceGeometry";
import { SCHLOSS_EAST_PARTS, FERNSEHTURM_PROFILE as TV } from "../src/schlossEastProfile";

const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const replaced = new Set([...EAST_CIVIC_PRISM_IDS, ...DHM_PRISM_IDS, ...RUSSIAN_EMBASSY_SOURCE_IDS]);
const buildings = payload.buildings.filter(p => replaced.has(p.id));
const obstacles = compilePedestrianObstacles({ buildings });
const all = [...new Set([...obstacles.cells.values()].flat())];
const polygons = all.filter((p): p is PedestrianPolygonObstacle => p.kind === "polygon");
const indexed = new Map(polygons.map(p => [p.sourceId, p]));
const modes = ["day", "night", "snowstorm", "minecraft", "schwellenraum"] as const;
const access = (mode: typeof modes[number]) => ({
  walkableInteriorAt: (x: number, y: number, z: number, id?: string) => visualModeWalkableInteriorAt(mode, x, y, z, id),
});
const environment: PedestrianEnvironment = {
  bounds: { minX: -3000, maxX: 4000, minZ: -3000, maxZ: 3000 },
  groundAt: () => 5.2, obstacles, water: [], ...access("day"),
};

function roofLanding(x: number, z: number, expected: number): void {
  const state = createPedestrianState(environment, { x, z, yaw: 0, groundYHint: 80, preserveHorizontalPosition: true });
  expect(state.x).toBe(x); expect(state.z).toBe(z);
  expect(state.groundY).toBeCloseTo(expected, 6);
  expect(stepPedestrian(state, PEDESTRIAN_IDLE_INPUT, .04, environment).state.groundY).toBeCloseTo(expected, 6);
}

describe("v148 civic source pedestrian integration", () => {
  test("all replaced prisms yield each source part exactly once and no generic double shell", () => {
    expect(buildings).toHaveLength(replaced.size);
    const expected = [
      ...EAST_CIVIC_SOURCES.flatMap(p => p.parts).filter(p => p.top_y_m > eastCivicPartBaseAt(p)), ...DHM_PARTS,
      ...RUSSIAN_EMBASSY_SOURCE_PARTS,
      ...SCHLOSS_EAST_PARTS.filter(p => !TV.sourcePartIds.includes(p.id)),
    ];
    expect(polygons.filter(p => p.topAt).map(p => p.sourceId).sort()).toEqual(expected.map(p => p.id).sort());
    for (const id of replaced) expect(indexed.has(id)).toBeFalse();
    expect(indexed.has("aa-loggia-post-0")).toBeTrue();
    expect(indexed.has("aa-loggia-post-1")).toBeTrue();
    const duplicateIndex = compilePedestrianObstacles({ buildings: [...buildings, ...buildings] });
    expect(duplicateIndex.buildingCount).toBe(obstacles.buildingCount);
    expect(duplicateIndex.obstacleCount).toBe(obstacles.obstacleCount);
  });

  test("exact original source rings and holes survive, with the precise lower glass atrium opening", () => {
    const atrium = EAST_CIVIC_SOURCES[1].parts.find(p => p.id === "DEBE3DJrlFgy3FFk")!;
    const buriedParts = EAST_CIVIC_SOURCES.flatMap(s => s.parts).filter(p => p.top_y_m <= eastCivicPartBaseAt(p));
    // One retained source slab is completely below the displayed ground plane.
    // It must not create an inverted solid extending upward through the street.
    expect(buriedParts.map(p => p.id)).toEqual(["DEBE3DtJY9o2HgPQ"]);
    for (const p of buriedParts) expect(indexed.has(p.id)).toBeFalse();
    for (const p of EAST_CIVIC_SOURCES.flatMap(s => s.parts).filter(p => !buriedParts.includes(p))) {
      const indexedPart = indexed.get(p.id)!;
      expect(indexedPart.ring).toBe(p.ring);
      expect(indexedPart.holes).toEqual(p.id === "DEBE3DYaStnJ2Nlk" ? [...p.holes, atrium.ring] : p.holes);
      expect(indexedPart.coordinateScale).toBe(1);
      expect(indexedPart.topAt).toBeDefined();
    }
    for (const p of DHM_PARTS) {
      const obstacle = indexed.get(p.id)!;
      expect(obstacle.ring).toBe(p.ring); expect(obstacle.holes).toBe(p.holes);
      expect(obstacle.minY).toBe(dhmPartBaseAt(p));
    }
    for (const p of RUSSIAN_EMBASSY_SOURCE_PARTS) {
      const obstacle = indexed.get(p.id)!;
      expect(obstacle.ring).toBe(p.ring); expect(obstacle.holes).toBe(p.holes);
      expect(obstacle.minY).toBe(p.ground_y_m + RUSSIAN_EMBASSY_SOURCE_DY);
      expect(obstacle.maxY).toBe(p.top_y_m + RUSSIAN_EMBASSY_SOURCE_DY);
    }
    const top = eastCivicPartRoofAt(atrium, 1884, 436)!;
    expect(top).toBeCloseTo(26.4013117, 6);
    roofLanding(1884, 436, top);
    expect(pedestrianPointIsBlocked(1884, 436, top - .4, obstacles, access("day"))).toBeTrue();
    expect(pedestrianPointIsBlocked(1884, 436, top, obstacles, access("day"))).toBeFalse();
  });

  test("AA canopies open only their own void, retaining actual posts and piers in all five modes", () => {
    const supportIds = ["DEBE3Dt4PQ2vT1Gl", "DEBE3Dx6p1sBCCuS", "DEBE3DEYiJJ81DLw", "DEBE3DvnEofU41Q3",
      "DEBE3DdkrvO7IBeP", "DEBE3Dc0YACfzgq3", "DEBE3DLAROhZs9SX", "DEBE3Dms2ucTjR98"];
    for (const mode of modes) {
      for (const [x, z] of [[1914, 436], [1918, 434], [1877.07, 488.4]]) {
        expect(pedestrianPointIsBlocked(x, z, 7, obstacles, access(mode))).toBeFalse();
        expect(visualModeWalkableInteriorAt(mode, x, 7, z, "unrelated-building")).toBeFalse();
      }
      for (const [x, z] of EAST_CIVIC_LOGGIA_POSTS) expect(pedestrianPointIsBlocked(x, z, 7, obstacles, access(mode))).toBeTrue();
      for (const id of supportIds) {
        const part = EAST_CIVIC_SOURCES[1].parts.find(p => p.id === id)!;
        const x = part.ring.reduce((s, p) => s + p[0], 0) / part.ring.length;
        const z = part.ring.reduce((s, p) => s + p[1], 0) / part.ring.length;
        expect(pedestrianPointIsBlocked(x, z, 7, obstacles, access(mode))).toBeTrue();
      }
    }
  });

  test("an unrelated overlapping source remains solid inside an authored canopy void", () => {
    const overlapping = compilePedestrianObstacles({ buildings: [{ ...buildings[0],
      id: "unrelated-building", y0_dm: 52, h_dm: 200,
      ring: [[19120, 4340], [19160, 4340], [19160, 4380], [19120, 4380]], holes: [],
    }] });
    for (const mode of modes) {
      expect(pedestrianPointIsBlocked(1914, 436, 7, overlapping, access(mode))).toBeTrue();
    }
  });

  test("DHM courtyard stays open below its real canopy while the Pei glass boundaries remain solid", () => {
    const canopy = DHM_PARTS.find(p => p.id === DHM_COURTYARD_ROOF_ID)!;
    const top = dhmPartRoofAt(canopy, 1730, 127)!;
    roofLanding(1730, 127, top);
    for (const mode of modes) {
      expect(pedestrianPointIsBlocked(1730, 127, 7, obstacles, access(mode))).toBeFalse();
      expect(pedestrianPointIsBlocked(1730, 127, 24, obstacles, access(mode))).toBeTrue();
      expect(pedestrianPointIsBlocked(1686.27, 69.05, 7, obstacles, access(mode))).toBeTrue();
      expect(visualModeWalkableInteriorAt(mode, 1730, 7, 127, "unrelated-building")).toBeFalse();
    }
  });

  test("Embassy courts stay open and translated local roof planes provide exact support", () => {
    for (const mode of modes) {
      for (const [x, z] of [[805, 309], [785, 365], [838, 364]]) expect(pedestrianPointIsBlocked(x, z, 7, obstacles, access(mode))).toBeFalse();
      expect(pedestrianPointIsBlocked(807.7225, 354.01675, 7, obstacles, access(mode))).toBeTrue();
    }
    roofLanding(807.7225, 354.01675, russianEmbassyRoofAt(807.7225, 354.01675)!);
  });

  test("Fernsehturm uses a narrow shaft, broad sphere and narrow antenna, with no generalized cylinder", () => {
    for (const id of TV.sourcePartIds) expect(indexed.has(id)).toBeFalse();
    const tower = all.filter(p => p.sourceId === "fernsehturm-outline");
    expect(tower).toHaveLength(1);
    for (const mode of modes) {
      expect(pedestrianPointIsBlocked(TV.x + 10, TV.z, TV.groundY + 100, obstacles, access(mode))).toBeFalse();
      expect(pedestrianPointIsBlocked(TV.x + 4, TV.z, TV.groundY + 100, obstacles, access(mode))).toBeTrue();
      expect(pedestrianPointIsBlocked(TV.x + 14, TV.z, TV.groundY + TV.sphereCenterHeight, obstacles, access(mode))).toBeTrue();
      expect(pedestrianPointIsBlocked(TV.x + 3, TV.z, TV.groundY + 300, obstacles, access(mode))).toBeFalse();
      expect(pedestrianPointIsBlocked(TV.x, TV.z, TV.groundY + 300, obstacles, access(mode))).toBeTrue();
    }
  });
});
