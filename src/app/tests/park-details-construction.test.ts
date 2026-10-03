import { expect, test } from "bun:test";
import type { Group } from "three";
import parkDetailsJson from "../public/mesh/regierungsviertel/park-details.json";
import {
  createParkDetails, createParkDetailsCooperative, type ParkDetailsPayload,
} from "../src/ParkDetails";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const payload = parkDetailsJson as unknown as ParkDetailsPayload;
const options = { detailProfile: "mobile" as const, settledDetail: false };

test.each([
  { detailProfile: "mobile" as const, settledDetail: false },
  { detailProfile: "full" as const, settledDetail: true },
])("cooperative $detailProfile park construction preserves every production buffer and material", async (options) => {
  let expected;
  let metadata;
  {
    const reference = createParkDetails(payload, options);
    expected = staticGeometryAudit(reference);
    metadata = { ...reference.userData };
    disposeStaticAudit(reference);
  }
  Bun.gc(true);
  let tasks = 0;
  let unpublished: Group | undefined;
  const actual = await createParkDetailsCooperative(payload, options, {
    budgetMs: 0,
    yieldTask: async () => { tasks += 1; },
    isCancelled: () => false,
    onRoot: (root) => { unpublished = root; },
  });
  expect(actual).toBe(unpublished);
  expect(actual.parent).toBeNull();
  expect(tasks).toBeGreaterThan(100);
  expect(staticGeometryAudit(actual)).toEqual(expected);
  expect(actual.userData).toEqual(metadata);
  disposeStaticAudit(actual);
});

test("cancelling before mobile park construction allocates no scene", async () => {
  let allocated = false;
  await expect(createParkDetailsCooperative(payload, options, {
    yieldTask: async () => {},
    isCancelled: () => true,
    onRoot: () => { allocated = true; },
  })).rejects.toMatchObject({ name: "AbortError" });
  expect(allocated).toBe(false);
});

test("cancelling a partial park leaves its unpublished resources with the caller", async () => {
  let unpublished: Group | undefined;
  let cancelled = false;
  let tasks = 0;
  await expect(createParkDetailsCooperative(payload, options, {
    budgetMs: 0,
    yieldTask: async () => {
      tasks += 1;
      if (unpublished?.children.length) cancelled = true;
    },
    isCancelled: () => cancelled,
    onRoot: (root) => { unpublished = root; },
  })).rejects.toMatchObject({ name: "AbortError" });
  expect(tasks).toBeGreaterThan(2);
  expect(unpublished).toBeDefined();
  expect(unpublished!.parent).toBeNull();
  expect(unpublished!.children.every(child => child.name.endsWith("batched path ribbons"))).toBe(true);
  expect(unpublished!.getObjectByName("OSM instanced granular tree trunks")).toBeUndefined();
  disposeStaticAudit(unpublished!);
  expect(unpublished!.children).toHaveLength(0);
});
