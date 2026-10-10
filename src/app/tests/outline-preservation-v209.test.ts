import { outlineAdditionsV210, restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import released from "./fixtures/outline-landmarks-v208-synchronous.json";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: every complete v208 outline byte survives the three v209 additions`, () => {
  const root = createOutlineLandmarksV182(mode);
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
    try { expect(outlineSignature(root)).toEqual(released[mode]); }
    finally { root.children = original; }
  } finally { cleanupV210(); disposeOutlineConstruction(root); }
});
