import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import type { Object3D } from "three";
import { createCityWestDetails } from "../../src/CityWestDetails";
import receipt from "../fixtures/city-west-fountain-v281-source-replay.json";
import { replaySourceV281 } from "./coreMaterialV281";
import { disposeStaticAudit, staticGeometryAudit } from "./staticGeometryAudit";

/** Both controls execute the unchanged original CityWest recipe. The exact
 * source inverse freezes that fact; actual current bytes outside the one new
 * fountain must equal the omit control. The caller then checks the entire
 * legacy control against its still-frozen historical hash and budget. Thus
 * equality is transitive over every current unrelated geometry/material byte. */
export function auditCityWestBeforeV281(root: Object3D, profile: "full" | "mobile" = "full", includeUrania = true) {
  replaySourceV281(readFileSync(new URL("../../src/CityWestDetails.ts", import.meta.url), "utf8"), receipt);
  const fountain = root.getObjectByName("Weltkugelbrunnen v281")!;
  expect(fountain).toBeDefined();
  const parent = fountain.parent!, index = parent.children.indexOf(fountain);
  expect(parent.name).toBe("Gedächtniskirche and Breitscheidplatz ensemble");
  const before = staticGeometryAudit(root), omitted = createCityWestDetails(profile, includeUrania, "omit");
  try {
    fountain.removeFromParent();
    expect(staticGeometryAudit(root)).toEqual(staticGeometryAudit(omitted));
  } finally {
    parent.children.splice(index, 0, fountain); fountain.parent = parent;
    disposeStaticAudit(omitted);
  }
  expect(staticGeometryAudit(root)).toEqual(before);
  const legacy = createCityWestDetails(profile, includeUrania, "legacy");
  try { return staticGeometryAudit(legacy); } finally { disposeStaticAudit(legacy); }
}
