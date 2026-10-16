import { outlineAdditionsV210, restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import released from "./fixtures/outline-landmarks-v207-synchronous.json";
import receipt from "./fixtures/outline-historical-gallery-v222.json";
import { projectPostV210OutlineForTest } from "./helpers/outlineGalleryPreservationV222";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: v207 outlines survive v208 with the independently receipted gallery successor`, () => {
  const root = createOutlineLandmarksV182(mode);
  const restoreLater = projectPostV210OutlineForTest(root, mode);
  const cleanupV210 = restoreOutlineEstimatesV210(root, mode);
  try {
    const names = new Set([
      "Northern Linden corridor architecture v208",
      "Russian Embassy and Aeroflot architectural refinements v208",
      "BMAS campus and Quartier 206 architecture v208",
    ].map(name => name + (mode === "minecraft" ? " native" : "")));
    names.add("Tegel and two distinct Stasi memorial sites v209 exterior details" + (mode === "minecraft" ? " native" : ""));
    names.add("Helmholtzplatz community and cafe facades v209" + (mode === "minecraft" ? " native" : ""));
    names.add("Exact Orankesee shore and mapped public lido fittings v209");
    for (const name of outlineAdditionsV210(mode)) names.add(name);
    const original = [...root.children];
    const added = original.filter(child => names.has(child.name));
    expect(added.map(child => child.name).sort()).toEqual([...names].sort());
    expect(original.length).toBe(released[mode].families + names.size);
    root.children = original.filter(child => !added.includes(child));
    expect(receipt.historical[mode].v207).toEqual(released[mode]);
    try { expect(outlineSignature(root)).toEqual(receipt.current[mode].v207); }
    finally { root.children = original; }
  } finally { cleanupV210(); restoreLater(); disposeOutlineConstruction(root); }
});
