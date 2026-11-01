import { describe, expect, test } from "bun:test";
import { hauptbahnhofDoorApproachAt, HAUPTBAHNHOF_ACCESS } from "../src/HauptbahnhofAccessProfile";
import { HBF_CIRCULATION_V291 as hbf, hbfCirculationGroundLocalAtV291, hbfFlightGroundAtV291, hbfLevelFloorContainsV291, hbfLocalToWorldV291, hbfSlabCutAtV291, hbfWorldToLocalV291 } from "../src/HbfCirculationV291";
import { hbfSlabOpeningsV291 } from "../src/HbfGeometryOpeningsV291";
import { hauptbahnhofGroundAt, hauptbahnhofSolidAt, hauptbahnhofWalkableInteriorAt } from "../src/HauptbahnhofNavigation";
import { HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS } from "../src/MinecraftHeroNavigation";
import { PRISM_GLASSED_IDS, isHauptbahnhofFootprintSuppressed } from "../src/IsometricCityWorld";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked, PEDESTRIAN_WALK_SPEED_MPS, stepPedestrian, type PedestrianEnvironment, type PedestrianState } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";

const modes: readonly VisualMode[] = ["day", "night", "snowstorm", "minecraft", "schwellenraum", "flood"];
const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as NonNullable<Parameters<typeof createPedestrianEnvironment>[3]>;
const terrain = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const fused = await Bun.file(new URL("../../../geo_data/regierungsviertel/fused_sources.json", import.meta.url)).json() as {
  features: { feature_id: string; geometry_evidence: { source: string; ref: string; attributes: { parent_building_id: string } }[] }[];
};

function environment(mode: VisualMode): PedestrianEnvironment {
  const result = createPedestrianEnvironment(terrain, { water: [] }, null, prisms);
  result.walkableInteriorAt = (x, y, z, id) => visualModeWalkableInteriorAt(mode, x, y, z, id);
  result.interiorSolidAt = (x, y, z) => hauptbahnhofSolidAt(mode, x, y, z);
  result.interiorGroundAt = (x, z, hint) => hauptbahnhofGroundAt(mode, x, z, hint);
  return result;
}

function walk(state: PedestrianState, target: readonly [number, number, number], env: PedestrianEnvironment, analog: number): PedestrianState {
  const [tx, , tz] = hbfLocalToWorldV291(target);
  for (let i = 0; i < 800; i++) {
    const dx = tx - state.x, dz = tz - state.z, distance = Math.hypot(dx, dz);
    if (distance < 0.01) return state;
    const dt = Math.min(0.04, distance / (PEDESTRIAN_WALK_SPEED_MPS * analog));
    state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) }, {
      forward: analog, strafe: 0, turn: 0, look: 0, sprint: false,
    }, dt, env).state;
  }
  throw new Error(`Blocked going to ${target.join(",")}; stopped ${hbfWorldToLocalV291(state.x, state.groundY, state.z).join(",")}`);
}

describe("Hauptbahnhof connected five-level circulation v291", () => {
  test("pins the complete seven station-owned source envelopes whose upper railway passages are admitted", () => {
    const hashes: Record<string, string> = {
      o0aS4DvM: "ab67aeaca6dd300e288eeb975a22df204a11e0e30901fe449bd718c6eb8683ae",
      clykH08k: "0e5016df9dbb71330dfc5eab0f6082680817603a8ffeb119741549dfef02f5e6",
      gqQdZFTa: "6adb566a3004bcda7306ef73877ea70fc511191bdb1422ef296f56919b80b0de",
      hlYYwDX2: "8cf6a02bb18e2b736ff8785ee99cc85966eb033d206fdca0ff1a0eec63aaba48",
      rg8J0PRu: "35443e049ff880f326265c0e055751c29da7b5dfbed10cf0f5f7461a487a14b0",
      jacWOmHc: "64dca1dedb2c72aae0d6bf89903a8e10b96dc6ecd0e4af246cab9f84a5b84d27",
      SLLM5yNi: "fbfeb1cfddacfb75798d1094589e4aed4c5264d2b80d00633f2678e1a750b331",
    };
    expect(hbf.upperRailEnvelopeSourceIds).toEqual(Object.keys(hashes));
    expect(hbf.upperRailEnvelopeSourceSha256).toEqual(hashes);
    for (const id of hbf.upperRailEnvelopeSourceIds) {
      const record = prisms.buildings.find((building) => building.id === id);
      expect(record).toBeDefined();
      expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(record)).digest("hex")).toBe(hashes[id]);
      const receipt = hbf.upperRailEnvelopeSourceParents[id];
      const owner = fused.features.find((feature) => feature.feature_id === receipt.featureId)!;
      expect(owner).toBeDefined();
      const lod2 = owner.geometry_evidence.find((evidence) => evidence.source === "lod2")!;
      expect(lod2.ref).toBe(`buildings.gpkg#building_id=${receipt.featureId}`);
      expect(lod2.attributes.parent_building_id).toBe(receipt.parentId);
    }
    for (const id of ["hlYYwDX2", "SLLM5yNi"]) expect(PRISM_GLASSED_IDS.has(id)).toBeTrue();
    for (const id of ["rg8J0PRu", "jacWOmHc"]) {
      expect(isHauptbahnhofFootprintSuppressed(prisms.buildings.find((building) => building.id === id)!)).toBeTrue();
    }
  });

  test("all three complete upper platform courses keep real support and clear source bodies through both office bridges", () => {
    for (const mode of modes) {
      const env = environment(mode);
      let checked = 0;
      for (let x = -112; x <= 112; x += 0.5) for (const centre of hbf.upperPlatformCentresLocalZ) {
        const z = centre + (0.000787 * x * x + 0.2233 * x);
        if (!hbfLevelFloorContainsV291("upper-rail", x, z, mode === "minecraft")) continue;
        // Closed shafts remain physical. Their real circular/square rims are
        // not a source-wall regression and are tested separately above.
        if (hbf.shafts.some((shaft) => Math.max(Math.abs(x - shaft.x), Math.abs(z - shaft.z)) < 3)) continue;
        const point = hbfLocalToWorldV291([x, 10.73, z]);
        expect(hauptbahnhofGroundAt(mode, point[0], point[2], point[1]), `${mode} x${x} island${centre}`).toBeCloseTo(point[1], 5);
        expect(pedestrianPointIsBlocked(point[0], point[2], point[1], env.obstacles, env), `${mode} x${x} island${centre}`).toBeFalse();
        checked++;
      }
      expect(checked).toBeGreaterThan(1000);
      for (const side of [-1, 1]) for (const centre of hbf.upperPlatformCentresLocalZ) {
        const curve = (x: number) => centre + 0.000787 * x * x + 0.2233 * x;
        const start = hbfLocalToWorldV291([side * 40, 10.73, curve(side * 40)]);
        let state = createPedestrianState(env, { x: start[0], z: start[2], groundYHint: start[1], preserveHorizontalPosition: true });
        state = walk(state, [side * 76, 10.73, curve(side * 76)], env, 0.65);
        state = walk(state, [side * 112, 10.73, curve(side * 112)], env, 0.65);
        expect(state.groundY).toBeCloseTo(start[1], 5);
        const beyond = hbfLocalToWorldV291([side * 114, 10.73, curve(side * 114)]);
        expect(hauptbahnhofGroundAt(mode, beyond[0], beyond[2], beyond[1])).toBeNull();
      }
      for (const shaft of hbf.shafts) expect(hbfLevelFloorContainsV291("upper-rail", shaft.x, shaft.z, mode === "minecraft")).toBeFalse();
    }
  });

  test("foreign copies of the exact station owner footprints stay physical on the upper platforms in every mode", () => {
    for (const mode of modes) for (const [id, x] of [["hlYYwDX2", -42], ["rg8J0PRu", 55]] as const) {
      const source = prisms.buildings.find((building) => building.id === id)!;
      const foreignId = `foreign-${id}`;
      const env = createPedestrianEnvironment(terrain, { water: [] }, null, {
        ...prisms, buildings: [...prisms.buildings, { ...source, id: foreignId }],
      });
      env.walkableInteriorAt = (px, py, pz, owner) => visualModeWalkableInteriorAt(mode, px, py, pz, owner);
      const point = hbfLocalToWorldV291([x, 10.73, 0.000787 * x * x + 0.2233 * x]);
      expect(pedestrianPointIsBlocked(point[0], point[2], point[1], env.obstacles, env)).toBeTrue();
      expect(hauptbahnhofWalkableInteriorAt(...point, foreignId)).toBeFalse();
      for (const owner of hbf.upperRailEnvelopeSourceIds) {
        expect(hauptbahnhofWalkableInteriorAt(...hbfLocalToWorldV291([x, 20, 0]), owner)).toBeFalse();
      }
    }
  });

  test("six exact-source panoramic shafts, all five slab tops and safe connected flight inclines", () => {
    expect(hbf.shafts).toHaveLength(6);
    expect(hbf.levels.map((level) => level.topLocalY)).toEqual([10.73, 4.85, 0.25, -5.15, -14.055]);
    expect(hbf.flights.filter((flight) => flight.kind === "escalator")).toHaveLength(16);
    expect(hbf.flights.filter((flight) => flight.kind === "stairs")).toHaveLength(8);
    for (const flight of hbf.flights) {
      const rise = flight.from[1] - flight.to[1];
      const run = Math.hypot(flight.to[0] - flight.from[0], flight.to[2] - flight.from[2]);
      expect(Math.atan2(rise, run) * 180 / Math.PI).toBeLessThan(33);
      for (const endpoint of [flight.from, flight.to]) {
        expect(hbfCirculationGroundLocalAtV291(endpoint[0], endpoint[2], endpoint[1])).toBeCloseTo(endpoint[1], 6);
      }
    }
  });

  test("all twelve doors react to a nearby camera regardless of walking state", () => {
    for (const side of [-1, 1] as const) for (const x of HAUPTBAHNHOF_ACCESS.doorCentresLocalX) {
      for (const height of [0.25, 1.9, 8, 12]) {
        expect(hauptbahnhofDoorApproachAt(x, height, side * 105, side)).toBeTrue();
        expect(hauptbahnhofDoorApproachAt(x, height, side * 85, side)).toBeTrue();
        expect(hauptbahnhofDoorApproachAt(x, height, side * 105, side === 1 ? -1 : 1)).toBeFalse();
      }
    }
    expect(hauptbahnhofDoorApproachAt(0, 2, 150, 1)).toBeFalse();
    expect(hauptbahnhofDoorApproachAt(Number.NaN, 2, 90, 1)).toBeFalse();
  });

  test("all modes keep the same floor at every flight sample and below-ground mode switch", () => {
    for (const flight of hbf.flights) for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const point = flight.from.map((value, axis) => value + (flight.to[axis] - value) * t) as [number, number, number];
      const world = hbfLocalToWorldV291(point);
      for (const mode of modes) expect(hauptbahnhofGroundAt(mode, world[0], world[2], world[1])).toBeCloseTo(world[1], 5);
      expect(hbfFlightGroundAtV291(flight, point[0], point[2])).toBeCloseTo(point[1], 6);
    }
    expect(hbfCirculationGroundLocalAtV291(0, -60, 0.25)).toBe(-15);
    expect(hbfCirculationGroundLocalAtV291(9.5, -80, -14.055)).toBe(-14.055);
    expect(hbfCirculationGroundLocalAtV291(400, 0, 0.25)).toBeNull();
  });

  test("flying down through real slab holes finds the incline instead of an absent upper floor", () => {
    const upper = hbf.flights.find((flight) => flight.kind === "stairs" && flight.fromLevelId === "upper-rail")!;
    const t = 0.6;
    const x = upper.from[0] + (upper.to[0] - upper.from[0]) * t;
    const z = upper.from[2] + (upper.to[2] - upper.from[2]) * t;
    const slope = upper.from[1] + (upper.to[1] - upper.from[1]) * t;
    expect(slope).toBeLessThan(9.25 - 0.5);
    expect(slope + 2.9).toBeGreaterThan(9.25);
    for (const native of [false, true]) {
      expect(hbfLevelFloorContainsV291("upper-rail", x, z, native)).toBeFalse();
      expect(hbfCirculationGroundLocalAtV291(x, z, 20, native)).toBeCloseTo(slope, 6);
      for (const shaft of hbf.shafts) for (const level of hbf.levels) {
        expect(hbfLevelFloorContainsV291(level.id, shaft.x, shaft.z, native)).toBeFalse();
      }
    }
    // Retained gallery bridges remain traversable at the former glass joins.
    for (const level of hbf.levels) {
      if (!("openHalfM" in level)) continue;
      for (const mode of modes) for (const sign of [-1, 1]) {
        expect(hauptbahnhofSolidAt(mode, ...hbfLocalToWorldV291([level.openHalfM, level.topLocalY + 0.8, sign * level.bridgeLocalZ]))).toBeFalse();
      }
    }
  });

  test("pure floor cuts agree with geometry's independent plane-volume projection", () => {
    const slabBounds = [[9.25, 10.73], [4.35, 4.85], [-0.25, 0.25], [-5.65, -5.15], [-15.005, -14.055]] as const;
    for (const native of [false, true]) for (const [bottom, top] of slabBounds) {
      const cuts = hbfSlabOpeningsV291(bottom, top, native);
      const projected = (x: number, z: number): boolean => cuts.some((cut) => {
        let low = bottom, high = top;
        for (const [a, b, c, d] of cut.planes) {
          const rest = a * x + c * z + d;
          if (Math.abs(b) < 1e-12) { if (rest < -1e-9) return false; }
          else if (b > 0) low = Math.max(low, -rest / b);
          else high = Math.min(high, -rest / b);
        }
        return low <= high + 1e-9;
      });
      for (const flight of hbf.flights) for (const t of [0.15, 0.45, 0.7, 0.95]) {
        const x = flight.from[0] + (flight.to[0] - flight.from[0]) * t;
        const z = flight.from[2] + (flight.to[2] - flight.from[2]) * t;
        for (const offset of [0, 1.1, 1.55, 3]) {
          expect(hbfSlabCutAtV291(x + offset, z, bottom, top, native)).toBe(projected(x + offset, z));
        }
      }
      for (const shaft of hbf.shafts) for (const offset of [0, 1.5, 1.9, 2.4]) {
        expect(hbfSlabCutAtV291(shaft.x + offset, shaft.z + offset, bottom, top, native)).toBe(projected(shaft.x + offset, shaft.z + offset));
      }
    }
  });

  test("preserves unknown source owners, offices, gable headers and every full-height shaft", () => {
    const known = HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS[0];
    for (const floor of hbf.levels) {
      const point = hbfLocalToWorldV291([12, floor.topLocalY + 0.8, 40]);
      expect(hauptbahnhofWalkableInteriorAt(...point, "foreign-owner")).toBeFalse();
      expect(hauptbahnhofWalkableInteriorAt(...point, known)).toBeTrue();
    }
    expect(hauptbahnhofWalkableInteriorAt(...hbfLocalToWorldV291([35, 2, 80]), known)).toBeFalse();
    expect(hauptbahnhofWalkableInteriorAt(...hbfLocalToWorldV291([0, 8, 90]), known)).toBeFalse();
    for (const id of hbf.upperRailEnvelopeSourceIds) {
      expect(hauptbahnhofWalkableInteriorAt(...hbfLocalToWorldV291([35, 20, 50]), id)).toBeFalse();
      expect(hauptbahnhofWalkableInteriorAt(...hbfLocalToWorldV291([35, 2, 80]), id)).toBeFalse();
    }
    for (const shaft of hbf.shafts) for (const floor of hbf.levels) {
      const point = hbfLocalToWorldV291([shaft.x, floor.topLocalY + 0.8, shaft.z]);
      for (const mode of modes) expect(hauptbahnhofSolidAt(mode, ...point)).toBeTrue();
    }
  });

  test("native block gables, side glazing and square shaft corners keep their represented physical extents", () => {
    for (const point of [[8, 2, 89.1], [-8, 2, -89.1], [19.2, 2, 70], [-19.2, 2, -70]] as const) {
      expect(hauptbahnhofSolidAt("minecraft", ...hbfLocalToWorldV291(point))).toBeTrue();
    }
    const shaft = hbf.shafts[0];
    const corner = hbfLocalToWorldV291([shaft.x + 1.9, -10, shaft.z + 1.9]);
    expect(hauptbahnhofSolidAt("minecraft", ...corner)).toBeTrue();
    expect(hauptbahnhofSolidAt("day", ...corner)).toBeFalse();
    for (const x of hbf.deepColumnCentresLocalX) for (const z of hbf.deepColumnCentresLocalZ) {
      for (const mode of modes) expect(hauptbahnhofSolidAt(mode, ...hbfLocalToWorldV291([x, -10, z]))).toBeTrue();
    }
  });

  test("every represented sliding door enters and exits, with connected main-to-deep and upper-platform returns in every mode", () => {
    for (const mode of modes) {
      const env = environment(mode);
      for (const side of [-1, 1] as const) {
        const doorCentres = mode === "minecraft" ? [-1.745, 1.745] : HAUPTBAHNHOF_ACCESS.doorCentresLocalX;
        for (const x of doorCentres) {
          const initial = hbfLocalToWorldV291([x, 0.25, side * 96]);
          let state = createPedestrianState(env, { x: initial[0], z: initial[2], yaw: 0 });
          state = walk(state, [x, 0.25, side * 85], env, 0.65);
          state = walk(state, [12, 0.25, side * 85], env, 0.65);
          state = walk(state, [12, 0.25, side * 54], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 54], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 55], env, 0.65);
          state = walk(state, [5.2, -5.15, side * 65.26], env, 0.65);
          state = walk(state, [5.2, -5.15, side * 67.5], env, 0.65);
          state = walk(state, [9.5, -14.055, side * 81.8], env, 0.65);
          expect(state.groundY).toBeCloseTo(hbf.frame.anchorWorld[1] - 14.055, 5);
          state = walk(state, [5.2, -5.15, side * 67.5], env, 0.65);
          state = walk(state, [5.2, -5.15, side * 65.26], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 55], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 54], env, 0.65);
          state = walk(state, [12, 0.25, side * 54], env, 0.65);
          state = walk(state, [12, 0.25, side * 44], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 44], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 42.74], env, 0.65);
          state = walk(state, [5.2, 4.85, side * 34], env, 0.65);
          state = walk(state, [5.2, 4.85, side * 33], env, 0.65);
          state = walk(state, [13, 4.85, side * 33], env, 0.65);
          const upper = hbf.flights.find((flight) => flight.kind === "escalator" && flight.arm === side && flight.fromLevelId === "upper-rail" && flight.from[0] > 0)!;
          const udx = upper.to[0] - upper.from[0], udz = upper.to[2] - upper.from[2], uLength = Math.hypot(udx, udz);
          const comb: [number, number, number] = [upper.to[0] + udx / uLength, upper.to[1], upper.to[2] + udz / uLength];
          state = walk(state, [13, 4.85, comb[2]], env, 0.65);
          state = walk(state, comb, env, 0.65);
          state = walk(state, upper.to, env, 0.65);
          state = walk(state, upper.from, env, 0.65);
          expect(state.groundY).toBeCloseTo(hbf.frame.anchorWorld[1] + 10.73, 5);
          state = walk(state, upper.to, env, 0.65);
          state = walk(state, comb, env, 0.65);
          state = walk(state, [13, 4.85, comb[2]], env, 0.65);
          state = walk(state, [13, 4.85, side * 33], env, 0.65);
          state = walk(state, [5.2, 4.85, side * 33], env, 0.65);
          state = walk(state, [5.2, 4.85, side * 34], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 42.74], env, 0.65);
          state = walk(state, [5.2, 0.25, side * 44], env, 0.65);
          state = walk(state, [12, 0.25, side * 44], env, 0.65);
          state = walk(state, [12, 0.25, side * 85], env, 0.65);
          state = walk(state, [x, 0.25, side * 85], env, 0.65);
          state = walk(state, [x, 0.25, side * 96], env, 0.65);
          expect(Math.hypot(state.x - initial[0], state.z - initial[2])).toBeLessThan(0.02);
        }
      }
    }
  });

  for (const mode of modes) test(`${mode}: actual source-payload pedestrian walks every flight down/up with keyboard and partial analog`, () => {
    const env = environment(mode);
    for (const analog of [1, 0.65]) for (const flight of hbf.flights) {
      const upperComb = hbf.combs.find((comb) => comb.flightId === flight.id && comb.end === "from")!;
      const lowerComb = hbf.combs.find((comb) => comb.flightId === flight.id && comb.end === "to")!;
      const origin = hbfLocalToWorldV291(upperComb.centre);
      let state = createPedestrianState(env, { x: origin[0], z: origin[2], yaw: 0, groundYHint: origin[1], preserveHorizontalPosition: true });
      expect(pedestrianPointIsBlocked(state.x, state.z, state.groundY, env.obstacles, env), flight.id).toBeFalse();
      state = walk(state, flight.from, env, analog);
      state = walk(state, flight.to, env, analog);
      expect(state.groundY).toBeCloseTo(hbf.frame.anchorWorld[1] + flight.to[1], 4);
      state = walk(state, lowerComb.centre, env, analog);
      expect(state.groundY).toBeCloseTo(hbf.frame.anchorWorld[1] + flight.to[1], 4);
      state = walk(state, flight.to, env, analog);
      state = walk(state, flight.from, env, analog);
      state = walk(state, upperComb.centre, env, analog);
      expect(state.groundY).toBeCloseTo(origin[1], 4);
    }
  });
});
