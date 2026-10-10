import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import released from "./fixtures/outline-landmarks-v207-synchronous.json";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: every complete v207 outline byte survives the three v208 additions`, () => {
  const root = createOutlineLandmarksV182(mode);
  try {
    const names = new Set([
      "Northern Linden corridor architecture v208",
      "Russian Embassy and Aeroflot architectural refinements v208",
      "BMAS campus and Quartier 206 architecture v208",
    ].map(name => name + (mode === "minecraft" ? " native" : "")));
    names.add("Tegel and two distinct Stasi memorial sites v209 exterior details" + (mode === "minecraft" ? " native" : ""));
    names.add("Helmholtzplatz community and cafe facades v209" + (mode === "minecraft" ? " native" : ""));
    names.add("Exact Orankesee shore and mapped public lido fittings v209");
    const original = [...root.children];
    const added = original.filter(child => names.has(child.name));
    expect(added.map(child => child.name).sort()).toEqual([...names].sort());
    expect(original.length).toBe(released[mode].families + names.size);
    root.children = original.filter(child => !added.includes(child));
    try { expect(outlineSignature(root)).toEqual(released[mode]); }
    finally { root.children = original; }
  } finally { disposeOutlineConstruction(root); }
});
