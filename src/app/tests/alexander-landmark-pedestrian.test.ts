import { describe, expect, test } from "bun:test";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import {
  createSchwellenraumMemorialProtectionIndex,
  schwellenraumProtectedMemorialAt,
  schwellenraumProtectedMemorialClearanceM,
} from "../src/schwellenraumMemorialProtection";
import { schwellenraumProtectedAt } from "../src/SchwellenraumInteriors";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createPedestrianEnvironment,
  createPedestrianState,
  pedestrianPointIsBlocked,
  PEDESTRIAN_IDLE_INPUT,
  PEDESTRIAN_WALK_SPEED_MPS,
  stepPedestrian,
  type PedestrianEnvironment,
  type PedestrianState,
  type PedestrianPolygonObstacle,
} from "../src/pedestrianNavigation";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";
import {
  ALEXANDER_CIVIC_PARTS,
  ALEXANDER_CIVIC_PRISM_IDS,
  ALEXANDER_CIVIC_SOURCE,
  MARIEN_TOWER,
  MARIEN_TOWER_PART_IDS,
  RATHAUS_TOWER_ID,
  RATHAUS_TOWER_PLATFORM,
  RATHAUS_TERMINAL,
  alexanderCivicWalkableAt,
} from "../src/alexanderCivicProfile";
import {
  ALEXANDER_PUBLIC_REALM_SOURCE as S,
  ALEXANDER_PUBLIC_REALM_SOLIDS,
  alexanderPublicRealmSolidAt,
  alexanderPublicRealmSupportHeightAt,
} from "../src/alexanderPublicRealmProfile";
import { FERNSEHTURM_PROFILE as TV } from "../src/schlossEastProfile";
import {
  SCHLOSS_EAST_NAVIGATION,
  schlossEastNavigationGroundAt,
} from "../src/schlossEastNavigation";

const modes = [
  "day",
  "night",
  "snowstorm",
  "minecraft",
  "schwellenraum",
] as const;
const data = new URL("../public/mesh/regierungsviertel/", import.meta.url);
const ground = (await Bun.file(
  new URL("ground-context.json", data),
).json()) as VoxelPayload;
const prisms = (await Bun.file(
  new URL("lod2-prisms.json", data),
).json()) as PrismPayload;
const street = (await Bun.file(
  new URL("street-details.json", data),
).json()) as StreetDetailsPayload;
const protection = createSchwellenraumMemorialProtectionIndex(street.monuments);
function environmentFor(mode: (typeof modes)[number]): PedestrianEnvironment {
  // Full actual ground/prism payload: do not hide unknown overlapping geometry.
  const env = createPedestrianEnvironment(ground, { water: [] }, null, prisms);
  env.visualMode = () => mode;
  env.protectedVolumeAt = (x, y, z) =>
    mode === "schwellenraum" &&
    (schwellenraumProtectedAt(x, y, z) ||
      schwellenraumProtectedMemorialAt(protection, x, y, z));
  env.walkableInteriorAt = (x, y, z, id) =>
    visualModeWalkableInteriorAt(mode, x, y, z, id);
  env.interiorSolidAt = (x, y, z, r) => alexanderPublicRealmSolidAt(x, z, y, r);
  env.interiorGroundAt = (x, z, h) =>
    alexanderPublicRealmSupportHeightAt(x, z, h ?? 5.2);
  return env;
}
const environments = new Map(modes.map((m) => [m, environmentFor(m)]));
const env = environments.get("day")!;
const all = [...new Set([...env.obstacles!.cells.values()].flat())];
const polygons = all.filter(
  (p): p is PedestrianPolygonObstacle => p.kind === "polygon",
);
const indexed = new Map(polygons.map((p) => [p.sourceId, p]));
function walkTo(
  state: PedestrianState,
  x: number,
  z: number,
  e: PedestrianEnvironment,
): PedestrianState {
  for (let i = 0; i < 300; i++) {
    const distance = Math.hypot(x - state.x, z - state.z);
    if (distance < 0.02) return state;
    const step = stepPedestrian(
      { ...state, yaw: Math.atan2(x - state.x, -(z - state.z)) },
      { ...PEDESTRIAN_IDLE_INPUT, forward: 1 },
      Math.min(0.04, distance / PEDESTRIAN_WALK_SPEED_MPS),
      e,
    );
    expect(step.respawned).toBeFalse();
    state = step.state;
  }
  throw new Error(
    `Walking stopped at [${state.x},${state.groundY},${state.z}] before [${x},${z}]`,
  );
}
function spawn(
  e: PedestrianEnvironment,
  x: number,
  z: number,
  h = 5.2,
): PedestrianState {
  return createPedestrianState(e, {
    x,
    z,
    yaw: 0,
    groundYHint: h,
    preserveHorizontalPosition: true,
  });
}

describe("Alexander landmarks in real pedestrian environments", () => {
  test("seven source roofs replace old generic shells once, with three open Rathaus courts", () => {
    const roofs = ALEXANDER_CIVIC_PARTS.filter(
      (p) => !MARIEN_TOWER_PART_IDS.has(p.id),
    );
    expect(roofs).toHaveLength(7);
    for (const p of roofs) {
      expect(polygons.filter((o) => o.sourceId === p.id)).toHaveLength(1);
      expect(indexed.get(p.id)!.ring).toBe(p.ring);
      expect(indexed.get(p.id)!.holes).toBe(p.holes);
    }
    for (const id of [
      ...ALEXANDER_CIVIC_PRISM_IDS,
      ...MARIEN_TOWER_PART_IDS,
      ...TV.sourcePartIds,
    ])
      expect(indexed.has(id)).toBeFalse();
    const main = ALEXANDER_CIVIC_SOURCE.profiles.rathaus.parts.find(
      (p) => p.holes.length === 3,
    )!;
    expect(indexed.get(main.id)!.holes).toHaveLength(3);
    expect(indexed.get(RATHAUS_TOWER_ID)!.maxY).toBe(RATHAUS_TOWER_PLATFORM);
  });
  for (const mode of modes)
    test(`${mode}: eastern courts/streets spawn and walk without returning to Pariser Platz`, () => {
      const e = environments.get(mode)!;
      for (const [x, z] of [
        [2531.953, 112.68],
        [2514.208, 151.7095],
        [2491.348, 123.1125],
      ]) {
        expect(e.groundAt(x, z)).not.toBeNull();
        let state = spawn(e, x, z);
        expect(state.x).toBe(x);
        expect(state.z).toBe(z);
        expect(
          pedestrianPointIsBlocked(x, z, state.groundY, e.obstacles, e),
        ).toBeFalse();
        state = walkTo(state, x + 0.75, z + 0.5, e);
        expect(state.x).toBeCloseTo(x + 0.75, 2);
      }
      // Public space south of the shaft and north of the Rathaus; deliberately
      // beyond the former terrain-grid cutoff x=2412.
      let street = spawn(e, 2530, -90);
      expect(street.x).toBe(2530);
      street = walkTo(street, 2560, -90, e);
      expect(street.x).toBeCloseTo(2560, 2);
      const platform = spawn(
        e,
        RATHAUS_TERMINAL.x + 4,
        RATHAUS_TERMINAL.z,
        100,
      );
      expect(platform.groundY).toBeCloseTo(77.46, 6);
      expect(
        pedestrianPointIsBlocked(
          platform.x,
          platform.z,
          platform.groundY,
          e.obstacles,
          e,
        ),
      ).toBeFalse();
      const step = walkTo(platform, platform.x + 0.4, platform.z, e);
      expect(step.groundY).toBeCloseTo(77.46, 6);
    });
  test("source-clipped extension does not fill the enlarged bounding rectangle or alter old terrain", () => {
    const old = createPedestrianEnvironment(ground, { water: [] });
    expect(old.bounds.maxX).toBe(2412);
    expect(env.bounds.maxX).toBe(2805);
    for (const [x, z] of [
      [2413, 231],
      [2600, -361],
      [2805.1, 0],
      [2600, 800],
      [2600, -800],
    ])
      expect(env.groundAt(x, z)).toBeNull();
    for (const [x, z] of [
      [2400, 0],
      [2226, 90],
      [500, 290],
      [0, 0],
      [-1000, 450],
      [-180, 490],
    ])
      expect(env.groundAt(x, z)).toBe(old.groundAt(x, z));
    expect(schlossEastNavigationGroundAt(2531.953, 112.68)).toBeCloseTo(5.3, 6);
    expect(
      schlossEastNavigationGroundAt(2531.953, 112.68, "minecraft"),
    ).toBeCloseTo(5.52, 6);
    expect(SCHLOSS_EAST_NAVIGATION.height_policy).toContain(
      "not surveyed terrain",
    );
  });
  test("Marien lantern is open between eight solid piers and unrelated buildings are never bypassed", () => {
    const t = MARIEN_TOWER,
      c = Math.cos(t.yaw),
      s = Math.sin(t.yaw),
      world = (u: number, v: number) => [
        t.x + c * u + s * v,
        t.z - s * u + c * v,
      ];
    for (const mode of modes) {
      const e = environments.get(mode)!;
      expect(
        pedestrianPointIsBlocked(t.x, t.z, 60, e.obstacles, e),
      ).toBeFalse();
      expect(pedestrianPointIsBlocked(t.x, t.z, 45, e.obstacles, e)).toBeTrue();
      expect(pedestrianPointIsBlocked(t.x, t.z, 74, e.obstacles, e)).toBeTrue();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          [x, z] = world(Math.cos(a) * 4.75, Math.sin(a) * 4.75);
        expect(pedestrianPointIsBlocked(x, z, 60, e.obstacles, e)).toBeTrue();
      }
      const gap = world(
        Math.cos(Math.PI / 8) * 4.6,
        Math.sin(Math.PI / 8) * 4.6,
      );
      expect(
        pedestrianPointIsBlocked(gap[0], gap[1], 60, e.obstacles, e),
      ).toBeFalse();
      expect(
        alexanderCivicWalkableAt(t.x, 60, t.z, "unrelated-building"),
      ).toBeFalse();
      expect(
        visualModeWalkableInteriorAt(mode, t.x, 60, t.z, "unrelated-building"),
      ).toBeFalse();
    }
  });
  test("steel Rathaus terminal and TV narrow shaft/sphere retain distinct radial solids", () => {
    for (const id of [
      "marien-source-bound-open-tower",
      "rathaus-open-steel-terminal",
      "fernsehturm-outline",
    ])
      expect(all.filter((o) => o.sourceId === id)).toHaveLength(1);
    for (const mode of modes) {
      const e = environments.get(mode)!;
      expect(
        pedestrianPointIsBlocked(
          RATHAUS_TERMINAL.x,
          RATHAUS_TERMINAL.z,
          89,
          e.obstacles,
          e,
        ),
      ).toBeTrue();
      expect(
        pedestrianPointIsBlocked(
          RATHAUS_TERMINAL.x + 2.2,
          RATHAUS_TERMINAL.z,
          89,
          e.obstacles,
          e,
        ),
      ).toBeFalse();
      expect(
        pedestrianPointIsBlocked(TV.x + 10, TV.z, 104, e.obstacles, e),
      ).toBeFalse();
      expect(
        pedestrianPointIsBlocked(TV.x + 4, TV.z, 104, e.obstacles, e),
      ).toBeTrue();
      expect(
        pedestrianPointIsBlocked(
          TV.x + 14,
          TV.z,
          TV.groundY + 212,
          e.obstacles,
          e,
        ),
      ).toBeTrue();
      expect(
        pedestrianPointIsBlocked(TV.x + 3, TV.z, 305, e.obstacles, e),
      ).toBeFalse();
    }
  });
  test("the Forum stays traversable while represented figures, trees and fountain are solid", () => {
    for (const mode of modes) {
      const e = environments.get(mode)!;
      const start = spawn(e, 2226, 90);
      const end = walkTo(start, 2273, 90, e);
      expect(end.x).toBeCloseTo(2273, 2);
      for (const body of ALEXANDER_PUBLIC_REALM_SOLIDS.slice(0, 3))
        expect(
          pedestrianPointIsBlocked(
            body.x,
            body.z,
            body.base + 0.2,
            e.obstacles,
            e,
          ),
        ).toBeTrue();
      const tree = ALEXANDER_PUBLIC_REALM_SOLIDS.find(
        (p) => p.id.startsWith("node/") && p.radius === 0.22,
      )!;
      expect(tree).toBeDefined();
      expect(
        pedestrianPointIsBlocked(
          tree.x,
          tree.z,
          tree.base + 0.2,
          e.obstacles,
          e,
        ),
      ).toBeTrue();
      expect(
        alexanderPublicRealmSolidAt(
          ...(S.ensemble.center_xz as [number, number]),
          S.ground_y_m + 0.1,
        ),
      ).toBeFalse();
    }
  });
  test("Forum prop clearance retains its full source footprint while visitor protection follows only actual solids", () => {
    const entry = street.monuments!.find((p) => p.osm_key === "way/895523112")!;
    const local = createSchwellenraumMemorialProtectionIndex([entry]);
    expect(local.sourceKeys.has(entry.osm_key)).toBeTrue();
    expect(local.shapes[0].halfWidthM).toBe(entry.w_dm / 20 + 1.25);
    expect(local.shapes[0].halfDepthM).toBe(entry.d_dm / 20 + 1.25);
    for (const [x, z] of [
      [2226, 90],
      [2238.55, 96],
      [2273, 90],
    ]) {
      expect(
        schwellenraumProtectedMemorialAt(local, x, S.ground_y_m + 0.19, z),
      ).toBeFalse();
      expect(schwellenraumProtectedMemorialClearanceM(local, x, z)).toBe(0);
    }
    for (const body of ALEXANDER_PUBLIC_REALM_SOLIDS.slice(0, 2)) {
      expect(
        schwellenraumProtectedMemorialAt(
          local,
          body.x,
          body.base + 0.2,
          body.z,
        ),
      ).toBeTrue();
      expect(
        schwellenraumProtectedMemorialAt(local, body.x, body.top + 0.1, body.z),
      ).toBeFalse();
    }
  });
  test("walks up onto the 18 cm Marx/Engels plinth and off again in every mode", () => {
    for (const mode of modes) {
      const e = environments.get(mode)!;
      let state = spawn(e, 2238.55, 94.5);
      state = walkTo(state, 2238.55, 96, e);
      expect(state.groundY).toBeCloseTo(S.ground_y_m + 0.18, 6);
      expect(
        stepPedestrian(state, PEDESTRIAN_IDLE_INPUT, 0.04, e).state.groundY,
      ).toBeCloseTo(state.groundY, 6);
      expect(
        pedestrianPointIsBlocked(
          state.x,
          state.z,
          state.groundY,
          e.obstacles,
          e,
        ),
      ).toBeFalse();
      state = walkTo(state, 2238.55, 93.5, e);
      expect(state.groundY).toBeCloseTo(spawn(e, 2238.55, 93.5).groundY, 6);
    }
  });
});
