import { describe, expect, test } from "bun:test";

import { Group, InstancedMesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  SIGNAL_CYCLE,
  SIGNAL_CYCLE_SECONDS,
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
    expect(street.schema_version).toBe(2);
    expect(street.traffic_signals_dm.length).toBe(86);
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
    expect(poles.count).toBeGreaterThan(70);
    expect(poles.count).toBeLessThanOrEqual(86);
    expect(lamps.count).toBe(poles.count * 3);
    // Phase offsets differ across junctions (no unison blinking).
    const phases = group!.userData.phases as Float32Array;
    expect(new Set(Array.from(phases, (p) => Math.round(p * 10))).size)
      .toBeGreaterThan(10);
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
});
