import { outlineAdditionsV210, restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import released from "./fixtures/outline-landmarks-v208-synchronous.json";
import receipt from "./fixtures/outline-historical-gallery-v222.json";
import { projectPostV210OutlineForTest } from "./helpers/outlineGalleryPreservationV222";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: v208 outlines survive v209 with the independently receipted gallery successor`, () => {
  const root = createOutlineLandmarksV182(mode);
  const restoreLater = projectPostV210OutlineForTest(root, mode);
  const cleanupV210 = restoreOutlineEstimatesV210(root, mode);
  try {
    const names = new Set([
      "Tegel and two distinct Stasi memorial sites v209 exterior details" + (mode === "minecraft" ? " native" : ""),
      "Helmholtzplatz community and cafe facades v209" + (mode === "minecraft" ? " native" : ""),
      "Exact Orankesee shore and mapped public lido fittings v209",
    ]);
    for (const name of outlineAdditionsV210(mode)) names.add(name);
    const original = [...root.children];
    const added = original.filter(child => names.has(child.name));
    expect(added.map(child => child.name).sort()).toEqual([...names].sort());
    expect(original.length).toBe(released[mode].families + names.size);
    root.children = original.filter(child => !added.includes(child));
    // The immutable v121 control with only the pre-v217 gallery factory
    // reproduces the original v208 hash. Its accepted gallery successor is
    // independently captured, and pinned in full by the helper above.
    expect(receipt.historical[mode].v208).toEqual(released[mode]);
    try { expect(outlineSignature(root)).toEqual(receipt.current[mode].v208); }
    finally { root.children = original; }
  } finally { cleanupV210(); restoreLater(); disposeOutlineConstruction(root); }
});
