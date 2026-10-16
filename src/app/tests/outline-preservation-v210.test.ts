import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import { outlineAdditionsV210, restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import released from "./fixtures/outline-landmarks-v209-synchronous.json";
import receipt from "./fixtures/outline-historical-gallery-v222.json";
import { projectPostV210OutlineForTest } from "./helpers/outlineGalleryPreservationV222";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: v210 preserves v209 beyond exact civic/cornice corrections and receipted gallery changes`, () => {
  const root = createOutlineLandmarksV182(mode);
  const restoreLater = projectPostV210OutlineForTest(root, mode);
  const children = [...root.children];
  const cleanup = restoreOutlineEstimatesV210(root, mode);
  try {
    const names = new Set(outlineAdditionsV210(mode));
    const added = children.filter(c => names.has(c.name));
    expect(added.map(c => c.name).sort()).toEqual([...names].sort());
    root.children = children.filter(c => !names.has(c.name));
    expect(receipt.historical[mode].v209).toEqual(released[mode]);
    expect(outlineSignature(root)).toEqual(receipt.current[mode].v209);
  } finally { root.children = children; cleanup(); restoreLater(); disposeOutlineConstruction(root); }
});
