import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Mesh, Raycaster, Vector3 } from "three";
import { createMinecraftSteglitzV182, createSteglitzV182 } from "../src/SteglitzV182";
import { createPedestrianEnvironment, pedestrianPointIsBlocked, type PedestrianExtension } from "../src/pedestrianNavigation";
import { steglitzGroundV247At } from "../src/steglitzGroundV247";
import { type VoxelPayload } from "../src/terrainPayload";
import floors from "../src/data/steglitzGroundV247.json";
import plaza from "../src/data/hermannEhlersV247Details.json";
import street from "../src/data/schlossstrasseV247Details.json";
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

for (const native of [false, true]) test(`v247 ${native ? "native" : "drawn"} navigation matches actual new rendered floor tops`, () => {
  const root = native ? createMinecraftSteglitzV182() : createSteglitzV182();
  root.updateMatrixWorld(true);
  const environment = createPedestrianEnvironment(ground, { water: [] }, null, null, extension(3));
  environment.visualMode = () => native ? "minecraft" : "day";
  const points = native
    ? floors.native.filter((_, i) => i % 7 === 0).map(([x0, z0, x1, z1]) => [(x0 + x1) / 2, (z0 + z1) / 2])
    : [...plaza.surfaces, ...street.surfaces].flatMap(s => s.triangles)
      .filter((_, i) => i % 3 === 0).map(t => t.map(p => p.map(Math.fround)))
      .filter(([a, b, c]) => Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) > 1e-8)
      .map(t => [t.reduce((n, p) => n + p[0], 0) / 3, t.reduce((n, p) => n + p[2], 0) / 3]);
  if (!native) for (const row of street.boxes) if (row[7] === 0x686D6C) points.push([row[0], row[2]]);
  const meshes: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
  expect(points.length).toBeGreaterThan(20);
  for (const [x, z] of points) {
    const y = steglitzGroundV247At(x, z, native);
    expect(y).not.toBeNull();
    expect(environment.groundAt(x, z)).toBe(y);
    // The unchanged paving point is outside the v248 fountain, but the
    // visitor's 0.42 m body radius now touches its actual new rim here.
    const besideFountain = !native && Math.abs(x + 3545.9549967447915) < 1e-6
      && Math.abs(z - 6809.185709635417) < 1e-6;
    expect(pedestrianPointIsBlocked(x, z, y!, environment.obstacles, environment)).toBe(besideFountain);
    // Start below cosmetic paint and above the actual supporting asphalt/paving.
    const ray = new Raycaster(new Vector3(x, y! + .004, z), new Vector3(0, -1, 0), 0, .008);
    const hits = ray.intersectObjects(meshes, false);
    expect(hits.length, `No actual floor at ${x},${z} -> ${y}`).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeCloseTo(y!, 3);
  }
  const mobile = native ? createMinecraftSteglitzV182({ mobileLike: true }) : createSteglitzV182({ mobileLike: true });
  const audit = staticGeometryAudit(root);
  expect(staticGeometryAudit(mobile)).toEqual(audit);
  expect(audit.budget.draws).toBe(native ? 1 : 3);
  expect(audit.budget.bytes).toBeLessThan(native ? 2_250_000 : 900_000);
  console.log("v247 complete Steglitz", native ? "native" : "drawn", audit.budget);
  disposeStaticAudit(root); disposeStaticAudit(mobile);
});

test("holes, native boundary fringe, unrelated and unsupported/higher old floors remain intact", () => {
  const environment = createPedestrianEnvironment(ground, { water: [] }, null, null, extension(3));
  for (const native of [false, true]) {
    environment.visualMode = () => native ? "minecraft" : "day";
    for (const [x, z] of [[-3547, 6806], [-3570, 6800], [0, 0], [-3700, 7000]]) {
      expect(steglitzGroundV247At(x, z, native)).toBeNull();
      expect(environment.groundAt(x, z)).toBe(3);
    }
  }
  let fringe: number[] | undefined;
  for (const s of plaza.surfaces) for (const t of s.triangles) {
    const p = [t.reduce((n, q) => n + q[0], 0) / 3, t.reduce((n, q) => n + q[2], 0) / 3];
    if (steglitzGroundV247At(p[0], p[1], true) === null) fringe = p;
  }
  expect(fringe).toBeDefined();
  environment.visualMode = () => "day";
  expect(environment.groundAt(fringe![0], fringe![1])).toBe(3.025);
  environment.visualMode = () => "minecraft";
  expect(environment.groundAt(fringe![0], fringe![1])).toBe(3);
  const point = street.boxes.find(r => r[7] === 0x686D6C)!;
  const unsupported = createPedestrianEnvironment(ground, { water: [] }, null, null, extension(null));
  expect(unsupported.groundAt(point[0], point[2])).toBeNull();
  const higher = createPedestrianEnvironment(ground, { water: [] }, null, null, extension(4));
  expect(higher.groundAt(point[0], point[2])).toBe(4);
  expect(steglitzGroundV247At(Number.NaN, 6800)).toBeNull();
});

test("tiny floor data are bound to the exact current rendered source recipes", () => {
  for (const [name, expected] of Object.entries(floors.sourceSha256)) {
    const bytes = readFileSync(new URL(`../src/data/${name}`, import.meta.url));
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(expected);
  }
  expect(readFileSync(new URL("../src/data/steglitzGroundV247.json", import.meta.url)).byteLength).toBeLessThan(20_000);
  expect(floors.native.length).toBeLessThan(220);
  expect(floors.drawn.length).toBeLessThan(12);
});
