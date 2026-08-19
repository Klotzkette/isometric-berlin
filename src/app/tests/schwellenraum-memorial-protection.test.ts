import { describe, expect, test } from "bun:test";

import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import {
  CSD_ATTACK_MEMORIAL_OSM_KEY,
  CSD_ATTACK_MEMORIAL_PROFILE,
} from "../src/CsdAttackMemorial";
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
    // The CSD ensemble owns two disjoint quiet islands so the mapped path
    // between its tree and bench remains open.
    expect(index.shapes).toHaveLength(protectedEntries.length + 1);
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

  test("protects the complete separate CSD attack ensemble at its new OSM node", () => {
    const entry = street.monuments!.find(
      (candidate) => candidate.osm_key === CSD_ATTACK_MEMORIAL_OSM_KEY,
    )!;
    expect(entry.name).toBe(CSD_ATTACK_MEMORIAL_PROFILE.name);
    expect(entry.schwellenraum_protected).toBeTrue();
    const dedicatedIndex = createSchwellenraumMemorialProtectionIndex([entry]);
    const treeShape = schwellenraumProtectedMemorialShapeAt(
      dedicatedIndex,
      entry.x_dm / 10,
      5,
      entry.z_dm / 10,
    )!;
    expect(dedicatedIndex.shapes).toHaveLength(2);
    expect(treeShape.kind).toBe("circle");
    expect(treeShape.radiusM).toBe(
      CSD_ATTACK_MEMORIAL_PROFILE.treeProtectionRadiusM,
    );
    const [benchLocalX, benchLocalZ] =
      CSD_ATTACK_MEMORIAL_PROFILE.benchOffsetLocalM;
    const cosine = Math.cos(CSD_ATTACK_MEMORIAL_PROFILE.rotationY);
    const sine = Math.sin(CSD_ATTACK_MEMORIAL_PROFILE.rotationY);
    const benchX =
      entry.x_dm / 10 + cosine * benchLocalX + sine * benchLocalZ;
    const benchZ =
      entry.z_dm / 10 - sine * benchLocalX + cosine * benchLocalZ;
    const benchShape = schwellenraumProtectedMemorialShapeAt(
      dedicatedIndex,
      benchX,
      5,
      benchZ,
    )!;
    expect(benchShape.kind).toBe("circle");
    expect(benchShape.radiusM).toBe(
      CSD_ATTACK_MEMORIAL_PROFILE.benchProtectionRadiusM,
    );
    expect(
      schwellenraumProtectedMemorialAt(
        dedicatedIndex,
        treeShape.x + treeShape.radiusM - 0.01,
        5,
        treeShape.z,
      ),
    ).toBeTrue();
    expect(
      schwellenraumProtectedMemorialAt(
        dedicatedIndex,
        treeShape.x + treeShape.radiusM + 0.01,
        5,
        treeShape.z,
      ),
    ).toBeFalse();
    // Exact centre of the mapped 2.4 m Ahornsteig between both installations.
    expect(
      schwellenraumProtectedMemorialAt(
        dedicatedIndex,
        -112.861,
        5,
        718.105,
      ),
    ).toBeFalse();
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
