import { restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import { expect, spyOn, test } from "bun:test";
import { BufferGeometry, InstancedMesh, Material } from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { createOutlineLandmarksV182Steps, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { createOuterThinOutlinesSteps } from "../src/OuterThinOutlines";
import baseline from "./fixtures/outline-landmarks-v203-baseline.json";
import synchronous from "./fixtures/outline-landmarks-v210-synchronous.json";
import preserved from "./fixtures/outline-landmarks-v204-preserved-layout.json";
import retained from "./fixtures/outline-landmarks-v203-retained-v206.json";
import { outlineSignature, preservedOutlineSignature } from "./helpers/outlineConstructionSignature";
import { outlineUraniaSubstitutionKeysV206, retainedOutlineManifestV206 } from "./helpers/geometryPreservationV206";

// Immutable v205 construction reproduces the complete unchanged v203 hash,
// then derives this exact Urania-only complement. Every remaining old byte
// is read from the live tree, trimming only the v205 Ring instance suffixes.
// urania-preservation-v206 independently verifies the moved source roof and
// every complete v205 object outside that substitution. New geometry matches
// independent synchronous captures from scripts/audit-outline-v210.ts; the
// separate v207/v209 preservation suites checks every complete v206 buffer as well.
for (const mode of ["day", "minecraft"] as const) test(`${mode} cooperative construction matches v210 synchronous and retains the exact audited old geometry`, async () => {
  let tasks = 0;
  const root = await completeCooperatively(createOutlineLandmarksV182Steps(mode), {
    budgetMs: 0, isCancelled: () => false,
    yieldTask: async () => { tasks++; await new Promise(resolve => setTimeout(resolve, 0)); },
  });
  try {
    expect(tasks).toBeGreaterThanOrEqual(synchronous[mode].families);
    expect(outlineSignature(root)).toEqual(synchronous[mode]);
    expect(retained[mode].complete).toEqual(baseline[mode]);
    expect(retained[mode].substitutedKeys).toEqual(outlineUraniaSubstitutionKeysV206(mode));
    const cleanupV210 = restoreOutlineEstimatesV210(root, mode);
    try { expect(preservedOutlineSignature(root, retainedOutlineManifestV206(preserved[mode], mode)))
      .toEqual(retained[mode].retained); }
    finally { cleanupV210(); }
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
