import { describe, expect, test } from "bun:test";
import { FrontSide, Mesh, type Object3D } from "three";

import {
  SCHWELLENRAUM_ACCESSIBLE_VOLUMES,
  SCHWELLENRAUM_INTERIOR_SOLIDS,
  SCHWELLENRAUM_PROTECTED_NAMES,
  SCHWELLENRAUM_PROTECTED_VOLUMES,
  createSchwellenraumInteriors,
  isSchwellenraumProtectedObjectName,
  schwellenraumAccessibleVolumeAt,
  schwellenraumInteriorAt,
  schwellenraumInteriorGroundAt,
  schwellenraumInteriorSolidAt,
  schwellenraumNavigationOverrideAt,
  schwellenraumProtectedAt,
  schwellenraumProtectedVolumeAt,
  setSchwellenraumInteriorsPresentation,
} from "../src/SchwellenraumInteriors";
import { MOABIT_PRISON_PARK_SOURCE_PROFILE } from "../src/MoabitPrisonMemorialPark";

function descendants(root: Object3D, predicate: (object: Object3D) => boolean) {
  const matches: Object3D[] = [];
  root.traverse((object) => {
    if (predicate(object)) matches.push(object);
  });
  return matches;
}

describe("Schwellenraum accessible architecture", () => {
  test("starts hidden and exposes one stable presentation switch", () => {
    const root = createSchwellenraumInteriors();
    expect(root.visible).toBeFalse();
    expect(root.children).toHaveLength(5);
    expect(root.userData.presentationEnabled).toBeFalse();
    expect(root.userData.geometryStatus).toContain("not surveyed geometry");

    setSchwellenraumInteriorsPresentation(root, true);
    expect(root.visible).toBeTrue();
    expect(root.userData.presentationEnabled).toBeTrue();
    setSchwellenraumInteriorsPresentation(root, false);
    expect(root.visible).toBeFalse();
  });

  test("builds the requested portals, halls, cellar and clinic corridor", () => {
    const root = createSchwellenraumInteriors();
    for (const name of [
      "Reichstag open west portal",
      "Reichstag plenary chamber floor",
      "Hauptbahnhof deep escalator -12:-1",
      "Chancellery open leadership portal",
      "Potsdamer cellar concourse floor",
      "Charite open entrance gate",
    ]) {
      expect(root.getObjectByName(name)).not.toBeNull();
    }
    expect(
      descendants(root, (object) =>
        object.name.startsWith("Reichstag plenary seating arc"),
      ),
    ).toHaveLength(7);
  });

  test("masks only the outward view of a portal and keeps the mask non-solid", () => {
    const root = createSchwellenraumInteriors();
    const masks = descendants(
      root,
      (object) => object.userData.schwellenraumPortalMask === true,
    );
    expect(masks.length).toBeGreaterThanOrEqual(10);
    for (const object of masks) {
      expect(object).toBeInstanceOf(Mesh);
      expect((object as Mesh).material.side).toBe(FrontSide);
      expect((object as Mesh).renderOrder).toBe(30);
      expect(object.userData.schwellenraumSolid).toBeFalse();
    }
    expect(
      root.getObjectByName("Reichstag open west portal")?.userData
        .visualOpeningMaskCount,
    ).toBe(1);
  });

  test("limits LoD2 collision overrides to explicit access boxes", () => {
    const landmarks = new Set(
      SCHWELLENRAUM_ACCESSIBLE_VOLUMES.map(({ landmark }) => landmark),
    );
    expect(landmarks).toEqual(
      new Set([
        "Reichstagsgebäude",
        "Berlin Hauptbahnhof",
        "Bundeskanzleramt",
        "Bahnhof Potsdamer Platz",
        "Charité Campus Mitte",
      ]),
    );
    for (const volume of SCHWELLENRAUM_ACCESSIBLE_VOLUMES) {
      expect(
        schwellenraumAccessibleVolumeAt(...volume.centerWorldM)?.id,
      ).toBeDefined();
      expect(schwellenraumInteriorAt(...volume.centerWorldM)).toBeTrue();
      expect(volume.geometryStatus).toContain("presentation reconstruction");
    }
    expect(schwellenraumInteriorAt(0, 100, 0)).toBeFalse();

    const reichstag = SCHWELLENRAUM_ACCESSIBLE_VOLUMES.find(
      ({ id }) => id === "reichstag-west-portal",
    )!;
    expect(
      schwellenraumNavigationOverrideAt(...reichstag.centerWorldM, "K0002MCN"),
    ).toBeTrue();
    expect(
      schwellenraumNavigationOverrideAt(
        ...reichstag.centerWorldM,
        "unrelated-building",
      ),
    ).toBeFalse();
  });

  test("provides continuous metric floors for halls, ramps and sublevels", () => {
    const reichstagStair = SCHWELLENRAUM_ACCESSIBLE_VOLUMES.find(
      ({ id }) => id === "reichstag-west-stair",
    )!;
    expect(
      schwellenraumInteriorGroundAt(
        reichstagStair.centerWorldM[0],
        reichstagStair.centerWorldM[2],
        5.7,
      ),
    ).toBeCloseTo(5.695, 3);

    const deepHall = SCHWELLENRAUM_ACCESSIBLE_VOLUMES.find(
      ({ id }) => id === "hauptbahnhof-deep-platform-hall",
    )!;
    expect(
      schwellenraumInteriorGroundAt(
        deepHall.centerWorldM[0],
        deepHall.centerWorldM[2],
        -10,
      ),
    ).toBeCloseTo(-9.925, 3);
  });

  test("publishes solid jambs, walls, rails and seats without turning floors into blockers", () => {
    expect(SCHWELLENRAUM_INTERIOR_SOLIDS.length).toBeGreaterThan(60);
    const jamb = SCHWELLENRAUM_INTERIOR_SOLIDS.find(
      ({ id }) => id === "reichstag-west-portal-side--1",
    )!;
    expect(jamb.shape).toBe("box");
    if (jamb.shape !== "box") throw new Error("expected a box jamb");
    expect(schwellenraumInteriorSolidAt(...jamb.centerWorldM)).toBeTrue();

    const portal = SCHWELLENRAUM_ACCESSIBLE_VOLUMES.find(
      ({ id }) => id === "reichstag-west-portal",
    )!;
    expect(
      schwellenraumInteriorSolidAt(
        portal.centerWorldM[0],
        portal.centerWorldM[1] + 1.3,
        portal.centerWorldM[2],
      ),
    ).toBeFalse();

    const cellar = SCHWELLENRAUM_ACCESSIBLE_VOLUMES.find(
      ({ id }) => id === "potsdamer-cellar-concourse",
    )!;
    expect(
      schwellenraumInteriorSolidAt(
        cellar.centerWorldM[0],
        -3.8,
        cellar.centerWorldM[2] + 15,
      ),
    ).toBeFalse();
  });

  test("keeps every violence- and persecution-related memorial unchanged and inaccessible", () => {
    expect(SCHWELLENRAUM_PROTECTED_NAMES).toContain(
      "Denkmal für die ermordeten Juden Europas",
    );
    expect(SCHWELLENRAUM_PROTECTED_NAMES).toContain(
      "Gedenkstelle CSD-Attentat vom 25.7.2026",
    );
    expect(SCHWELLENRAUM_PROTECTED_VOLUMES.length).toBeGreaterThanOrEqual(17);
    expect(
      isSchwellenraumProtectedObjectName(
        "Holocaust Memorial 2711 instanced stelae",
      ),
    ).toBeTrue();
    expect(
      isSchwellenraumProtectedObjectName(
        "Queer Rainbow Memorial candle pool light 1",
      ),
    ).toBeTrue();
    expect(
      isSchwellenraumProtectedObjectName(
        "Gedenkstelle CSD-Attentat vom 25.7.2026",
      ),
    ).toBeTrue();
    expect(isSchwellenraumProtectedObjectName("Goethe-Denkmal")).toBeTrue();
    expect(isSchwellenraumProtectedObjectName("Lessing-Denkmal")).toBeTrue();
    expect(isSchwellenraumProtectedObjectName("Knut sculpture")).toBeFalse();

    const moabit = SCHWELLENRAUM_PROTECTED_VOLUMES.find(
      ({ id }) => id === "protected-moabit-prison-memorial-park",
    )!;
    if (moabit.shape !== "polygon") {
      throw new Error("expected the exact Moabit park polygon");
    }
    expect(moabit.ringWorldM).toBe(
      MOABIT_PRISON_PARK_SOURCE_PROFILE.parkRingWorldM,
    );
    expect(
      schwellenraumProtectedVolumeAt(
        MOABIT_PRISON_PARK_SOURCE_PROFILE.centerWorldM[0],
        MOABIT_PRISON_PARK_SOURCE_PROFILE.groundY,
        MOABIT_PRISON_PARK_SOURCE_PROFILE.centerWorldM[1],
      )?.id,
    ).toBe(moabit.id);

    const field = SCHWELLENRAUM_PROTECTED_VOLUMES.find(
      ({ id }) => id === "protected-memorial-stele-field",
    )!;
    if (field.shape !== "box") throw new Error("expected the field box");
    expect(
      schwellenraumProtectedVolumeAt(
        field.centerWorldM[0],
        4.61,
        field.centerWorldM[1],
      )?.id,
    ).toBe(field.id);
    expect(
      schwellenraumNavigationOverrideAt(
        field.centerWorldM[0],
        4.61,
        field.centerWorldM[1],
      ),
    ).toBeFalse();
    expect(
      schwellenraumProtectedAt(
        field.centerWorldM[0],
        50,
        field.centerWorldM[1],
      ),
    ).toBeFalse();

    expect(schwellenraumProtectedAt(-329.097233, 5.9, -906.302474)).toBeTrue();
    // The Soviet ensemble's southern hardware belongs to the same immutable
    // site as its soldier and colonnade, rather than falling outside the old
    // narrow box.
    for (const [x, z] of [
      [-7.9, 307.4],
      [7.8, 287.4],
      [50.8, 282.6],
      [69.9, 301.0],
    ] as const) {
      expect(schwellenraumProtectedAt(x, 5, z), `${x}:${z}`).toBeTrue();
    }
    for (const volume of SCHWELLENRAUM_ACCESSIBLE_VOLUMES) {
      expect(schwellenraumProtectedAt(...volume.centerWorldM)).toBeFalse();
    }
  });
});
