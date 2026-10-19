import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Mesh, Raycaster, Vector3 } from "three";
import { fountainBodyBlockedV248, fountainFloorV248At } from "../src/fountainNavigationV248";
import {
  createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked,
  stepPedestrian, type PedestrianExtension,
} from "../src/pedestrianNavigation";
import { type VoxelPayload } from "../src/terrainPayload";
import nav from "../src/data/fountainNavigationV248.json";
import fountain from "../src/data/hermannEhlersFountainV248.json";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const ground: VoxelPayload = {
  schema_version: 2, cell_m: 4, classes: ["grass"], water_top_y_m: -1,
  grid: { cols: 1, rows: 1, min_x_idx: 0, min_z_idx: 0 },
  ground_height: { cols: 1, rows: 1, stride_cells: 1, y_dm: [30] }, ground_rows: [[[0, 1, 0]]],
};
const extension = (value: number | null): PedestrianExtension => ({
  bounds: { minX: -4000, maxX: -3000, minZ: 6600, maxZ: 7400 },
  groundAt: () => value, solidAt: () => false, waterAt: () => false,
});
const rim = [-3544.277616801325, 6806.62646484375];
const basin = [-3546.730440100805, 6806.62646484375];
const input = { forward: 0, strafe: 0, turn: 0, look: 0 };

for (const native of [false, true]) {
  test(`v248 ${native ? "native" : "drawn"} supports match real geometry; unchanged total budgets and mobile detail`, async () => {
    const { createMinecraftSteglitzV182, createSteglitzV182 } = await import("../src/SteglitzV182");
    const root = native ? createMinecraftSteglitzV182() : createSteglitzV182();
    root.updateMatrixWorld(true);
    const meshes: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
    const points = native
      ? nav.native.filter((_, i) => i % 3 === 0).map(([x0, z0, x1, z1]) => [(x0 + x1) / 2, (z0 + z1) / 2])
      : fountain.surfaces.filter(s => s.color === 0x9A6554).flatMap(s => s.triangles)
        .map(t => t.map(p => p.map(Math.fround)))
        .map(t => [t.reduce((n, p) => n + p[0], 0) / 3, t.reduce((n, p) => n + p[2], 0) / 3]);
    expect(points.length).toBeGreaterThan(20);
    for (const [x, z] of points) {
      const y = fountainFloorV248At(x, z, 5, native);
      expect(y).not.toBeNull();
      const hits = new Raycaster(new Vector3(x, y! + .004, z), new Vector3(0, -1, 0), 0, .008).intersectObjects(meshes, false);
      expect(hits.length, `Missing rendered support at ${x},${z},${y}`).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeCloseTo(y!, 4);
      expect(fountainBodyBlockedV248(x, z, y!, y! + 1.75, 0, native)).toBe(false);
    }
    const mobile = native ? createMinecraftSteglitzV182({ mobileLike: true }) : createSteglitzV182({ mobileLike: true });
    const audit = staticGeometryAudit(root);
    expect(staticGeometryAudit(mobile)).toEqual(audit);
    expect(audit.budget.draws).toBe(native ? 1 : 3);
    expect(audit.budget.bytes).toBeLessThanOrEqual(native ? 2_250_000 : 900_000);
    console.log("v248 complete Steglitz", native ? "native" : "drawn", audit.budget);
    disposeStaticAudit(root); disposeStaticAudit(mobile);
  });

  test(`v248 ${native ? "native" : "drawn"} low rim blocks walking without lifting ground or closing the basin`, () => {
    const environment = createPedestrianEnvironment(ground, { water: [] }, null, null, extension(3));
    environment.visualMode = () => native ? "minecraft" : "day";
    const p = native ? nav.native.find(r => r[5] > 3.6)! : null;
    const [x, z] = p ? [(p[0] + p[2]) / 2, (p[1] + p[3]) / 2] : rim;
    expect(environment.groundAt(x, z)).toBe(3);
    expect(environment.resolveGround!(x, z, "surface", 3)?.y).toBe(3);
    expect(pedestrianPointIsBlocked(x, z, 3, undefined, environment)).toBe(true);
    const high = environment.resolveGround!(x, z, "surface", 4)!.y;
    expect(high).toBeCloseTo(3.625, 5);
    expect(pedestrianPointIsBlocked(x, z, high, undefined, environment)).toBe(false);
    expect(environment.resolveGround!(x, z, "tunnel", 4)?.y).toBe(3);
    // The full body intersects the low rim although all three legacy point
    // samples (feet 3.0, middle 3.875, head 4.75) miss a 3.025..3.625 solid.
    expect(fountainBodyBlockedV248(x, z, 3, 4.75, .28, native)).toBe(true);
    expect(fountainBodyBlockedV248(basin[0], basin[1], 3.2, 4.95, .28, native)).toBe(false);
    expect(fountainFloorV248At(basin[0], basin[1], 5, native) ?? 3).toBeLessThan(3.22);
    for (const [px, pz] of [[-3570, 6800], [-3700, 7000]]) {
      expect(environment.resolveGround!(px, pz, "surface", 5)?.y).toBe(3);
      expect(pedestrianPointIsBlocked(px, pz, 3, undefined, environment)).toBe(false);
    }
    // Descent resolves the represented top before the next integration step,
    // preventing a fast fall from tunnelling through the thin cap.
    let state = createPedestrianState(environment, { x, z, yaw: 0, groundYHint: 4.5, preserveHorizontalPosition: true });
    for (let i = 0; i < 100 && !state.grounded; i++) state = stepPedestrian(state, input, .02, environment).state;
    expect(state.grounded).toBe(true);
    expect(state.groundY).toBeCloseTo(high, 5);
    expect(state.jumpOffset).toBe(0);
    let walker = createPedestrianState(environment, { x: -3541, z: rim[1], yaw: -Math.PI / 2 });
    for (let i = 0; i < 150; i++) walker = stepPedestrian(walker, { ...input, forward: 1 }, .02, environment).state;
    expect(walker.x).toBeLessThan(-3541.2);
    expect(walker.x).toBeGreaterThan(rim[0]);
    expect(walker.groundY).toBeLessThan(3.1);
    expect(pedestrianPointIsBlocked(walker.x, walker.z, walker.groundY, undefined, environment)).toBe(false);
  });
}

test("v248 respects valid outer support, existing higher floors and exact frozen source", () => {
  const [x, z] = rim;
  for (const outer of [undefined, extension(null)]) {
    const environment = createPedestrianEnvironment(ground, { water: [] }, null, null, outer);
    expect(environment.resolveGround!(x, z, "surface", 5)).toBeNull();
    expect(pedestrianPointIsBlocked(x, z, 3, undefined, environment)).toBe(false);
  }
  const higher = createPedestrianEnvironment(ground, { water: [] }, null, null, extension(4));
  expect(higher.resolveGround!(x, z, "surface", 5)?.y).toBe(4);
  expect(fountainFloorV248At(x, z, undefined)).toBeNull();
  expect(fountainFloorV248At(NaN, z, 5)).toBeNull();
  // Existing v247 paving remains outside the source ring, while the real
  // pedestrian capsule reaches its rim. No underlying paving was removed.
  const [edgeX, edgeZ] = [-3545.9549967447915, 6809.185709635417];
  expect(fountainBodyBlockedV248(edgeX, edgeZ, 3.025, 4.775, 0)).toBe(false);
  expect(fountainBodyBlockedV248(edgeX, edgeZ, 3.025, 4.775, .42)).toBe(true);
  const bytes = readFileSync(new URL("../src/data/hermannEhlersFountainV248.json", import.meta.url));
  expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(nav.sourceSha256);
  expect(readFileSync(new URL("../src/data/fountainNavigationV248.json", import.meta.url)).byteLength).toBeLessThan(40_000);
});
