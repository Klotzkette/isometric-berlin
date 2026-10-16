import { outlineAdditionsV210, restoreOutlineEstimatesV210 } from "./helpers/outlinePreservationV210";
import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import released from "./fixtures/outline-landmarks-v206-synchronous.json";
import auditV217 from "./fixtures/outline-preservation-v217-audit.json";

for (const mode of ["day", "minecraft"] as const) test(`${mode}: v206 outlines retain all bytes outside the audited v217 gallery refinement`, () => {
  const root = createOutlineLandmarksV182(mode);
  const cleanupV210 = restoreOutlineEstimatesV210(root, mode);
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
    names.add("Tegel and two distinct Stasi memorial sites v209 exterior details" + (mode === "minecraft" ? " native" : ""));
    names.add("Helmholtzplatz community and cafe facades v209" + (mode === "minecraft" ? " native" : ""));
    names.add("Exact Orankesee shore and mapped public lido fittings v209");
    for (const name of outlineAdditionsV210(mode)) names.add(name);
    // These later additions already ship in v117; they are outside the
    // immutable v206 family inventory, whose complete byte hash stays fixed.
    for (const name of [
      "Bundeswehrkrankenhaus source facade and helipad v214",
      "Litfin neighbours v215",
      "Gendarmenmarkt and BND neighbours v214",
      "WZB and Potsdamer park-side source facade accents v214",
    ]) names.add(name + (mode === "minecraft" ? " native" : ""));
    names.add("Red rescue helicopter landing at Bundeswehrkrankenhaus v214");
    const originalChildren = [...root.children];
    const added = originalChildren.filter(child => names.has(child.name));
    const saved = auditV217.modes[mode];
    expect(saved.historicalControl).toEqual(released[mode]);
    expect(added.map(child => child.name).sort()).toEqual([...names].sort());
    expect(root.children.length).toBe(released[mode].families + names.size);
    expect(added.map(child => ({ name: child.name, ...outlineSignature(child) }))).toEqual(saved.additions);
    // Exclude precisely the audited new root families only while hashing. Every
    // complete earlier node/header/attribute/instance is still read live in its
    // historical order; no old subset fixture or geometry truncation is used.
    root.children = originalChildren.filter(child => !added.includes(child));
    try {
      // The unchanged v117 release already contains Cattelan and the gallery's
      // represented door/stair openings (docs/cattelan-v217.md). An independent
      // v117 control using only the pre-v217 gallery factory reproduces the
      // immutable v206 signature above. Pin both the complete current tree and
      // every unrelated historical byte; the gallery itself is never untested.
      expect(outlineSignature(root)).toEqual(saved.complete);
      const galleries = root.children.filter(child => child.name === saved.galleryName);
      expect(galleries).toHaveLength(1);
      expect(outlineSignature(galleries[0])).toEqual(saved.gallery);
      root.children = root.children.filter(child => child !== galleries[0]);
      expect(outlineSignature(root)).toEqual(saved.unaffected);
    }
    finally { root.children = originalChildren; }
  } finally { cleanupV210(); disposeOutlineConstruction(root); }
});
