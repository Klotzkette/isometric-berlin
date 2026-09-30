import { describe, expect, test } from "bun:test";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { CITY_WEST_PROFILE } from "../src/CityWestDetails";
import { gedaechtniskircheRuinSolidAt } from "../src/MinecraftGedaechtniskirche";
import { GEDAECHTNISKIRCHE_RETAINED_WINGS } from "../src/gedaechtniskircheSourceParts";
import {
  compilePedestrianObstacles,
  createPedestrianEnvironment,
  createPedestrianState,
  pedestrianPointIsBlocked,
  PEDESTRIAN_IDLE_INPUT,
  PEDESTRIAN_WALK_SPEED_MPS,
  stepPedestrian,
  type PedestrianEnvironment,
  type PedestrianPolygonObstacle,
} from "../src/pedestrianNavigation";

const data = new URL("../public/mesh/regierungsviertel/", import.meta.url);
const prisms = (await Bun.file(
  new URL("lod2-prisms.json", data),
).json()) as PrismPayload;
const ground = (await Bun.file(
  new URL("ground-context.json", data),
).json()) as VoxelPayload;
const source = prisms.buildings.find((p) => p.id === "15218373")!;
const ruin = CITY_WEST_PROFILE.gedaechtniskirche.oldTower;
const environment = createPedestrianEnvironment(
  ground,
  { water: [] },
  null,
  prisms,
);
const obstacles = environment.obstacles!;
const all = [...new Set([...obstacles.cells.values()].flat())];
const local = (u: number, v: number): readonly [number, number] => {
  const c = Math.cos(ruin.rotationY),
    s = Math.sin(ruin.rotationY);
  return [
    ruin.centerWorldM[0] + u * c + v * s,
    ruin.centerWorldM[1] - u * s + v * c,
  ];
};
const modes = [
  "day",
  "night",
  "snowstorm",
  "minecraft",
  "schwellenraum",
] as const;

function walkPassage(e: PedestrianEnvironment): void {
  const start = local(0, -12),
    end = local(0, 12);
  let state = createPedestrianState(e, {
    x: start[0],
    z: start[1],
    yaw: Math.atan2(end[0] - start[0], -(end[1] - start[1])),
    groundYHint: 6,
    preserveHorizontalPosition: true,
  });
  expect(state.x).toBeCloseTo(start[0], 6);
  expect(state.z).toBeCloseTo(start[1], 6);
  for (let step = 0; step < 120; step += 1) {
    const distance = Math.hypot(end[0] - state.x, end[1] - state.z);
    if (distance < 0.01) break;
    const result = stepPedestrian(
      state,
      { ...PEDESTRIAN_IDLE_INPUT, forward: 1 },
      Math.min(0.04, distance / PEDESTRIAN_WALK_SPEED_MPS),
      e,
    );
    expect(result.respawned).toBe(false);
    state = result.state;
  }
  expect(state.x).toBeCloseTo(end[0], 2);
  expect(state.z).toBeCloseTo(end[1], 2);
}

describe("Gedächtniskirche source-preserving pedestrian passage", () => {
  test("replaces only the old closed prism with one authored core and the exact retained wings", () => {
    expect(source).toBeDefined();
    expect(all.filter((o) => o.sourceId === "15218373")).toHaveLength(0);
    expect(
      all.filter((o) => o.sourceId === "15218373-authored-open-ruin"),
    ).toHaveLength(1);
    for (const wing of GEDAECHTNISKIRCHE_RETAINED_WINGS) {
      const matches = all.filter(
        (o) => o.sourceId === wing.id,
      ) as PedestrianPolygonObstacle[];
      expect(matches).toHaveLength(1);
      expect(matches[0].ring).toBe(wing.ring);
      expect(matches[0].coordinateScale).toBe(1);
      expect(matches[0].minY).toBe(wing.baseY);
      expect(matches[0].maxY).toBe(wing.topY);
    }
    const once = compilePedestrianObstacles({ buildings: [source] });
    const twice = compilePedestrianObstacles({ buildings: [source, source] });
    expect(twice.obstacleCount).toBe(once.obstacleCount);
    expect(twice.buildingCount).toBe(once.buildingCount);
    expect(once.obstacleCount).toBe(4);
  });

  test("blocks wall shells, the upper core and the low apse while leaving the memorial hall empty", () => {
    for (const u of [-15, 15]) {
      const [x, z] = local(u, 0);
      expect(pedestrianPointIsBlocked(x, z, 6, obstacles)).toBe(true);
    }
    const [x, z] = local(0, 0);
    expect(pedestrianPointIsBlocked(x, z, 6, obstacles)).toBe(false);
    expect(pedestrianPointIsBlocked(x, z, 35, obstacles)).toBe(true);
    expect(pedestrianPointIsBlocked(-2498, 1530, 6, obstacles)).toBe(true);
    const [outsideX, outsideZ] = local(18, 0);
    expect(pedestrianPointIsBlocked(outsideX, outsideZ, 6, obstacles)).toBe(
      false,
    );
  });

  test("the small door and raised circular breach keep radius-aware clearance", () => {
    const g = CITY_WEST_PROFILE.groundY;
    const solid = (u: number, v: number, h: number, r = 0): boolean => {
      const [x, z] = local(u, v);
      return gedaechtniskircheRuinSolidAt(x, g + h, z, r);
    };
    for (const v of [-8.6, 8.6]) {
      expect(solid(0, v, 2, 0.35)).toBe(false);
      expect(solid(1.4, v, 2, 0.35)).toBe(true);
      expect(solid(0, v, 4.7, 0.2)).toBe(true);
      expect(solid(0, v, 16.4, 0.35)).toBe(false);
      expect(solid(5.6, v, 16.4, 0.35)).toBe(true);
      expect(solid(0, v, 10, 0.2)).toBe(v < 0);
    }
    expect(solid(0, 0, 7.9)).toBe(true);
    expect(solid(0, 0, 17)).toBe(false);
    expect(solid(0, -8.6, 25, 0.2)).toBe(false);
    expect(solid(2.8, -8.6, 25, 0.2)).toBe(true);
    expect(solid(0, 0, 27, 0.2)).toBe(false);
  });

  test("bell arches and the broken crown stay hollow while represented piers are solid", () => {
    const g = CITY_WEST_PROFILE.groundY;
    const solid = (u: number, v: number, h: number, r = 0): boolean => {
      const [x, z] = local(u, v);
      return gedaechtniskircheRuinSolidAt(x, g + h, z, r);
    };
    const apothem = 10.3 * Math.cos(Math.PI / 8);
    expect(solid(0, 0, 49)).toBe(false);
    expect(solid(1.5, apothem - 0.3, 49, 0.3)).toBe(false);
    expect(solid(0, apothem - 0.3, 49, 0.1)).toBe(true);
    expect(solid(3.5, apothem - 0.3, 49, 0.1)).toBe(true);
    expect(solid(0, 0, 66)).toBe(false);
    const crown = 9.1 * Math.cos(Math.PI / 8) - 0.11 * (66 - 55.4);
    expect(solid(0, crown + 0.09, 66, 0.1)).toBe(true);
    expect(solid(0, crown + 1, 66, 0.1)).toBe(false);
    const cornerRadius =
      (9.1 * Math.cos(Math.PI / 8) - 0.11 * (60 - 55.4)) /
      Math.cos(Math.PI / 8);
    for (let side = 0; side < 8; side += 1) {
      const a = ((side + 0.5) * Math.PI) / 4;
      expect(
        solid(Math.sin(a) * cornerRadius, Math.cos(a) * cornerRadius, 60, 0.05),
      ).toBe(true);
    }
  });

  for (const mode of modes)
    test(`${mode}: walking crosses the complete arch continuously in the real city payload`, () => {
      const e = { ...environment, visualMode: () => mode };
      for (let v = -12; v <= 12; v += 0.5) {
        const [x, z] = local(0, v);
        expect(pedestrianPointIsBlocked(x, z, 6, obstacles)).toBe(false);
      }
      walkPassage(e);
    });

  test("an unrelated overlapping building is never exempted by the church opening", () => {
    const [x, z] = local(0, 0);
    const overlapping = compilePedestrianObstacles({
      buildings: [
        source,
        {
          ...source,
          id: "unrelated-neighbour",
          ring: [
            [x - 1, z - 1],
            [x + 1, z - 1],
            [x + 1, z + 1],
            [x - 1, z + 1],
          ].map((p) => p.map((v) => v * 10)),
          holes: [],
          y0_dm: 52,
          h_dm: 100,
        },
      ],
    });
    expect(pedestrianPointIsBlocked(x, z, 6, overlapping)).toBe(true);
  });
});
