import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import released from "./fixtures/outline-landmarks-v206-synchronous.json";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: both v207 additions retain every complete v206 outline byte`, () => {
  const root = createOutlineLandmarksV182(mode);
  try {
    const names = new Set([
      "Charité Bettenhochhaus facade and rooftop identity v207",
      "Kapelle-Ufer ministry green architecture v207" + (mode === "minecraft" ? " native" : ""),
    ]);
    // v208 adds only these separately audited families. Exclude those new
    // roots as well; the full immutable v206 byte manifest remains unchanged.
    for (const name of [
      "Northern Linden corridor architecture v208",
      "Russian Embassy and Aeroflot architectural refinements v208",
      "BMAS campus and Quartier 206 architecture v208",
    ]) names.add(name + (mode === "minecraft" ? " native" : ""));
    const originalChildren = [...root.children];
    const added = originalChildren.filter(child => names.has(child.name));
    expect(added.map(child => child.name).sort()).toEqual([...names].sort());
    expect(root.children.length).toBe(released[mode].families + names.size);
    // Exclude precisely the audited new root families only while hashing. Every
    // complete earlier node/header/attribute/instance is still read live in its
    // historical order; no old subset fixture or geometry truncation is used.
    root.children = originalChildren.filter(child => !added.includes(child));
    try { expect(outlineSignature(root)).toEqual(released[mode]); }
    finally { root.children = originalChildren; }
  } finally { disposeOutlineConstruction(root); }
});
