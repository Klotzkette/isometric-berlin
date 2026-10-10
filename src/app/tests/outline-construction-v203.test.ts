import { expect, spyOn, test } from "bun:test";
import { BufferGeometry, InstancedMesh, Material } from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { createOutlineLandmarksV182Steps, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { createOuterThinOutlinesSteps } from "../src/OuterThinOutlines";
import baseline from "./fixtures/outline-landmarks-v203-baseline.json";
import synchronous from "./fixtures/outline-landmarks-v205-synchronous.json";
import preserved from "./fixtures/outline-landmarks-v204-preserved-layout.json";
import { outlineSignature, preservedOutlineSignature } from "./helpers/outlineConstructionSignature";

// A read-only cca429f constructor capture exactly reproduced the unchanged
// v203 fixture. Its layout contains no substitute geometry: this test hashes
// every old byte directly from the new tree, trimming only appended Ring
// matrix/color suffixes. New v205 geometry also matches independent synchronous
// captures from scripts/audit-outline-v205-baselines.ts.
for (const mode of ["day", "minecraft"] as const) test(`${mode} cooperative construction matches v205 synchronous and retains every old render-buffer byte and transform`, async () => {
  let tasks = 0;
  const root = await completeCooperatively(createOutlineLandmarksV182Steps(mode), {
    budgetMs: 0, isCancelled: () => false,
    yieldTask: async () => { tasks++; await new Promise(resolve => setTimeout(resolve, 0)); },
  });
  try {
    expect(tasks).toBeGreaterThanOrEqual(synchronous[mode].families);
    expect(outlineSignature(root)).toEqual(synchronous[mode]);
    expect(preservedOutlineSignature(root, preserved[mode])).toEqual(baseline[mode]);
  } finally { disposeOutlineConstruction(root); }
});

test("cancelling partial outer construction disposes the map and every completed family", async () => {
  const geometry = spyOn(BufferGeometry.prototype, "dispose");
  const material = spyOn(Material.prototype, "dispose");
  const instance = spyOn(InstancedMesh.prototype, "dispose");
  let tasks = 0;
  try {
    await expect(completeCooperatively(createOuterThinOutlinesSteps("day"), {
      budgetMs: 0, isCancelled: () => tasks === 4,
      yieldTask: async () => { tasks++; },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(geometry.mock.calls.length).toBeGreaterThan(3);
    expect(material.mock.calls.length).toBeGreaterThan(3);
    expect(instance.mock.calls.length).toBeGreaterThan(0);
    expect(new Set(geometry.mock.contexts).size).toBe(geometry.mock.calls.length);
    expect(new Set(material.mock.contexts).size).toBe(material.mock.calls.length);
  } finally { geometry.mockRestore(); material.mockRestore(); instance.mockRestore(); }
});
