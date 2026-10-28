import { describe, expect, test } from "bun:test";
import {
  advanceZooAnimalClockV282, createZooAnimalClockV282, prepareZooAnimalRouteV282,
  sampleZooAnimalPoseV282, ZOO_ANIMAL_MAX_BOB_M_V282,
  type ZooAnimalPoseV282, type ZooAnimalRouteDefinitionV282,
} from "../src/zooAnimalMotionV282";

const definition = (patch: Partial<ZooAnimalRouteDefinitionV282> = {}): ZooAnimalRouteDefinitionV282 => ({
  animalId: "wolf-1", siteId: "zoo-west", routeXZ: [[0, 0], [4, 0], [4, 2], [0, 2]],
  speed: 1, phase: 0, groundY: 5.32, ...patch,
});
const pose = (): ZooAnimalPoseV282 => ({ x: 0, y: 0, z: 0, quarterTurn: 0, gait: 0 });

describe("bounded zoo animal pose shared across drawn and native modes", () => {
  test("follows the complete metre route at its declared speed with cardinal corner turns", () => {
    const animal = prepareZooAnimalRouteV282(definition()), out = pose();
    const checkpoints = [[0, 0, 0, 0], [1, 1, 0, 0], [4, 4, 0, 3], [5, 4, 1, 3],
      [6, 4, 2, 2], [9, 1, 2, 2], [10, 0, 2, 1], [11, 0, 1, 1], [12, 0, 0, 0]];
    for (const [time, x, z, turn] of checkpoints) {
      expect(sampleZooAnimalPoseV282(animal, time, out)).toBe(out);
      expect(out.x).toBeCloseTo(x, 12); expect(out.z).toBeCloseTo(z, 12);
      expect(out.quarterTurn).toBe(turn);
    }
    const faster = prepareZooAnimalRouteV282(definition({ speed: 2 }));
    for (let time = 0; time < 24; time += 0.125) {
      expect(sampleZooAnimalPoseV282(faster, time, pose())).toEqual(
        sampleZooAnimalPoseV282(animal, time * 2, pose()));
    }
  });

  test("one complete circuit closes position, heading and gait; ground bob stays within four centimetres", () => {
    const animal = prepareZooAnimalRouteV282(definition()), out = pose();
    for (let tick = 0; tick <= 2400; tick++) {
      sampleZooAnimalPoseV282(animal, tick / 100, out);
      expect(out.x).toBeGreaterThanOrEqual(0); expect(out.x).toBeLessThanOrEqual(4);
      expect(out.z).toBeGreaterThanOrEqual(0); expect(out.z).toBeLessThanOrEqual(2);
      expect(out.y).toBeGreaterThanOrEqual(animal.groundY);
      expect(out.y).toBeLessThanOrEqual(animal.groundY + ZOO_ANIMAL_MAX_BOB_M_V282);
      expect(Math.abs(out.gait)).toBeLessThanOrEqual(1);
      expect([0, 1, 2, 3]).toContain(out.quarterTurn);
    }
    expect(sampleZooAnimalPoseV282(animal, 0, pose())).toEqual(
      sampleZooAnimalPoseV282(animal, animal.periodSeconds, pose()));
    const pacing = prepareZooAnimalRouteV282(definition({ routeXZ: [[1, 2], [1, -2]] }));
    expect(sampleZooAnimalPoseV282(pacing, 0, pose()).quarterTurn).toBe(1);
    expect(sampleZooAnimalPoseV282(pacing, 4, pose()).quarterTurn).toBe(3);
    expect(sampleZooAnimalPoseV282(pacing, 8, pose()).z).toBe(2);
  });

  test("phase normalization and immutable copies protect source routes from later mutation", () => {
    const points: [number, number][] = [[100, 200], [104, 200], [104, 202], [100, 202]];
    const original = definition({ routeXZ: points, phase: -0.75 });
    const prepared = prepareZooAnimalRouteV282(original);
    points[0][0] = -999;
    points.push([0, 0]);
    expect(prepared.routeXZ).toEqual([[100, 200], [104, 200], [104, 202], [100, 202]]);
    expect(prepared.phase).toBe(0.25);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.routeXZ)).toBe(true);
    expect(Object.isFrozen(prepared.routeXZ[0])).toBe(true);
    expect(Object.isFrozen(prepared.segments)).toBe(true);
    expect(sampleZooAnimalPoseV282(prepared, 0, pose()).x).toBe(103);
    const wrapped = prepareZooAnimalRouteV282(definition({ phase: 100.25 }));
    expect(sampleZooAnimalPoseV282(wrapped, 2, pose())).toEqual(
      sampleZooAnimalPoseV282(prepareZooAnimalRouteV282(definition({ phase: 0.25 })), 2, pose()));
  });

  test("shared clock has a ten-Hz paint cadence and does not double advance duplicate timestamps", () => {
    const clock = createZooAnimalClockV282();
    expect(advanceZooAnimalClockV282(clock, 0, true)).toBe(true);
    for (let timestamp = 10; timestamp < 100; timestamp += 10)
      expect(advanceZooAnimalClockV282(clock, timestamp, true)).toBe(false);
    expect(advanceZooAnimalClockV282(clock, 100, true)).toBe(true);
    expect(clock.elapsedSeconds).toBeCloseTo(0.1, 14);
    expect(advanceZooAnimalClockV282(clock, 100, true)).toBe(false);
    expect(clock.elapsedSeconds).toBeCloseTo(0.1, 14);
    expect(advanceZooAnimalClockV282(clock, 199, true)).toBe(false);
    expect(advanceZooAnimalClockV282(clock, 200, true)).toBe(true);
    expect(clock.elapsedSeconds).toBeCloseTo(0.2, 14);
  });

  test("hidden/reduced-motion/offscreen freezes preserve pose and resume without catching up", () => {
    const clock = createZooAnimalClockV282(), animal = prepareZooAnimalRouteV282(definition({ phase: 0.4 }));
    advanceZooAnimalClockV282(clock, 50, true);
    advanceZooAnimalClockV282(clock, 150, true);
    const previous = sampleZooAnimalPoseV282(animal, clock.elapsedSeconds, pose());
    for (const timestamp of [170, 200, 20_000, 60_000])
      expect(advanceZooAnimalClockV282(clock, timestamp, false)).toBe(false);
    expect(sampleZooAnimalPoseV282(animal, clock.elapsedSeconds, pose())).toEqual(previous);
    expect(advanceZooAnimalClockV282(clock, 100_000, true)).toBe(true);
    expect(sampleZooAnimalPoseV282(animal, clock.elapsedSeconds, pose())).toEqual(previous);
    advanceZooAnimalClockV282(clock, 100_100, true);
    expect(clock.elapsedSeconds).toBeCloseTo(0.2, 14);
  });

  test("timestamp gaps, invalid times and a restarted clock cannot teleport or stall animals", () => {
    const clock = createZooAnimalClockV282();
    advanceZooAnimalClockV282(clock, 0, true);
    advanceZooAnimalClockV282(clock, 1_000_000, true);
    expect(clock.elapsedSeconds).toBe(0.1);
    expect(advanceZooAnimalClockV282(clock, 0, true)).toBe(false);
    expect(clock.elapsedSeconds).toBe(0.1);
    expect(advanceZooAnimalClockV282(clock, 100, true)).toBe(true);
    expect(clock.elapsedSeconds).toBe(0.2);
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(advanceZooAnimalClockV282(clock, bad, true)).toBe(false);
      expect(advanceZooAnimalClockV282(clock, 1_000_000, true)).toBe(true);
      expect(clock.elapsedSeconds).toBe(0.2);
    }
  });

  test("mode-family changes sample the identical shared state without resetting it", () => {
    const animal = prepareZooAnimalRouteV282(definition({ phase: 0.2 }));
    const clock = createZooAnimalClockV282();
    advanceZooAnimalClockV282(clock, 0, true);
    for (let t = 100; t <= 1300; t += 100) advanceZooAnimalClockV282(clock, t, true);
    const expected = sampleZooAnimalPoseV282(animal, clock.elapsedSeconds, pose());
    // Material/mode changes supply the same route and clock; neither is owned
    // by an individual drawn/native root that may be hidden or reconstructed.
    for (const _mode of ["day", "night", "snowstorm", "minecraft", "flood", "schwellenraum", "day"])
      expect(sampleZooAnimalPoseV282(animal, clock.elapsedSeconds, pose())).toEqual(expected);
    const large = sampleZooAnimalPoseV282(animal, Number.MAX_VALUE, pose());
    expect([large.x, large.y, large.z, large.gait].every(Number.isFinite)).toBe(true);
    expect(large.x).toBeGreaterThanOrEqual(0); expect(large.x).toBeLessThanOrEqual(4);
    for (const invalid of [-1, NaN, Infinity])
      expect(() => sampleZooAnimalPoseV282(animal, invalid, pose())).toThrow();
  });

  test("invalid identities, speeds and noncardinal, zero or nonfinite routes are rejected before animation", () => {
    const invalid: Partial<ZooAnimalRouteDefinitionV282>[] = [
      { animalId: "" }, { siteId: "  " }, { speed: 0 }, { speed: -1 }, { speed: Infinity },
      { phase: NaN }, { groundY: Infinity }, { routeXZ: [] }, { routeXZ: [[1, 1]] },
      { routeXZ: [[0, 0], [0, 0]] }, { routeXZ: [[0, 0], [1, 1]] },
      { routeXZ: [[0, 0], [2, 0], [2, 2]] }, // Diagonal implicit closure.
      { routeXZ: [[0, 0], [1, 0], [0, 0]] }, // Repeated closing point.
      { routeXZ: [[0, 0], [NaN, 0]] }, { routeXZ: [[0, 0], [Infinity, 0]] },
      { routeXZ: [[-Number.MAX_VALUE, 0], [Number.MAX_VALUE, 0]] },
      { speed: Number.MIN_VALUE },
    ];
    for (const patch of invalid) expect(() => prepareZooAnimalRouteV282(definition(patch))).toThrow();
    expect(() => prepareZooAnimalRouteV282(definition({
      routeXZ: Array.from({ length: 65 }, (_, i) => [i % 2, 0] as const),
    }))).toThrow();
  });
});
