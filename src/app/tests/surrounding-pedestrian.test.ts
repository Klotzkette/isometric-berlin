import { expect, test } from "bun:test";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";
import {
  createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked,
  type PedestrianExtension,
} from "../src/pedestrianNavigation";

const ground = await Bun.file(new URL(
  "../public/mesh/regierungsviertel/ground-context.json", import.meta.url,
)).json() as VoxelPayload;
const extension: PedestrianExtension = {
  bounds: { minX: -6160, maxX: 6840, minZ: -4380, maxZ: 4380 },
  groundAt: (x, z) => Math.abs(x) > 4000 || Math.abs(z) > 3800 ? 3 : null,
  solidAt: (x, y, z) => x >= 5010 && x <= 5020 && z >= 0 && z <= 10 && y < 20,
  waterAt: (x, z) => x >= 4900 && x < 4990 && z >= 0 && z < 90,
};

test("approved outer ground is ready before the first network request or mode remount", () => {
  for (const [x, z] of [[3060, -1910], [-5150, 2170], [5100, 2390], [-1450, 3730]]) {
    expect(surroundingScopeGroundAt(x, z)).toBe(3);
  }
  for (const [x, z] of [[0, 0], [-200, -800], [1500, 300], [9000, 9000]]) {
    expect(surroundingScopeGroundAt(x, z)).toBeNull();
  }
});

test("outer walking expands in every direction and retains the exact original ground", () => {
  const original = createPedestrianEnvironment(ground, { water: [] });
  const expanded = createPedestrianEnvironment(ground, { water: [] }, null, null, extension);
  expect(expanded.bounds).toEqual(extension.bounds);
  for (const [x, z] of [[-200, 300], [500, 800], [-2500, -600]]) {
    expect(expanded.groundAt(x, z)).toBe(original.groundAt(x, z));
    expect(expanded.resolveGround?.(x, z, "surface"))
      .toEqual(original.resolveGround?.(x, z, "surface"));
  }
  for (const [x, z] of [[-5000, 0], [6000, 0], [0, -4200], [0, 4200]]) {
    expect(expanded.resolveGround?.(x, z, "surface")).toEqual({
      y: 3, layer: "surface", insideTunnel: false,
    });
    const state = createPedestrianState(expanded, { x, z, yaw: 0 });
    expect(state.x).toBe(x);
    expect(state.z).toBe(z);
    expect(state.groundY).toBe(3);
  }
});

test("streamed walls and water participate in the existing safe-spawn rules", () => {
  const expanded = createPedestrianEnvironment(ground, { water: [] }, null, null, extension);
  expect(pedestrianPointIsBlocked(5015, 5, 3, undefined, expanded)).toBe(true);
  expect(pedestrianPointIsBlocked(5015, 5, 24, undefined, expanded)).toBe(false);
  expect(pedestrianPointIsBlocked(5005, 5, 3, undefined, expanded)).toBe(false);
  const spawn = createPedestrianState(expanded, { x: 4945, z: 45, yaw: 0 });
  expect(extension.waterAt(spawn.x, spawn.z)).toBe(false);
  expect(Math.hypot(spawn.x - 4945, spawn.z - 45)).toBeLessThan(170);
});
