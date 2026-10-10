import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import { outlineAdditionsV210, restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import released from "./fixtures/outline-landmarks-v209-synchronous.json";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: v210 preserves the entire v109 outline except exact 10/100 civic rows and one church cornice`, () => {
  const root = createOutlineLandmarksV182(mode);
  const children = [...root.children];
  const cleanup = restoreOutlineEstimatesV210(root, mode);
  try {
    const names = new Set(outlineAdditionsV210(mode));
    const added = children.filter(c => names.has(c.name));
    expect(added.map(c => c.name).sort()).toEqual([...names].sort());
    root.children = children.filter(c => !names.has(c.name));
    expect(outlineSignature(root)).toEqual(released[mode]);
  } finally { root.children = children; cleanup(); disposeOutlineConstruction(root); }
});
