import { expect, test } from "bun:test";
import { createCityWestDetails } from "../src/CityWestDetails";
import { createUraniaLuetzowV188 } from "../src/UraniaLuetzowV188";
import { createUraniaArcV206 } from "../src/UraniaArcV206";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import baseline from "./fixtures/geometry-v205-preservation-v206.json";
import released from "./fixtures/outline-landmarks-v205-synchronous.json";
import { geometryPreservationV206, outlineUraniaSubstitutionKeysV206 } from "./helpers/geometryPreservationV206";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("v206 preservation starts from both unchanged v205 full signatures", () => {
  for (const mode of ["day", "minecraft"] as const) {
    const before = baseline[mode];
    expect(before.commit).toBe("8838ad4862941a6e09d8180066e1a68330029f06");
    expect(before.outline.signature).toEqual(released[mode]);
    expect(before.outline.records.length).toBe(released[mode].objects);
    expect(before.outline.records.reduce((sum, record) => sum + record.bytes, 0)).toBe(released[mode].bytes);
  }
});

test("Urania opt-out retains every other City West object and the original proxy recipe", () => {
  const old = baseline.day.cityWest.records;
  const prefix = '["Group","City West and Urania recognition details"]/["Group","Urania mirrored entrance ensemble"]:0';
  const excluded = old.filter(record => record.key === prefix || record.key.startsWith(`${prefix}/`));
  expect(excluded.map(record => record.key.slice(prefix.length))).toEqual([
    "", '/["Mesh","Urania mirrored entrance ensemble bodies"]:0',
    '/["Mesh","Urania mirrored entrance ensemble lamps"]:0',
    '/["LineSegments","Urania mirrored entrance ensemble ink lines"]:0',
  ]);
  expect(excluded.reduce((sum, record) => sum + record.bytes, 0)).toBe(13_392);
  const retained = old.filter(record => !excluded.includes(record));
  for (const profile of ["full", "mobile"] as const) {
    const legacy = createCityWestDetails(profile), active = createCityWestDetails(profile, false);
    try {
      expect(geometryPreservationV206(legacy)).toEqual(old);
      expect(geometryPreservationV206(active)).toEqual(retained);
    } finally { disposeStaticAudit(legacy); disposeStaticAudit(active); }
  }
});

test("Urania opt-out preserves every Luetzowplatz byte in both modes and keeps the historical roof available", () => {
  const outerPrefix = '["Group","Berlin outline landmark additions v182"]/';
  const sitePrefix = '["Group","Urania and Luetzowplatz source refinements v188"]';
  for (const mode of ["day", "minecraft"] as const) {
    const old = baseline[mode].outline.records
      .filter(record => record.key.startsWith(`${outerPrefix}${sitePrefix}:0`))
      .map(record => ({ ...record, key: record.key.replace(`${outerPrefix}${sitePrefix}:0`, sitePrefix) }));
    const allowed = new Set([
      `${sitePrefix}/["Mesh","Urania measured upper walls, mirror joints and yellow sign"]:0`,
      ...(mode === "day" ? [`${sitePrefix}/["Mesh","Urania exact higher official roof ring"]:0`] : []),
    ]);
    expect(old.filter(record => allowed.has(record.key))).toHaveLength(mode === "day" ? 2 : 1);
    const legacy = createUraniaLuetzowV188(mode === "minecraft");
    const active = createUraniaLuetzowV188(mode === "minecraft", false);
    try {
      expect(geometryPreservationV206(legacy)).toEqual(old);
      expect(geometryPreservationV206(active)).toEqual(old.filter(record => !allowed.has(record.key)));
    } finally { disposeStaticAudit(legacy); disposeStaticAudit(active); }
  }
});

test("the migrated Urania roof retains its complete immutable v205 render-buffer digest", () => {
  const name = "Urania exact higher official roof ring";
  const old = baseline.day.outline.records.find(record => record.key.endsWith(`/["Mesh","${name}"]:0`))!;
  expect(old.bytes).toBe(318);
  const root = createUraniaArcV206();
  try {
    const roofs: import("three").Object3D[] = [];
    root.traverse(object => { if (object.name === name) roofs.push(object); });
    expect(roofs).toHaveLength(1);
    const next = geometryPreservationV206(roofs[0])[0];
    expect({ sha256: next.sha256, bytes: next.bytes }).toEqual({ sha256: old.sha256, bytes: old.bytes });
  } finally { disposeStaticAudit(root); }
});

for (const mode of ["day", "minecraft"] as const) test(`${mode} integrated v206 retains every other complete v205 Outline object`, () => {
  const root = createOutlineLandmarksV182(mode);
  try {
    const before = baseline[mode].outline.records;
    const retired = new Set(outlineUraniaSubstitutionKeysV206(mode));
    const next = geometryPreservationV206(root), currentKeys = new Set(next.map(record => record.key));
    expect(before.filter(record => retired.has(record.key))).toHaveLength(mode === "day" ? 2 : 1);
    for (const key of retired) expect(currentKeys.has(key)).toBeFalse();
    const retained = before.filter(record => !retired.has(record.key));
    const retainedKeys = new Set(retained.map(record => record.key));
    expect(next.filter(record => retainedKeys.has(record.key))).toEqual(retained);
    // Additions have their own source/geometry tests and full synchronous
    // signature; the preservation test must not count them as old geometry.
    expect(next.length).toBeGreaterThan(before.length);
  } finally { disposeOutlineConstruction(root); }
});
