import { expect, test } from "bun:test";
import type { Group } from "three";
import parkDetailsJson from "../public/mesh/regierungsviertel/park-details.json";
import {
  createParkDetails,
  createParkDetailsCooperative,
  type ParkDetailsPayload,
  type ParkPathTerrainAt,
} from "../src/ParkDetails";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const pathPayload: ParkDetailsPayload = {
  ...(parkDetailsJson as unknown as ParkDetailsPayload),
  trees: [], playgrounds: [], street_lights: [], wall_traces: [], hedges: [], shrub_patches: [],
};
const terrainAt: ParkPathTerrainAt = (path, x, z, y) =>
  y + (path.kind === "steps" ? 0 : (x + 2 * z) / 1e5);

// Captured before introducing path construction yields. Includes every shipped
// path, all material/texture bytes, normals, UVs, indices and non-flat terrain.
const originalProductionPathAudit = {
  hash: "17c5343aaf3fbbd9255bf12fee53c9733305d20f4699fbb0d25986ce295e26d0",
  budget: { bytes: 3233924, draws: 11, instances: 0, vertices: 86200 },
};

test("synchronous and cooperative paths preserve the pre-yield production buffers", async () => {
  const synchronous = createParkDetails(pathPayload, { pathTerrainAt: terrainAt });
  expect(staticGeometryAudit(synchronous)).toEqual(originalProductionPathAudit);
  let tasks = 0;
  const cooperative = await createParkDetailsCooperative(pathPayload, { pathTerrainAt: terrainAt }, {
    budgetMs: 0,
    yieldTask: async () => { tasks += 1; },
    isCancelled: () => false,
    onRoot: () => {},
  });
  expect(tasks).toBeGreaterThan(pathPayload.paths.length);
  expect(staticGeometryAudit(cooperative)).toEqual(originalProductionPathAudit);
  expect(cooperative.children.map(child => child.name))
    .toEqual(synchronous.children.map(child => child.name));
  expect(cooperative.userData).toEqual(synchronous.userData);
  disposeStaticAudit(synchronous);
  disposeStaticAudit(cooperative);
});

test("one long ribbon can be cancelled before all terrain samples or resources are built", async () => {
  const payload: ParkDetailsPayload = {
    ...pathPayload,
    paths: [{
      id: "long-path", kind: "steps", m: "p", w: 200,
      points: Array.from({ length: 256 }, (_, index) => [index, 3, index % 9]),
    }],
  };
  let calls = 0;
  let cancelled = false;
  let unpublished: Group | undefined;
  await expect(createParkDetailsCooperative(payload, {
    pathTerrainAt: (_path, _x, _z, y) => { calls += 1; return y; },
  }, {
    budgetMs: 0,
    yieldTask: async () => { if (calls > 0) cancelled = true; },
    isCancelled: () => cancelled,
    onRoot: root => { unpublished = root; },
  })).rejects.toMatchObject({ name: "AbortError" });
  expect(calls).toBe(128); // Both ribbon edges at the first 64 points only.
  expect(unpublished).toBeDefined();
  expect(unpublished!.parent).toBeNull();
  expect(unpublished!.children).toHaveLength(0);
});

test("cooperative path sampling resumes in exact order after each task boundary", async () => {
  const payload: ParkDetailsPayload = {
    ...pathPayload,
    paths: [{
      id: "long-path", kind: "steps", m: "p", w: 200,
      points: Array.from({ length: 259 }, (_, index) => [index, 3, index % 9]),
    }],
  };
  const expected: number[][] = [];
  const reference = createParkDetails(payload, {
    pathTerrainAt: (_path, x, z, y) => { expected.push([x, z, y]); return y; },
  });
  const actual: number[][] = [];
  const checkpoints: number[] = [];
  const result = await createParkDetailsCooperative(payload, {
    pathTerrainAt: (_path, x, z, y) => { actual.push([x, z, y]); return y; },
  }, {
    budgetMs: 0,
    yieldTask: async () => { checkpoints.push(actual.length); },
    isCancelled: () => false,
    onRoot: () => {},
  });
  expect(actual).toEqual(expected);
  expect(actual).toHaveLength(518);
  expect(checkpoints).toEqual(expect.arrayContaining([128, 256, 384, 512, 518]));
  for (let index = 1; index < checkpoints.length; index += 1) {
    expect(checkpoints[index] - checkpoints[index - 1]).toBeLessThanOrEqual(128);
  }
  expect(staticGeometryAudit(result)).toEqual(staticGeometryAudit(reference));
  disposeStaticAudit(reference);
  disposeStaticAudit(result);
});
