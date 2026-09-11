import { FIFTY_HERTZ_IDS } from "../src/fiftyHertzProfile";
import { describe, expect, test } from "bun:test";
import type { PrismPayload } from "../src/IsometricCityWorld";
import {
  ABGEORDNETENHAUS_PROFILE as profile,
  abgeordnetenhausDisplayTopAt,
  abgeordnetenhausWorldPoint,
} from "../src/abgeordnetenhausProfile";
import {
  compilePedestrianObstacles, createPedestrianState, pedestrianPointIsBlocked,
  pedestrianSpawnFromView, PEDESTRIAN_EYE_HEIGHT_M, PEDESTRIAN_IDLE_INPUT,
  PEDESTRIAN_WALK_SPEED_MPS,
  stepPedestrian, type PedestrianEnvironment, type PedestrianPolygonObstacle,
} from "../src/pedestrianNavigation";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";
import { JAKOB_KAISER_EAST_UPPER_PROFILE } from "../src/parliamentArchitectureProfile";
import { BUNDESRAT_MAIN_ID } from "../src/bundesratProfile";
import { BELLEVUE_IDS } from "../src/bellevueProfile";
import { ADMIRALSPALAST_IDS } from "../src/friedrichstrasseArchitectureProfile";
import { MUSEUM_TRIAD_SOURCES } from "../src/museumTriadProfile";
import { DOM_ALTES_SOURCE } from "../src/domAltesMuseumProfile";
import { MUSIC_MUSEUM_IDS } from "../src/museumLenneProfile";
import { DB_TOWER_PRISM_IDS } from "../src/dbTowerIds";
import { ECONOMIC_MINISTRY_SOURCE_IDS } from "../src/EconomicMinistrySourceGeometry";
import { BEBELPLATZ_BUILDING_SOURCES } from "../src/bebelplatzBuildingProfile";

const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const source = payload.buildings.find(({ id }) => id === profile.mainPrismId)!;
const annexIds = ["ASuXBpgY", "ltmlmF6Q", "HT7phwoi", "XpFKEmWh", "NIZyBCeG", "iPl7a3aT"];
const obstacles = compilePedestrianObstacles(payload);
const indexed = new Map([...new Set([...obstacles.cells.values()].flat())]
  .filter((obstacle): obstacle is PedestrianPolygonObstacle => obstacle.kind === "polygon")
  .map((obstacle) => [obstacle.sourceId, obstacle]));
const environment: PedestrianEnvironment = {
  bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 },
  groundAt: () => profile.groundY, obstacles, water: [],
};

describe("Abgeordnetenhaus source-plan pedestrian heights", () => {
  test("replaces only the faulty main height and retains exact rings, courts and all six annexes", () => {
    expect(source.h_dm).toBe(30);
    const main = indexed.get(profile.mainPrismId)!;
    expect(main.ring).toBe(source.ring);
    expect(main.holes).toBe(source.holes!);
    expect(main.holes).toHaveLength(6);
    expect(main.coordinateScale).toBe(0.1);
    expect(main.minY).toBe(profile.groundY);
    expect(main.maxY).toBe(profile.roofTopY);
    expect(main.topAt).toBe(abgeordnetenhausDisplayTopAt);
    for (const id of annexIds) {
      const annex = payload.buildings.find((part) => part.id === id)!;
      const obstacle = indexed.get(id)!;
      expect(annex).toBeDefined();
      expect(obstacle.ring).toBe(annex.ring);
      expect(obstacle.holes).toBe(annex.holes!);
      expect(obstacle.minY).toBe(annex.y0_dm / 10);
      expect(obstacle.maxY).toBe((annex.y0_dm + annex.h_dm) / 10);
      expect(obstacle.topAt).toBeUndefined();
    }
    // The JKH source-gap supplement has a mode-dependent polygon/cube top;
    // its source podium stays untouched and is tested independently.
    // Museum, BahnTower and ministry support follow their individual roof planes.
    expect([...indexed.values()].filter((obstacle) => obstacle.topAt).map((obstacle) => obstacle.sourceId).sort())
      .toEqual([
        ...BELLEVUE_IDS,
        ...FIFTY_HERTZ_IDS,
        profile.mainPrismId,
        "RVRCWHeT",
        "FqL2azIz",
        ...MUSIC_MUSEUM_IDS,
        ...DB_TOWER_PRISM_IDS,
        ...ECONOMIC_MINISTRY_SOURCE_IDS,
        "24314976",
        BUNDESRAT_MAIN_ID,
        JAKOB_KAISER_EAST_UPPER_PROFILE.displayPrismId,
        ...ADMIRALSPALAST_IDS,
        ...MUSEUM_TRIAD_SOURCES.flatMap(({ parts }) => parts.map(({ id }) => id)),
        ...BEBELPLATZ_BUILDING_SOURCES.flatMap(({ parts }) => parts.map(({ id }) => id)),
        ...[DOM_ALTES_SOURCE.dom, DOM_ALTES_SOURCE.altes].flatMap(({ parts }) => parts.map(({ id }) => id)),
      ].sort());
  });

  test("blocks the new wall height, follows local roof height and keeps source courts open in every mode", () => {
    for (const mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum"] as const) {
      const access = { walkableInteriorAt: (x: number, y: number, z: number, id?: string) => visualModeWalkableInteriorAt(mode, x, y, z, id) };
      for (const [u, v] of [[0, -5], [-40, -8], [0, -59], [6, -59], [0, -69]]) {
        const [x, , z] = abgeordnetenhausWorldPoint(u, 0, v);
        const top = abgeordnetenhausDisplayTopAt(x, z)!;
        expect(pedestrianPointIsBlocked(x, z, 20, obstacles, access)).toBeTrue();
        expect(pedestrianPointIsBlocked(x, z, top - 1, obstacles, access)).toBeTrue();
        expect(pedestrianPointIsBlocked(x, z, top, obstacles, access)).toBeFalse();
      }
      for (const ring of profile.courtyardHolesWorldM) {
        const x = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
        const z = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
        expect(abgeordnetenhausDisplayTopAt(x, z)).toBeNull();
        for (const y of [profile.groundY, 20, 32]) {
          expect(pedestrianPointIsBlocked(x, z, y, obstacles, access)).toBeFalse();
        }
      }
    }
  });

  test("vertical walking entry and idle steps land on the actual local roof, not the old 3 m shell or tallest cap", () => {
    for (const [u, v] of [[0, -5], [-40, -8], [0, -59], [6, -59], [0, -69]]) {
      const [x, , z] = abgeordnetenhausWorldPoint(u, 0, v);
      const top = abgeordnetenhausDisplayTopAt(x, z)!;
      // Side/hip hints deliberately sit below the tallest central cap.
      const spawn = pedestrianSpawnFromView(environment,
        { x: 500, y: 4.8, z: 1000 },
        { x, y: top + PEDESTRIAN_EYE_HEIGHT_M + 0.1, z },
        { x: 0, y: 0, z: -1 });
      const state = createPedestrianState(environment, spawn!);
      expect(state.x).toBe(x);
      expect(state.z).toBe(z);
      expect(state.groundY).toBeCloseTo(top, 6);
      expect(state.groundY).toBeGreaterThan(29);
      expect(stepPedestrian(state, PEDESTRIAN_IDLE_INPUT, 0.04, environment).state.groundY).toBeCloseTo(top, 6);
    }
    const ring = profile.courtyardHolesWorldM[0];
    const x = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
    const z = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const court = createPedestrianState(environment, { x, z, yaw: 0, groundYHint: 50, preserveHorizontalPosition: true });
    expect(court.groundY).toBe(profile.groundY);
  });

  test("walking follows the glass hip uphill and downhill without dropping to terrain", () => {
    const [x, , z] = abgeordnetenhausWorldPoint(6, 0, -59);
    let state = createPedestrianState(environment, { x, z, yaw: 0, groundYHint: 40, preserveHorizontalPosition: true });
    for (const u of [0, -6, 0, 6]) {
      const target = abgeordnetenhausWorldPoint(u, 0, -59);
      for (let step = 0; step < 60; step += 1) {
        const dx = target[0] - state.x;
        const dz = target[2] - state.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.01) break;
        state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) },
          { ...PEDESTRIAN_IDLE_INPUT, forward: 1 }, Math.min(0.025, distance / PEDESTRIAN_WALK_SPEED_MPS), environment).state;
        expect(state.groundY).toBeGreaterThan(31);
      }
      expect(Math.hypot(state.x - target[0], state.z - target[2])).toBeLessThan(0.01);
      expect(state.groundY).toBeCloseTo(abgeordnetenhausDisplayTopAt(target[0], target[2])!, 6);
    }
  });

  test("capsule padding at a courtyard edge uses its adjoining side roof rather than the central cap", () => {
    const ring = profile.courtyardHolesWorldM[0];
    const midpoint = [(ring[0][0] + ring[1][0]) / 2, (ring[0][1] + ring[1][1]) / 2];
    const centre = [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
    const distance = Math.hypot(centre[0] - midpoint[0], centre[1] - midpoint[1]);
    const x = midpoint[0] + (centre[0] - midpoint[0]) / distance * 0.2;
    const z = midpoint[1] + (centre[1] - midpoint[1]) / distance * 0.2;
    expect(abgeordnetenhausDisplayTopAt(x, z)).toBeNull();
    expect(pedestrianPointIsBlocked(x, z, 20, obstacles)).toBeTrue();
    expect(pedestrianPointIsBlocked(x, z, profile.wallTopY + 0.05, obstacles)).toBeFalse();
  });
});
