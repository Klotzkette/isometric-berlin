import { restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import { expect, spyOn, test } from "bun:test";
import { BufferGeometry, InstancedMesh, Material } from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { createOutlineLandmarksV182Steps, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { createOuterThinOutlinesSteps } from "../src/OuterThinOutlines";
import baseline from "./fixtures/outline-landmarks-v203-baseline.json";
import synchronous from "./fixtures/outline-landmarks-v220-synchronous.json";
import supportV220 from "./fixtures/outline-preservation-v220-audit.json";
import preserved from "./fixtures/outline-landmarks-v204-preserved-layout.json";
import retained from "./fixtures/outline-landmarks-v203-retained-v206.json";
import { outlineSignature, preservedOutlineSignature } from "./helpers/outlineConstructionSignature";
import { outlineUraniaSubstitutionKeysV206, retainedOutlineManifestV206 } from "./helpers/geometryPreservationV206";
import { detachNationalgalerieSculpturesV221 } from "./helpers/nationalgalerieSculpturesV221";
import { projectOutlineV226ForTest } from "./helpers/outlinePreservationV226";

// The frozen v203/v206 receipt retains the exact Urania substitution and
// bounded Ring suffix rules. The v220 pre-v217-gallery control reproduces
// that whole retained signature before deriving its two-buffer gallery
// complement. Every remaining old byte is read live below. Independent
// v119/current captures also pin every current outline node in the v207 suite.
for (const mode of ["day", "minecraft"] as const) test(`${mode} cooperative construction matches v220 synchronous and retains the exact audited old geometry`, async () => {
  let tasks = 0;
  const root = await completeCooperatively(createOutlineLandmarksV182Steps(mode), {
    budgetMs: 0, isCancelled: () => false,
    yieldTask: async () => { tasks++; await new Promise(resolve => setTimeout(resolve, 0)); },
  });
  const restoreV225 = projectOutlineV226ForTest(root, mode);
  const restoreSculptures = detachNationalgalerieSculpturesV221(root, mode === "minecraft");
  try {
    expect(tasks).toBeGreaterThanOrEqual(synchronous[mode].families);
    expect(outlineSignature(root)).toEqual(synchronous[mode]);
    expect(retained[mode].complete).toEqual(baseline[mode]);
    expect(retained[mode].substitutedKeys).toEqual(outlineUraniaSubstitutionKeysV206(mode));
    const cleanupV210 = restoreOutlineEstimatesV210(root, mode);
    try {
      const proof = supportV220.modes[mode].retention;
      // The independent pre-v217-gallery control reproduces the complete
      // frozen retained signature before deriving this exact two-buffer
      // complement. The current full gallery is pinned in the v207 suite.
      expect(proof.historicalControl).toEqual(retained[mode].retained);
      expect(proof.currentUnaffected).toEqual(proof.historicalUnaffected);
      const manifest = retainedOutlineManifestV206(preserved[mode], mode);
      const galleryName = supportV220.modes[mode].before.projected.galleryName;
      const prefix = `["Group","Berlin outline landmark additions v182"]/["Group","${galleryName}"]:0`;
      expect(proof.previouslyChangedGalleryKeys).toEqual(["stone", "glass"].map(kind =>
        `${prefix}/["Mesh","${galleryName} ${kind}"]:0`));
      const removed = new Set(proof.previouslyChangedGalleryKeys);
      expect(manifest.nodes.filter(node => removed.has(node.key))).toHaveLength(2);
      expect(preservedOutlineSignature(root, {
        ...manifest, nodes: manifest.nodes.filter(node => !removed.has(node.key)),
      })).toEqual(proof.currentUnaffected);
    }
    finally { cleanupV210(); }
  } finally { restoreSculptures(); restoreV225(); disposeOutlineConstruction(root); }
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
