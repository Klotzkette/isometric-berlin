import { describe, expect, test } from "bun:test";

import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import {
  SCHWELLENRAUM_MEMORIAL_GRID_CELL_M,
  createSchwellenraumMemorialProtectionIndex,
  schwellenraumProtectedMemorialAt,
  schwellenraumProtectedMemorialClearanceM,
  schwellenraumProtectedMemorialShapeAt,
} from "../src/schwellenraumMemorialProtection";

const street = streetDetails as unknown as StreetDetailsPayload;

describe("data-driven Schwellenraum memorial protection", () => {
  const index = createSchwellenraumMemorialProtectionIndex(street.monuments);

  test("indexes every source-flagged record by stable OSM key", () => {
    const protectedEntries = street.monuments!.filter(
      (entry) => entry.schwellenraum_protected,
    );
    expect(index.cellSizeM).toBe(SCHWELLENRAUM_MEMORIAL_GRID_CELL_M);
    expect(index.protectedEntryCount).toBe(protectedEntries.length);
    expect(index.shapes).toHaveLength(protectedEntries.length);
    expect(index.protectedEntryCount).toBeGreaterThan(1_400);
    expect(index.sourceKeys.size).toBe(index.protectedEntryCount);
    for (const entry of protectedEntries) {
      expect(index.sourceKeys.has(entry.osm_key), entry.osm_key).toBeTrue();
      expect(
        schwellenraumProtectedMemorialAt(
          index,
          entry.x_dm / 10,
          5,
          entry.z_dm / 10,
        ),
        entry.osm_key,
      ).toBeTrue();
    }
  });

  test("reports exact horizontal clearance for presentation safety", () => {
    const entry = street.monuments!.find(
      (candidate) => candidate.schwellenraum_protected,
    )!;
    const x = entry.x_dm / 10;
    const z = entry.z_dm / 10;
    expect(schwellenraumProtectedMemorialClearanceM(index, x, z)).toBe(0);
    expect(
      schwellenraumProtectedMemorialClearanceM(index, -10_000, -10_000),
    ).toBeGreaterThan(1_000);
  });

  test("keeps Stolpersteine and audited violence memorials in the same contract", () => {
    const byName = (name: string) =>
      street.monuments!.find((entry) => entry.name === name)!;
    for (const name of [
      "Martha Gabali",
      "Mutter mit totem Sohn",
      "Nie wieder Krieg",
      "Klanginstallation Klopfzeichen",
      "Panoptikum",
      "Todes Mauer Bruch",
    ]) {
      const entry = byName(name);
      expect(entry.schwellenraum_protected, name).toBeTrue();
      expect(index.sourceKeys.has(entry.osm_key), name).toBeTrue();
    }
  });

  test("uses bounded point and area shapes without blocking the deep tunnel layer", () => {
    const stolperstein = street.monuments!.find(
      (entry) => entry.memorial_type === "stolperstein",
    )!;
    const x = stolperstein.x_dm / 10;
    const z = stolperstein.z_dm / 10;
    const shape = schwellenraumProtectedMemorialShapeAt(index, x, 5, z)!;
    expect(shape.kind).toBe("circle");
    expect(shape.radiusM).toBe(0.75);
    expect(schwellenraumProtectedMemorialAt(index, x, -8, z)).toBeFalse();

    const field = street.monuments!.find((entry) =>
      entry.name.includes("ermordeten Juden Europas"),
    )!;
    const fieldShape = schwellenraumProtectedMemorialShapeAt(
      index,
      field.x_dm / 10,
      5,
      field.z_dm / 10,
    )!;
    expect(fieldShape.kind).toBe("box");
    expect(fieldShape.halfWidthM).toBeGreaterThan(80);
    expect(fieldShape.halfDepthM).toBeGreaterThan(45);
  });

  test("does not turn ordinary public art into a protection volume", () => {
    const knut = street.monuments!.find((entry) => entry.name === "Knut")!;
    expect(knut.schwellenraum_protected).toBeFalse();
    expect(index.sourceKeys.has(knut.osm_key)).toBeFalse();
  });

  test("rejects duplicate protected source ids before navigation starts", () => {
    const entry = street.monuments!.find(
      (candidate) => candidate.schwellenraum_protected,
    )!;
    expect(() =>
      createSchwellenraumMemorialProtectionIndex([entry, entry]),
    ).toThrow("Duplicate or missing protected OSM key");
  });
});
