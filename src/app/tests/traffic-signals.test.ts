import { describe, expect, test } from "bun:test";

import { Group, InstancedMesh, Matrix4 } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  SIGNAL_CYCLE,
  SIGNAL_CYCLE_SECONDS,
  STREET_DETAILS_FILE,
  type StreetDetailsPayload,
  createTrafficSignals,
  lampsLit,
  signalPhase,
  updateTrafficSignals,
} from "../src/TrafficSignals";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const street = streetDetails as unknown as StreetDetailsPayload;
const ground = voxelPayload as unknown as VoxelPayload;

describe("task 07: animated OSM traffic signals", () => {
  test("the payload carries every surveyed signal inside bounds", () => {
    expect(street.schema_version).toBe(7);
    expect(street.traffic_signals_dm.length).toBe(1_328);
    expect(
      new Set(street.traffic_signals_dm.map(([x, z]) => `${x}:${z}`)).size,
    ).toBe(street.traffic_signals_dm.length);
    expect(street.traffic_signal_placements).toHaveLength(1_328);
    const roles = new Map<string, number>();
    for (const placement of street.traffic_signal_placements!) {
      roles.set(placement.placement, (roles.get(placement.placement) ?? 0) + 1);
    }
    expect(Object.fromEntries(roles)).toEqual({
      relocated_verge: 1_093,
      surveyed_verge: 227,
      verified_island: 8,
    });
    expect(
      street.traffic_signal_placements!.filter(
        (entry) =>
          entry.placement === "relocated_verge" &&
          entry.source_on_carriageway === false,
      ).map((entry) => entry.osm_key),
    ).toEqual(["node/3098737953"]);
    expect(STREET_DETAILS_FILE).toBe("street-details.json?schema=7");
    expect(street.source.toLowerCase()).toContain("openstreetmap");
    // Schema v2 also carries the monuments ("alle Denkmäler").
    expect(street.monuments!.length).toBeGreaterThan(40);
  });

  test("the German phase sequence cycles red → red+amber → green → amber", () => {
    expect(signalPhase(0)).toBe(0);
    expect(signalPhase(SIGNAL_CYCLE.red + 0.5)).toBe(1);
    expect(signalPhase(SIGNAL_CYCLE.red + SIGNAL_CYCLE.redAmber + 1)).toBe(2);
    expect(signalPhase(SIGNAL_CYCLE_SECONDS - 1)).toBe(3);
    expect(signalPhase(SIGNAL_CYCLE_SECONDS + 0.25)).toBe(0);
    expect(lampsLit(0)).toEqual([true, false, false]);
    expect(lampsLit(1)).toEqual([true, true, false]);
    expect(lampsLit(2)).toEqual([false, false, true]);
    expect(lampsLit(3)).toEqual([false, true, false]);
  });

  test("every signal becomes one instanced pole + head + three lamps", () => {
    const group = createTrafficSignals(street, ground);
    expect(group).toBeInstanceOf(Group);
    const poles = group!.getObjectByName("traffic signal poles") as InstancedMesh;
    const lamps = group!.getObjectByName("traffic signal lamps") as InstancedMesh;
    const islands = group!.getObjectByName(
      "traffic signal verified island bases",
    ) as InstancedMesh;
    expect(poles.count).toBe(1_328);
    expect(lamps.count).toBe(poles.count * 3);
    expect(islands.count).toBe(8);
    expect(group!.children).toHaveLength(4);
    // Phase offsets differ across junctions (no unison blinking).
    const phases = group!.userData.phases as Float32Array;
    expect(new Set(Array.from(phases, (p) => Math.round(p * 10))).size)
      .toBeGreaterThan(10);
  });

  test("schema-7 matrices use the physical verge anchors while phases remain source-bound", () => {
    const group = createTrafficSignals(street, ground)!;
    const poles = group.getObjectByName("traffic signal poles") as InstancedMesh;
    const renderedSources = group.userData.sourceDm as Array<[number, number]>;
    const moved = street.traffic_signal_placements!.find(
      (entry) => entry.placement === "relocated_verge",
    )!;
    const index = renderedSources.findIndex(
      ([x, z]) => x === moved.source_dm[0] && z === moved.source_dm[1],
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const matrix = new Matrix4();
    poles.getMatrixAt(index, matrix);
    expect(Math.round(matrix.elements[12] * 10)).toBe(moved.position_dm[0]);
    expect(Math.round(matrix.elements[14] * 10)).toBe(moved.position_dm[1]);
    expect(moved.position_dm).not.toEqual(moved.source_dm);

    const phases = group.userData.phases as Float32Array;
    const expectedPhase =
      (Math.abs(
        Math.imul(moved.source_dm[0], 2654435761) ^
          Math.imul(moved.source_dm[1], 40503),
      ) %
        (SIGNAL_CYCLE_SECONDS * 10)) /
      10;
    expect(phases[index]).toBeCloseTo(expectedPhase, 4);
  });

  test("an old cached payload still falls back to its raw source coordinates", () => {
    const legacy = {
      ...street,
      traffic_signal_placements: undefined,
    } satisfies StreetDetailsPayload;
    const group = createTrafficSignals(legacy, ground)!;
    const poles = group.getObjectByName("traffic signal poles") as InstancedMesh;
    const renderedSources = group.userData.sourceDm as Array<[number, number]>;
    const matrix = new Matrix4();
    poles.getMatrixAt(0, matrix);
    expect(Math.round(matrix.elements[12] * 10)).toBe(renderedSources[0][0]);
    expect(Math.round(matrix.elements[14] * 10)).toBe(renderedSources[0][1]);
    expect(
      group.getObjectByName("traffic signal verified island bases"),
    ).toBeUndefined();
  });

  test("animation lights exactly one configuration per signal; reduced motion pins green", () => {
    const group = createTrafficSignals(street, ground)!;
    const lamps = group.getObjectByName("traffic signal lamps") as InstancedMesh;
    updateTrafficSignals(group, 12.5, false);
    const colors = lamps.instanceColor!.array as Float32Array;
    // Some lamp somewhere is bright (an "on" channel above 0.7).
    let bright = 0;
    for (let index = 0; index < colors.length; index += 1) {
      if (colors[index] > 0.7) {
        bright += 1;
      }
    }
    expect(bright).toBeGreaterThan(0);
    // Reduced motion: every signal shows green (lamp 2 bright green).
    updateTrafficSignals(group, 99, true);
    const phases = group.userData.phases as Float32Array;
    for (let index = 0; index < phases.length; index += 1) {
      // Colours live in linear space; 0x30d158's green lands ~0.64.
      const greenG = colors[(index * 3 + 2) * 3 + 1];
      const redR = colors[index * 3 * 3];
      expect(greenG).toBeGreaterThan(0.5);
      expect(redR).toBeLessThan(0.4);
    }
  });

  test("moonlight (lights off) dims every lamp regardless of phase, but keeps the clock running", () => {
    const group = createTrafficSignals(street, ground)!;
    const lamps = group.getObjectByName("traffic signal lamps") as InstancedMesh;
    const colors = lamps.instanceColor!.array as Float32Array;

    // Lights on first, so we know some lamp is genuinely bright beforehand.
    updateTrafficSignals(group, 12.5, false, true);
    let brightBefore = 0;
    for (let index = 0; index < colors.length; index += 1) {
      if (colors[index] > 0.7) {
        brightBefore += 1;
      }
    }
    expect(brightBefore).toBeGreaterThan(0);

    // Licht aus: every lamp of every signal must render as off, no matter
    // which phase its junction happens to be in.
    updateTrafficSignals(group, 12.5, false, false);
    for (let index = 0; index < colors.length; index += 1) {
      expect(colors[index]).toBeLessThan(0.4);
    }
  });

  test("turning the lights back on restores the exact phase the clock reached while dark", () => {
    const group = createTrafficSignals(street, ground)!;
    const lamps = group.getObjectByName("traffic signal lamps") as InstancedMesh;
    const colors = lamps.instanceColor!.array as Float32Array;

    // Establish the true phase configuration lights-on would show at t=40.
    const reference = createTrafficSignals(street, ground)!;
    const referenceLamps = reference.getObjectByName(
      "traffic signal lamps",
    ) as InstancedMesh;
    updateTrafficSignals(reference, 40, false, true);
    const referenceColors = referenceLamps.instanceColor!.array as Float32Array;

    // Same group: lights off throughout, then back on at the same timestamp.
    updateTrafficSignals(group, 12.5, false, false);
    updateTrafficSignals(group, 40, false, false);
    for (let index = 0; index < colors.length; index += 1) {
      expect(colors[index]).toBeLessThan(0.4);
    }
    updateTrafficSignals(group, 40, false, true);
    for (let index = 0; index < colors.length; index += 1) {
      expect(colors[index]).toBeCloseTo(referenceColors[index], 5);
    }
  });
});
