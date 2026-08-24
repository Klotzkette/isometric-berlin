import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Material, Mesh } from "three";

import {
  GENERIC_CHIMNEY_SUPPRESSED_IDS,
  GENERIC_FACADE_TRIM_SUPPRESSED_IDS,
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  PRISM_GLASSED_IDS,
  PRISM_SUPPRESSED_IDS,
  WINDOWS_SUPPRESSED_IDS,
  setIsoNightPresentation,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  REICHSTAGSPRAESIDENTENPALAIS_AXIS_LAYOUT,
  REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_IDS,
  REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_PARENT,
  REICHSTAGSPRAESIDENTENPALAIS_FULLY_DETAILED_WALL_INDICES,
  REICHSTAGSPRAESIDENTENPALAIS_GARDEN_DETAIL_NAME,
  REICHSTAGSPRAESIDENTENPALAIS_GENERIC_CHIMNEY_SUPPRESSED_IDS,
  REICHSTAGSPRAESIDENTENPALAIS_IDS,
  REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME,
  REICHSTAGSPRAESIDENTENPALAIS_PARENTS,
  REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_DETAIL_NAME,
  REICHSTAGSPRAESIDENTENPALAIS_PROFILE,
  REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS,
  REICHSTAGSPRAESIDENTENPALAIS_SECONDARY_RHYTHM_EXCLUDED_WALL_INDICES,
  REICHSTAGSPRAESIDENTENPALAIS_TONES,
  createReichstagspraesidentenpalais,
  isReichstagspraesidentenpalaisFullyDetailedWall,
  isReichstagspraesidentenpalaisSecondaryRhythmExcludedWall,
  reichstagspraesidentenpalaisDetailSolidAt,
} from "../src/Reichstagspraesidentenpalais";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const prisms = prismJson as unknown as PrismPayload;
const palacePrisms: PrismPayload = {
  ...prisms,
  buildings: prisms.buildings.filter((building) =>
    REICHSTAGSPRAESIDENTENPALAIS_IDS.has(building.id),
  ),
};

function model() {
  return createReichstagspraesidentenpalais(palacePrisms);
}

function sourceUnionBoundsXZ(): [number, number, number, number] {
  const xs = palacePrisms.buildings.flatMap((building) =>
    building.ring.map(([x]) => x / 10),
  );
  const zs = palacePrisms.buildings.flatMap((building) =>
    building.ring.map(([, z]) => z / 10),
  );
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}

describe("the source-bounded Reichstagspräsidentenpalais recognition layer", () => {
  test("pins all ten two-parent LoD2 parts and excludes Jakob-Kaiser-Haus", () => {
    expect([...REICHSTAGSPRAESIDENTENPALAIS_IDS]).toEqual([
      "1gEfIRTG",
      "JRUA1rbq",
      "C2lCpqK5",
      "mUPhydAs",
      "cojdzbig",
      "zMovgLdU",
      "NkNHQuNp",
      "y2n0A1dj",
      "rTIZwx4H",
      "4ccKsLeW",
    ]);
    expect([...REICHSTAGSPRAESIDENTENPALAIS_PARENTS]).toEqual([
      "DEBE01YYK00008oJ",
      "DEBE01YYK000057I",
    ]);
    expect(REICHSTAGSPRAESIDENTENPALAIS_PROFILE.lod2Function).toBe(
      "31001_3011",
    );
    expect(palacePrisms.buildings).toHaveLength(10);
    expect(sourceUnionBoundsXZ()).toEqual([407.8, 468.8, 12.8, 49.1]);
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.dimensionsM.lod2UnionBoundsXZ,
    ).toEqual(sourceUnionBoundsXZ());

    expect(REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_PARENT).toBe(
      "DEBE01YYK00001Li",
    );
    expect([...REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_IDS]).toEqual(
      [
        "8Xin7PqI",
        "5ITeMfv2",
        "8bMtIR4M",
        "ZnvQ4nLq",
        "BJBxg2ub",
        "9RhopAvB",
        "kslsuKgM",
        "1IAjmM1x",
      ],
    );
    const sourceIds = new Set(prisms.buildings.map((building) => building.id));
    for (const id of REICHSTAGSPRAESIDENTENPALAIS_IDS) {
      expect(sourceIds.has(id)).toBeTrue();
      expect(
        REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_IDS.has(id),
      ).toBeFalse();
    }
    for (const id of REICHSTAGSPRAESIDENTENPALAIS_EXCLUDED_JAKOB_KAISER_IDS) {
      expect(sourceIds.has(id)).toBeTrue();
      expect(REICHSTAGSPRAESIDENTENPALAIS_IDS.has(id)).toBeFalse();
    }
  });

  test("pins exact authored walls, slate carriers and unsupported chimneys", () => {
    expect(REICHSTAGSPRAESIDENTENPALAIS_FULLY_DETAILED_WALL_INDICES).toEqual({
      "1gEfIRTG": [1],
      rTIZwx4H: [0],
      y2n0A1dj: [2, 3],
      zMovgLdU: [0],
    });
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("1gEfIRTG", 1),
    ).toBeTrue();
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("1gEfIRTG", 0),
    ).toBeFalse();
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("y2n0A1dj", 2),
    ).toBeTrue();
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("y2n0A1dj", 3),
    ).toBeTrue();
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("rTIZwx4H", 0),
    ).toBeTrue();
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("rTIZwx4H", 1),
    ).toBeFalse();
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("zMovgLdU", 0),
    ).toBeTrue();
    expect(
      isReichstagspraesidentenpalaisFullyDetailedWall("unknown", 0),
    ).toBeFalse();

    expect(
      REICHSTAGSPRAESIDENTENPALAIS_SECONDARY_RHYTHM_EXCLUDED_WALL_INDICES,
    ).toEqual({
      "1gEfIRTG": [1],
      rTIZwx4H: [0],
      y2n0A1dj: [2, 3],
      zMovgLdU: [0, 2],
    });
    expect(
      isReichstagspraesidentenpalaisSecondaryRhythmExcludedWall("zMovgLdU", 0),
    ).toBeTrue();
    expect(
      isReichstagspraesidentenpalaisSecondaryRhythmExcludedWall("zMovgLdU", 2),
    ).toBeTrue();
    expect(
      isReichstagspraesidentenpalaisSecondaryRhythmExcludedWall("zMovgLdU", 1),
    ).toBeFalse();

    expect([...REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS]).toEqual([
      "1gEfIRTG",
      "mUPhydAs",
      "zMovgLdU",
      "NkNHQuNp",
      "y2n0A1dj",
      "rTIZwx4H",
      "4ccKsLeW",
    ]);
    for (const flatOrLowId of ["C2lCpqK5", "JRUA1rbq", "cojdzbig"]) {
      expect(
        REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS.has(flatOrLowId),
      ).toBeFalse();
    }
    expect([
      ...REICHSTAGSPRAESIDENTENPALAIS_GENERIC_CHIMNEY_SUPPRESSED_IDS,
    ]).toEqual(["1gEfIRTG", "zMovgLdU"]);
    expect(REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone).toBe(0xcfb778);
    expect(REICHSTAGSPRAESIDENTENPALAIS_TONES.slate).toBe(0x4d555b);
    expect(REICHSTAGSPRAESIDENTENPALAIS_TONES.wood).toBe(0x4f3327);
  });

  test("suppresses generic decoration without suppressing or glazing a shell", () => {
    for (const id of REICHSTAGSPRAESIDENTENPALAIS_IDS) {
      expect(HERO_PRISM_TONES[id]).toBe(
        REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
      );
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(GENERIC_FACADE_TRIM_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBeFalse();
      expect(PRISM_GLASSED_IDS.has(id)).toBeFalse();
      if (REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS.has(id)) {
        expect(HERO_PRISM_ROOF_TONES[id]).toBe(
          REICHSTAGSPRAESIDENTENPALAIS_TONES.slate,
        );
      } else {
        expect(HERO_PRISM_ROOF_TONES[id]).toBeUndefined();
      }
      expect(GENERIC_CHIMNEY_SUPPRESSED_IDS.has(id)).toBe(
        REICHSTAGSPRAESIDENTENPALAIS_GENERIC_CHIMNEY_SUPPRESSED_IDS.has(id),
      );
    }
  });

  test("pins official identity, open-data enclosure and reference-only attribution", () => {
    expect(REICHSTAGSPRAESIDENTENPALAIS_PROFILE.osm).toEqual({
      dpgNodeId: "5443120622",
      palaceWayId: "37408952",
    });
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.gardenEnclosure.wallWayIds,
    ).toEqual(["437493373", "1379191721"]);
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.gardenEnclosure.hedgeWayId,
    ).toBe("437493370");
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.gardenEnclosure
        .omittedRetainingWallWayId,
    ).toBe("437493369");
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.gardenEnclosure.wallWorldLinesM[0],
    ).toEqual([
      [417.279, -20.385],
      [427.538, -14.457],
      [441.048, -7.888],
      [456.74, -1.449],
      [468.211, 2.804],
      [478.655, 5.987],
    ]);
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.omissions.courtyardGlassRoof,
    ).toContain("omitted");
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions,
    ).toHaveLength(2);
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions[0].role,
    ).toContain("not used as a texture");
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions[0].credit,
    ).toContain("Jörg Zägel");
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions[0].title,
    ).toBe("Reichstagspräsidentenpalais, Westfassade");
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions[0].artist,
    ).toContain("Jörg Zägel");
    expect(REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions[0].url).toBe(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions[0].pageUrl,
    );
    expect(
      REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceAttributions[1].license,
    ).toBe("CC BY-SA 4.0");
    expect(REICHSTAGSPRAESIDENTENPALAIS_PROFILE.sourceUrls).toContain(
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065047",
    );
  });

  test("draws the documented facade rhythms in persistent and fadeable layers", () => {
    const details = model();
    for (const name of [
      REICHSTAGSPRAESIDENTENPALAIS_PERSISTENT_DETAIL_NAME,
      REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME,
      REICHSTAGSPRAESIDENTENPALAIS_GARDEN_DETAIL_NAME,
    ]) {
      expect(details.getObjectByName(name)).toBeDefined();
      expect(details.getObjectByName(`${name} bodies`)).toBeInstanceOf(Mesh);
      expect(details.getObjectByName(`${name} ink lines`)).toBeInstanceOf(
        LineSegments,
      );
    }
    expect(
      details.getObjectByName(
        `${REICHSTAGSPRAESIDENTENPALAIS_MICRO_DETAIL_NAME} lamps`,
      ),
    ).toBeInstanceOf(Mesh);
    expect(details.userData.detailCounts).toMatchObject({
      carriageDoors: 1,
      centralPorticoBays: 5,
      gardenHedgeSegments: 1,
      gardenWallSegments: 7,
      kaisersaalArches: 3,
      kaisersaalPilasters: 4,
      kaisersaalStairBoxes: 13,
      northAxes: 7,
      northBalconyRails: 7,
      northWindows: 21,
      oculi: 1,
      ornateWestAxes: 2,
      pedimentedWestWindows: 3,
      porticoColumns: 6,
      puttiDisplayApproximations: 4,
      smallPortals: 1,
      sourcePrisms: 10,
      westAxes: 6,
      westCartouches: 2,
      westErkers: 1,
      westErkerSideWindows: 4,
      westVolutes: 4,
      westWindows: 16,
    });
    expect(details.userData.detailCounts.secondaryExteriorWalls).toBe(13);
    expect(details.userData.detailCounts.secondaryExteriorWindows).toBe(65);
    expect(details.userData.detailCounts.gardenWallFields).toBe(26);
    expect(details.userData.detailCounts.gardenWallPiers).toBe(27);
    expect(details.userData.axisLayout).toEqual(
      REICHSTAGSPRAESIDENTENPALAIS_AXIS_LAYOUT,
    );
    expect(details.userData.axisLayout.west).toMatchObject({
      erkerAxis: 5,
      ornateAxes: [4, 6],
      pedimentedBalconyAxes: [1, 2, 3],
      portalAndOculusAxis: 4,
    });
    expect(details.userData.detailAnchors.northPortico).toMatchObject({
      frontProjectionFromCarrierM: 0.42,
      sourcePrismId: "zMovgLdU",
      wallIndex: 0,
    });
    expect(
      details.userData.detailAnchors.northPortico.centreWorldXZ[1],
    ).toBeCloseTo(14.43, 1);
    expect(details.userData.detailAnchors.west.portalAxis).toBe(4);
    expect(details.userData.detailAnchors.west.erkerAxis).toBe(5);
    expect(
      details.userData.detailAnchors.west.cartouches.map(
        ({ axis }: { axis: number }) => axis,
      ),
    ).toEqual([6, 4]);
    for (const cartouche of details.userData.detailAnchors.west.cartouches) {
      expect(
        cartouche.volutes.map(
          ({ handedness }: { handedness: number }) => handedness,
        ),
      ).toEqual([-1, 1]);
      expect(cartouche.volutes[0].worldXZ[1]).toBeGreaterThan(
        cartouche.volutes[1].worldXZ[1],
      );
    }
    expect(
      details.userData.detailAnchors.west.erkerSideWindows.map(
        ({ side, storey }: { side: string; storey: number }) => [side, storey],
      ),
    ).toEqual([
      ["south", 1],
      ["south", 2],
      ["north", 1],
      ["north", 2],
    ]);
    const [southLower, southUpper, northLower, northUpper] =
      details.userData.detailAnchors.west.erkerSideWindows;
    expect(southLower.centreWorldXYZ[1]).toBeCloseTo(15.55, 3);
    expect(southUpper.centreWorldXYZ[1]).toBeCloseTo(21.05, 3);
    expect(northLower.centreWorldXYZ[1]).toBeCloseTo(15.55, 3);
    expect(northUpper.centreWorldXYZ[1]).toBeCloseTo(21.05, 3);
    expect(southLower.centreWorldXYZ[2]).toBeGreaterThan(
      northLower.centreWorldXYZ[2],
    );
    // Physical west-wall traversal is south-to-north: the fifth-axis erker
    // must therefore lie south of the fourth-axis portal, not be mirrored.
    expect(details.userData.detailAnchors.west.erkerWorldXZ[1]).toBeGreaterThan(
      details.userData.detailAnchors.west.portalWorldXZ[1],
    );
    expect(details.userData.secondaryExteriorWallIndices).toEqual([
      { sourcePrismId: "1gEfIRTG", wallIndex: 0 },
      { sourcePrismId: "1gEfIRTG", wallIndex: 3 },
      { sourcePrismId: "C2lCpqK5", wallIndex: 2 },
      { sourcePrismId: "C2lCpqK5", wallIndex: 5 },
      { sourcePrismId: "C2lCpqK5", wallIndex: 6 },
      { sourcePrismId: "mUPhydAs", wallIndex: 2 },
      { sourcePrismId: "mUPhydAs", wallIndex: 3 },
      { sourcePrismId: "mUPhydAs", wallIndex: 4 },
      { sourcePrismId: "y2n0A1dj", wallIndex: 4 },
      { sourcePrismId: "y2n0A1dj", wallIndex: 5 },
      { sourcePrismId: "y2n0A1dj", wallIndex: 7 },
      { sourcePrismId: "rTIZwx4H", wallIndex: 2 },
      { sourcePrismId: "4ccKsLeW", wallIndex: 2 },
    ]);
    for (const { sourcePrismId, wallIndex } of details.userData
      .secondaryExteriorWallIndices) {
      expect(
        isReichstagspraesidentenpalaisSecondaryRhythmExcludedWall(
          sourcePrismId,
          wallIndex,
        ),
      ).toBeFalse();
    }
  });

  test("stays additive, texture-free, presentation-tagged and inexpensive", () => {
    const details = model();
    expect(details.userData.hasOpaqueEnvelope).toBeFalse();
    expect(details.userData.geometryStatus).toContain(
      "LoD2 envelopes remain untouched",
    );
    expect(details.userData.geometryStatus).toContain("no opaque replacement");
    expect(details.userData.geometryStatus).toContain("no photo texture");
    let meshCount = 0;
    let vertexCount = 0;
    details.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshCount += 1;
      vertexCount += object.geometry.getAttribute("position").count;
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      expect(object.userData.reichstagspraesidentenpalaisDetail).toBeTrue();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        expect((material as Material & { map?: unknown }).map).toBeFalsy();
      }
    });
    expect(meshCount).toBe(4);
    expect(vertexCount).toBeLessThan(100_000);

    const bounds = new Box3().setFromObject(details);
    expect(bounds.min.x).toBeGreaterThanOrEqual(404.8);
    expect(bounds.max.x).toBeLessThanOrEqual(493.8);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-20.7);
    expect(bounds.max.z).toBeLessThanOrEqual(49.5);
    expect(bounds.min.y).toBeGreaterThanOrEqual(4.4);
    expect(bounds.max.y).toBeLessThanOrEqual(31.6);
  });

  test("switches every tagged detail mesh Day → Night → Schwellenraum grade → Day", () => {
    const details = model();
    const taggedMeshes: Mesh[] = [];
    details.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.userData.reichstagspraesidentenpalaisDetail === true
      ) {
        taggedMeshes.push(object);
      }
    });
    expect(taggedMeshes).toHaveLength(4);

    setIsoNightPresentation(details, false, true, "day");
    for (const mesh of taggedMeshes) {
      expect(mesh.material).toBe(mesh.userData.dayMaterial);
    }
    setIsoNightPresentation(details, true, true, "night");
    for (const mesh of taggedMeshes) {
      expect(mesh.material).toBe(mesh.userData.nightMaterial);
    }
    setIsoNightPresentation(details, false, true, "schwellenraum");
    for (const mesh of taggedMeshes) {
      expect(mesh.material).toBe(mesh.userData.schwellenraumMaterial);
      expect(mesh.material).not.toBe(mesh.userData.dayMaterial);
    }
    setIsoNightPresentation(details, false, true, "day");
    for (const mesh of taggedMeshes) {
      expect(mesh.material).toBe(mesh.userData.dayMaterial);
    }
  });

  test("makes only the longitudinal Kaisersaal stair and sandstone walls solid", () => {
    const dirX = 0.999369;
    const dirZ = -0.035511;
    const nx = -0.035511;
    const nz = -0.999369;
    const stairPoint = (along: number, outward: number) =>
      [
        447.6 + dirX * along + nx * outward,
        31.7 + dirZ * along + nz * outward,
      ] as const;
    const [eastX, eastZ] = stairPoint(18.08, 1.52);
    const [westX, westZ] = stairPoint(10.6, 1.52);
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(eastX, 4.82, eastZ),
    ).toBeTrue();
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(westX, 6.0, westZ),
    ).toBeTrue();
    const [offStairX, offStairZ] = stairPoint(14.0, 5.0);
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(offStairX, 5.2, offStairZ),
    ).toBeFalse();

    const x1 = 417.279;
    const z1 = -20.385;
    const x2 = 427.538;
    const z2 = -14.457;
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(midX, 5.4, midZ),
    ).toBeTrue();
    const length = Math.hypot(x2 - x1, z2 - z1);
    const offsetX = midX - ((z2 - z1) / length) * 0.32;
    const offsetZ = midZ + ((x2 - x1) / length) * 0.32;
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(offsetX, 5.4, offsetZ),
    ).toBeFalse();
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(offsetX, 5.4, offsetZ, 0.18),
    ).toBeTrue();
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(486, 5.3, 8.2),
    ).toBeFalse();
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(midX, 8.0, midZ),
    ).toBeFalse();
    expect(
      reichstagspraesidentenpalaisDetailSolidAt(Number.NaN, 5, midZ),
    ).toBeFalse();
  });

  test("fails closed when any official source part is absent", () => {
    const incomplete: PrismPayload = {
      ...palacePrisms,
      buildings: palacePrisms.buildings.filter(
        (building) => building.id !== "4ccKsLeW",
      ),
    };
    const details = createReichstagspraesidentenpalais(incomplete);
    expect(details.children).toHaveLength(0);
    expect(details.userData.geometryStatus).toBe("required LoD2 parts missing");
    expect(details.userData.missingSourcePrismIds).toEqual(["4ccKsLeW"]);
  });
});
