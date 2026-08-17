import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Triangle,
  Vector3,
} from "three";

import {
  GENERIC_FACADE_TRIM_SUPPRESSED_IDS,
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  PRISM_SUPPRESSED_IDS,
  PRISM_VISUAL_TOP_CAP_SUPPRESSED_IDS,
  WINDOWS_SUPPRESSED_IDS,
  createIsometricCity,
  setIsoNightPresentation,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  ARD_HAUPTSTADTSTUDIO_ATRIUM_ID,
  ARD_HAUPTSTADTSTUDIO_ATRIUM_ROOF_COVERAGE,
  ARD_HAUPTSTADTSTUDIO_EXCLUDED_NEIGHBOR_IDS,
  ARD_HAUPTSTADTSTUDIO_FACADE_PROJECTION_M,
  ARD_HAUPTSTADTSTUDIO_FLOOR_COUNT,
  ARD_HAUPTSTADTSTUDIO_IDS,
  ARD_HAUPTSTADTSTUDIO_MAIN_ID,
  ARD_HAUPTSTADTSTUDIO_NORTH_WALL_INDICES,
  ARD_HAUPTSTADTSTUDIO_PROFILE,
  ARD_HAUPTSTADTSTUDIO_RECESS_SIDE_FRACTION,
  ARD_HAUPTSTADTSTUDIO_STUDIO_HEAD_ID,
  ARD_HAUPTSTADTSTUDIO_TONES,
  ARD_HAUPTSTADTSTUDIO_WEST_WALL_INDICES,
  ARD_HAUPTSTADTSTUDIO_WINDOW_HEIGHT_M,
  ARD_HAUPTSTADTSTUDIO_WINDOW_WIDTH_M,
  createArdHauptstadtstudio,
} from "../src/ArdHauptstadtstudio";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const prisms = prismJson as unknown as PrismPayload;
const ardPrisms: PrismPayload = {
  ...prisms,
  buildings: prisms.buildings.filter((building) =>
    ARD_HAUPTSTADTSTUDIO_IDS.has(building.id),
  ),
};

function model() {
  return createArdHauptstadtstudio(ardPrisms);
}

function meshesWithPresentationMaterials(root: ReturnType<typeof model>) {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && object.userData.dayMaterial) {
      meshes.push(object);
    }
  });
  return meshes;
}

function planarMeshArea(mesh: Mesh): number {
  const position = mesh.geometry.getAttribute("position");
  let area = 0;
  for (let index = 0; index < position.count; index += 3) {
    area += new Triangle(
      new Vector3().fromBufferAttribute(position, index),
      new Vector3().fromBufferAttribute(position, index + 1),
      new Vector3().fromBufferAttribute(position, index + 2),
    ).getArea();
  }
  return area;
}

describe("the source-bounded ARD Hauptstadtstudio recognition layer", () => {
  test("binds exactly the three official 09j0 parts and excludes semantic neighbours", () => {
    expect([...ARD_HAUPTSTADTSTUDIO_IDS]).toEqual([
      "OClyQw96",
      "G5qBz21a",
      "BMJAhW6D",
    ]);
    expect(ARD_HAUPTSTADTSTUDIO_EXCLUDED_NEIGHBOR_IDS).toEqual(
      new Set([
        "KjFyc25B",
        "u7DkeJws",
        "9jw0hPYl",
        "CPvsuszZ",
        "EIXcS4uf",
        "3ZPjjunb",
      ]),
    );
    const sourceIds = new Set(prisms.buildings.map((building) => building.id));
    for (const id of ARD_HAUPTSTADTSTUDIO_IDS) {
      expect(sourceIds.has(id)).toBeTrue();
    }
    for (const id of ARD_HAUPTSTADTSTUDIO_EXCLUDED_NEIGHBOR_IDS) {
      expect(ARD_HAUPTSTADTSTUDIO_IDS.has(id)).toBeFalse();
      expect(HERO_PRISM_TONES[id]).toBeUndefined();
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBeFalse();
      expect(GENERIC_FACADE_TRIM_SUPPRESSED_IDS.has(id)).toBeFalse();
    }
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.lod2Parent).toBe("DEBE01YYK00009j0");
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.lod2Function).toBe(3035);
    expect(
      ARD_HAUPTSTADTSTUDIO_PROFILE.sourceConflict.excludedLod2Function,
    ).toBe(1120);
  });

  test("retains every LoD2 prism while replacing only generic windows and trim", () => {
    for (const id of ARD_HAUPTSTADTSTUDIO_IDS) {
      expect(HERO_PRISM_TONES[id]).toBe(
        id === ARD_HAUPTSTADTSTUDIO_ATRIUM_ID ? 0xd4b276 : 0xa45f50,
      );
      expect(HERO_PRISM_ROOF_TONES[id]).toBe(0x8a8d7a);
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(GENERIC_FACADE_TRIM_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBeFalse();
    }
    expect(PRISM_VISUAL_TOP_CAP_SUPPRESSED_IDS).toEqual(
      new Set([ARD_HAUPTSTADTSTUDIO_ATRIUM_ID]),
    );
  });

  test("pins the measured envelope, six floors and the additive-source decision", () => {
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.areaM2).toBe(1673.704);
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.dimensionsM).toEqual([73.88, 37.69]);
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.centreWorldM).toEqual([
      648.747, 25.342,
    ]);
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.floorCount).toBe(6);
    expect(ARD_HAUPTSTADTSTUDIO_FLOOR_COUNT).toBe(6);
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.osm.wayId).toBe("24246741");
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.osm.buildingColourTag).toBe("#dfb082");
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.presentationColours).toMatchObject({
      ardBlue: "#003480",
      concrete: "#A45F50",
    });
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.sourceConflict.decision).toContain(
      "DEBE01YYK00009j0",
    );
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.sourceConflict.note).toContain(
      "x=702.472",
    );
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.northFacade).toEqual({
      modulePitchM: 2.75,
      paneHeightM: ARD_HAUPTSTADTSTUDIO_WINDOW_HEIGHT_M,
      paneWidthM: ARD_HAUPTSTADTSTUDIO_WINDOW_WIDTH_M,
      recessSide: "consistent trailing side",
      recessSideFraction: ARD_HAUPTSTADTSTUDIO_RECESS_SIDE_FRACTION,
      sourcePrismId: ARD_HAUPTSTADTSTUDIO_MAIN_ID,
      wallIndices: ARD_HAUPTSTADTSTUDIO_NORTH_WALL_INDICES,
    });
  });

  test("draws the curved facade, large west studio field and bounded roof equipment", () => {
    const details = model();
    expect(
      details.getObjectByName(
        "ARD Hauptstadtstudio architectural details bodies",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      details.getObjectByName(
        "ARD Hauptstadtstudio architectural details lamps",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      details.getObjectByName(
        "ARD Hauptstadtstudio architectural details ink lines",
      ),
    ).toBeInstanceOf(LineSegments);
    expect(details.userData.detailCounts.sourcePrisms).toBe(3);
    expect(details.userData.detailCounts.northCurveModules).toBe(21);
    expect(details.userData.detailCounts.fixedGlazing).toBe(
      details.userData.detailCounts.northCurveModules * 6,
    );
    expect(details.userData.detailCounts.westStudioGlazingFields).toBe(2);
    expect(details.userData.detailCounts.westStudioLamellaBars).toBe(9);
    expect(details.userData.detailCounts.studioHeadRoofEdgeBands).toBe(4);
    expect(details.userData.detailCounts.rearFacadeSkins).toBe(1);
    expect(details.userData.detailCounts.ventCount).toBe(6);
    expect(details.userData.detailCounts.roofDishes).toBe(3);
    expect(details.userData.detailCounts.atriumRoofGridBars).toBe(19);
    expect(details.userData.roofEquipment).toMatchObject({
      diameterStatus: "photo-bounded approximation",
      displayApproximation: true,
    });
    expect(details.userData.sourcePrismIds).toEqual([
      ARD_HAUPTSTADTSTUDIO_STUDIO_HEAD_ID,
      ARD_HAUPTSTADTSTUDIO_MAIN_ID,
      ARD_HAUPTSTADTSTUDIO_ATRIUM_ID,
    ]);
    expect(
      ARD_HAUPTSTADTSTUDIO_PROFILE.sourcePartRoles[
        ARD_HAUPTSTADTSTUDIO_STUDIO_HEAD_ID
      ],
    ).toContain("upper outline");
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.westFacade).toEqual({
      sourcePrismId: ARD_HAUPTSTADTSTUDIO_MAIN_ID,
      wallIndices: ARD_HAUPTSTADTSTUDIO_WEST_WALL_INDICES,
    });
  });

  test("limits the glass roof to the plan-bounded hall strip", () => {
    const details = model();
    const roof = details.getObjectByName(
      "ARD Hauptstadtstudio atrium roof glazing",
    ) as Mesh;
    const opaqueRearRoof = details.getObjectByName(
      "ARD Hauptstadtstudio opaque rear roof",
    ) as Mesh;
    expect(roof).toBeInstanceOf(Mesh);
    expect(opaqueRearRoof).toBeInstanceOf(Mesh);
    expect(roof.userData.coverageFraction).toBe(
      ARD_HAUPTSTADTSTUDIO_ATRIUM_ROOF_COVERAGE,
    );
    expect(roof.userData.geometryStatus).toContain("northern hall strip");
    expect(roof.userData.sourceRoofCapReplaced).toBeTrue();
    expect(opaqueRearRoof.userData.sourceRoofCapReplaced).toBeTrue();
    const glassAreaM2 = planarMeshArea(roof);
    const opaqueAreaM2 = planarMeshArea(opaqueRearRoof);
    expect(glassAreaM2).toBeGreaterThan(250);
    expect(glassAreaM2).toBeLessThan(420);
    expect(glassAreaM2).toBeLessThan(928.7 * 0.45);
    expect(details.userData.detailCounts.atriumRoofAreaM2Approx).toBeCloseTo(
      glassAreaM2,
      3,
    );
    expect(details.userData.detailCounts.opaqueRearRoofAreaM2).toBeCloseTo(
      opaqueAreaM2,
      3,
    );
    expect(glassAreaM2 + opaqueAreaM2).toBeCloseTo(928.7, 2);
  });

  test("keeps its detail meshes thin while collision remains a separate contract", () => {
    const details = model();
    const bounds = new Box3().setFromObject(details);
    expect(bounds.min.x).toBeGreaterThanOrEqual(611.7);
    expect(bounds.max.x).toBeLessThanOrEqual(686.7);
    expect(bounds.min.z).toBeGreaterThanOrEqual(6.0);
    expect(bounds.max.z).toBeLessThanOrEqual(44.6);
    expect(bounds.min.y).toBeGreaterThanOrEqual(2.25);
    expect(bounds.max.y).toBeLessThanOrEqual(33.0);
    expect(details.userData.hasOpaqueEnvelope).toBeFalse();
    expect(details.userData.maxFacadeProjectionM).toBe(
      ARD_HAUPTSTADTSTUDIO_FACADE_PROJECTION_M,
    );
    expect(details.userData.collisionGeometry).toBeUndefined();
    expect(details.userData.geometryStatus).toContain(
      "separate Schwellenraum navigation solids",
    );
    expect(details.userData.architecturalProfile.centreWorldM).toEqual([
      648.747, 25.342,
    ]);
    details.traverse((object) => {
      expect(object.userData.opaqueEnvelope).not.toBeTrue();
    });
  });

  test("records complete per-file attributions without bundling reference imagery", () => {
    const references = ARD_HAUPTSTADTSTUDIO_PROFILE.visualReferences;
    expect(references).toHaveLength(3);
    expect(references.map((reference) => reference.artist)).toEqual([
      "Bärbel Miemietz",
      "Standardizer",
      "Ansgar Koreng",
    ]);
    expect(references.map((reference) => reference.title)).toEqual([
      "2024-12-01 ARD Hauptstadtstudio 1080537.JPG",
      "ARD-Hauptstadtstudio (aus Nordwesten).jpg",
      "ARD-Hauptstadtstudio, Berlin-Mitte, Fassade, 170117, ako.jpg",
    ]);
    for (const reference of references) {
      expect(reference.title.length).toBeGreaterThan(5);
      expect(reference.license.length).toBeGreaterThan(5);
      expect(reference.licenseUrl).toStartWith("https://creativecommons.org/");
      expect(reference.pageUrl).toStartWith(
        "https://commons.wikimedia.org/wiki/File:",
      );
      expect(reference.role.length).toBeGreaterThan(20);
      expect(reference.geometryStatus).toContain("not bundled");
    }
    const details = model();
    expect(details.userData.visualReferences).toBe(references);
    expect(details.userData.geometryStatus).toContain("no photograph");
    details.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials as Material[]) {
        const map = (material as Material & { map?: unknown }).map;
        if (!map) continue;
        expect([
          "ARD HAUPTSTADTSTUDIO facade lettering",
          "ARD Hauptstadtstudio facade subtitle",
        ]).toContain(object.name);
        expect(object.userData.textureSource).toContain(
          "runtime code-generated",
        );
      }
    });
  });

  test("keeps the west sign correctly placed and code-generated", () => {
    const details = model();
    const sign = details.getObjectByName(
      "ARD HAUPTSTADTSTUDIO facade lettering",
    ) as Mesh;
    const subtitle = details.getObjectByName(
      "ARD Hauptstadtstudio facade subtitle",
    ) as Mesh;
    const assembly = details.getObjectByName(
      "ARD Hauptstadtstudio facade logo assembly",
    ) as Group;
    expect(sign).toBeInstanceOf(Mesh);
    expect(subtitle).toBeInstanceOf(Mesh);
    expect(assembly).toBeInstanceOf(Group);
    expect(sign.userData.logoColour).toBe("#003480");
    expect(sign.userData.text).toBe("ARD  1");
    expect(sign.userData.sourceWallIndex).toBe(15);
    expect(subtitle.userData.text).toBe("HAUPTSTADTSTUDIO");
    expect(subtitle.userData.sourceWallIndex).toBe(15);
    expect(assembly.userData.layout).toContain("ARD/1");
    expect(ARD_HAUPTSTADTSTUDIO_PROFILE.facadeLogo).toEqual({
      alongM: 15,
      sourcePrismId: ARD_HAUPTSTADTSTUDIO_MAIN_ID,
      wallIndex: 15,
    });
    expect(sign.position.x).toBeGreaterThan(612);
    expect(sign.position.x).toBeLessThan(633.2);
    expect(sign.position.z).toBeGreaterThan(16);
    expect(sign.position.z).toBeLessThan(19);
    expect(sign.userData.positionStatus).toBe(
      "upper western half of the Spree facade",
    );
    const signFront = new Vector3(0, 0, 1).applyQuaternion(sign.quaternion);
    expect(signFront.x).toBeCloseTo(sign.userData.sourceOutwardNormal[0], 6);
    expect(signFront.z).toBeCloseTo(sign.userData.sourceOutwardNormal[1], 6);
    expect(sign.userData.textureSource).toContain(
      "no reference photograph or thumbnail",
    );
  });

  test("uses day materials in day, snow and Schwellenraum, and lit materials only at night", () => {
    const details = model();
    const meshes = meshesWithPresentationMaterials(details);
    expect(meshes.map((mesh) => mesh.name).sort()).toEqual(
      [
        "ARD HAUPTSTADTSTUDIO facade lettering",
        "ARD Hauptstadtstudio facade subtitle",
        "ARD Hauptstadtstudio architectural details bodies",
        "ARD Hauptstadtstudio architectural details lamps",
        "ARD Hauptstadtstudio atrium roof glazing",
        "ARD Hauptstadtstudio opaque rear roof",
      ].sort(),
    );
    setIsoNightPresentation(details, false, true, "day");
    for (const mesh of meshes) {
      expect(mesh.material).toBe(
        mesh.userData.dayMaterial as MeshBasicMaterial,
      );
    }
    setIsoNightPresentation(details, true, true, "night");
    for (const mesh of meshes) {
      expect(mesh.material).toBe(
        mesh.userData.nightMaterial as MeshStandardMaterial,
      );
    }
    for (const mode of ["snowstorm", "schwellenraum"] as const) {
      setIsoNightPresentation(details, false, true, mode);
      for (const mesh of meshes) {
        expect(mesh.material).toBe(
          mesh.userData.dayMaterial as MeshBasicMaterial,
        );
      }
    }
  });

  test("integrates once while the official LoD2 body remains visible", () => {
    const city = createIsometricCity(ardPrisms, null);
    const matches: unknown[] = [];
    city.traverse((object) => {
      if (object.name === "ARD Hauptstadtstudio details") matches.push(object);
    });
    expect(matches).toHaveLength(1);
    expect(city.getObjectByName("LoD2 prism buildings")).toBeInstanceOf(Mesh);
    expect(
      city.getObjectByName("ARD Hauptstadtstudio architectural details bodies"),
    ).toBeInstanceOf(Mesh);
    const loD2Bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
    const positions = loD2Bodies.geometry.getAttribute("position");
    let opaqueAtriumTopTriangles = 0;
    for (let index = 0; index < positions.count; index += 3) {
      const y0 = positions.getY(index);
      const y1 = positions.getY(index + 1);
      const y2 = positions.getY(index + 2);
      if (
        Math.abs(y0 - 28.7) > 0.03 ||
        Math.abs(y1 - 28.7) > 0.03 ||
        Math.abs(y2 - 28.7) > 0.03
      ) {
        continue;
      }
      const centroidX =
        (positions.getX(index) +
          positions.getX(index + 1) +
          positions.getX(index + 2)) /
        3;
      const centroidZ =
        (positions.getZ(index) +
          positions.getZ(index + 1) +
          positions.getZ(index + 2)) /
        3;
      if (
        centroidX >= 630.3 &&
        centroidX <= 685.3 &&
        centroidZ >= 12.6 &&
        centroidZ <= 37.2
      ) {
        opaqueAtriumTopTriangles += 1;
      }
    }
    expect(opaqueAtriumTopTriangles).toBe(0);
  });
});
