import { describe, expect, test } from "bun:test";

import {
  Box3,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import { HOTEL_ADLON_PROFILE } from "../src/HotelAdlonProfile";
import {
  ADLON_LOD2_ID,
  ADLON_WORLD,
  createHotelAdlon,
  setIsoNightPresentation,
} from "../src/IsometricCityWorld";
import { setModeOnlyDetails } from "../src/modeOnlyDetails";

function namedDescendantCount(root: Group, prefix: string): number {
  let count = 0;
  root.traverse((object) => {
    if (object.name.startsWith(prefix)) count += 1;
  });
  return count;
}

function geometryFingerprint(root: Group): readonly string[] {
  const fingerprints: string[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    const position = object.geometry.getAttribute("position");
    const color = object.geometry.getAttribute("color");
    let hash = 2166136261;
    for (const attribute of [position, color]) {
      if (!attribute) continue;
      for (let index = 0; index < attribute.array.length; index += 1) {
        const quantized = Math.round(Number(attribute.array[index]) * 10_000);
        hash = Math.imul(hash ^ quantized, 16777619) >>> 0;
      }
    }
    fingerprints.push(
      `${object.name}:${position.count}:${color?.count ?? 0}:${hash}`,
    );
  });
  return fingerprints;
}

describe("Hotel Adlon source profile", () => {
  test("keeps the exact LoD2/OSM envelope, three courtyards and measured front frame", () => {
    const profile = HOTEL_ADLON_PROFILE;
    expect(profile.lod2BuildingId).toBe("K00006ot");
    expect(profile.osm.relationId).toBe(4582978);
    expect(profile.osm.outerWayId).toBe(26041943);
    expect(profile.osm.courtyardWayIds).toEqual([
      420445400, 420449359, 420449360,
    ]);
    expect(profile.osm.outerRingWorldM).toHaveLength(30);
    expect(profile.osm.courtyardRingsWorldM).toHaveLength(3);

    const [westX, westZ] = profile.front.westWorldM;
    const [eastX, eastZ] = profile.front.eastWorldM;
    expect(Math.hypot(eastX - westX, eastZ - westZ)).toBeCloseTo(68.78, 2);
    expect(
      (Math.atan2(eastZ - westZ, eastX - westX) * 180) / Math.PI,
    ).toBeCloseTo(-5.07, 2);
    expect(profile.front.centerWorldM).toEqual([591.135, 316.75]);
    expect(profile.heights.groundWorldY).toBe(4.8);
    expect(profile.heights.eavesEvidence).toContain("inferred");
    expect(profile.heights.ridgeEvidence).toContain("inferred");
    expect(profile.heights.groundEvidence).toContain("LoD2");
    expect(ADLON_LOD2_ID).toBe(profile.lod2BuildingId);
    expect(ADLON_WORLD).toEqual(profile.front.centerWorldM);
  });

  test("pins the east return to its contiguous OSM edge and orientation", () => {
    const { east } = HOTEL_ADLON_PROFILE.returns;
    const [startIndex, endIndex] = east.outerRingZeroBasedIndices;
    expect(endIndex - startIndex).toBe(1);
    expect(HOTEL_ADLON_PROFILE.osm.outerRingWorldM[startIndex]).toEqual(
      east.startWorldM,
    );
    expect(HOTEL_ADLON_PROFILE.osm.outerRingWorldM[endIndex]).toEqual(
      east.endWorldM,
    );
    expect(east.startWorldM).toEqual([625.39, 313.71]);
    expect(east.endWorldM).toEqual([634.82, 347.22]);
    const dx = east.endWorldM[0] - east.startWorldM[0];
    const dz = east.endWorldM[1] - east.startWorldM[1];
    expect(Math.hypot(dx, dz)).toBeCloseTo(east.lengthM, 2);
    expect((Math.atan2(dz, dx) * 180) / Math.PI).toBeCloseTo(
      east.bearingDegreesXZ,
      2,
    );
  });

  test("records authoritative and freely licensed sources without bundling raster textures", () => {
    const { sources } = HOTEL_ADLON_PROFILE;
    expect(sources.kempinskiHistory).toContain("kempinski.com");
    expect(sources.lod2).toContain("dl-de/zero-2-0");
    expect(sources.osm).toContain("ODbL 1.0");
    expect(sources.visualReferences).toHaveLength(2);
    for (const reference of sources.visualReferences) {
      expect(reference).toContain("commons.wikimedia.org");
      expect(reference).toContain("CC BY-SA 4.0");
    }
  });
});

describe("Hotel Adlon smooth recognition layer", () => {
  test("uses a thin true-front overlay and the requested architectural counts", () => {
    const adlon = createHotelAdlon();
    expect(adlon.userData.lod2BuildingId).toBe(ADLON_LOD2_ID);
    expect(adlon.userData.sourcePrismSuppressed).toBe(false);
    expect(adlon.userData.facadeSkinDepthM).toBe(0.28);
    expect(adlon.userData.hasCornerRisalit).toBe(false);
    expect(adlon.userData.upperHeadClosedWithHollowSkins).toBe(true);
    expect(adlon.userData.frontBearingDegreesXZ).toBe(-5.07);
    expect(adlon.name.toLowerCase()).not.toContain("risalit");
    expect(namedDescendantCount(adlon, "Adlon ground arch ")).toBe(5);
    expect(namedDescendantCount(adlon, "Adlon front dormer ")).toBe(8);
    expect(namedDescendantCount(adlon, "Adlon flagpole ")).toBe(3);
    expect(
      namedDescendantCount(adlon, "Adlon open HOTEL ADLON lettering "),
    ).toBe(2);
    const eastLettering = adlon.getObjectByName(
      "Adlon open HOTEL ADLON lettering east",
    ) as Group;
    expect(eastLettering.userData.startWorldM).toEqual([625.39, 313.71]);
    expect(eastLettering.userData.endWorldM).toEqual([634.82, 347.22]);
    expect(eastLettering.userData.bearingDegreesXZ).toBe(
      HOTEL_ADLON_PROFILE.returns.east.bearingDegreesXZ,
    );
    expect(eastLettering.userData.axisWorld[0]).toBeCloseTo(0.270887, 5);
    expect(eastLettering.userData.axisWorld[1]).toBeCloseTo(0.962611, 5);
    expect(namedDescendantCount(adlon, "Adlon east dormer ")).toBe(3);
    expect(
      namedDescendantCount(adlon, "Adlon east upper window axis "),
    ).toBe(4);
  });

  test("stays inside the OSM-front recognition bounds in four batched draws", () => {
    const adlon = createHotelAdlon();
    const bounds = new Box3().setFromObject(adlon);
    expect(bounds.min.x).toBeCloseTo(556.57, 2);
    expect(bounds.max.x).toBeCloseTo(632.9, 2);
    expect(bounds.min.y).toBeCloseTo(4.65, 2);
    expect(bounds.max.y).toBeCloseTo(39.6, 2);
    expect(bounds.min.z).toBeCloseTo(306.77, 2);
    expect(bounds.max.z).toBeCloseTo(341.85, 2);

    const drawables: Array<Mesh | LineSegments> = [];
    adlon.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        drawables.push(object);
      }
    });
    expect(drawables.map((object) => object.name)).toEqual([
      "Adlon bodies",
      "Adlon lamps",
      "Adlon ink lines",
      "Adlon snow accents merged snow surface",
    ]);
    expect(drawables).toHaveLength(adlon.userData.drawCallBudget as number);
  });

  test("uses texture-free reversible day/night/Schwellenraum materials", () => {
    const adlon = createHotelAdlon();
    const bodies = adlon.getObjectByName("Adlon bodies") as Mesh;
    const lamps = adlon.getObjectByName("Adlon lamps") as Mesh;
    const snow = adlon.getObjectByName("Adlon snow accents") as Group;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(lamps).toBeInstanceOf(Mesh);
    expect(snow).toBeInstanceOf(Group);
    expect(snow.userData.visualModeOnly).toBe("snowstorm");
    expect(snow.visible).toBe(false);

    const materials = new Set<MeshBasicMaterial | MeshStandardMaterial>();
    adlon.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (
        object.material instanceof MeshBasicMaterial ||
        object.material instanceof MeshStandardMaterial
      ) {
        materials.add(object.material);
      }
      for (const candidate of [
        object.userData.dayMaterial,
        object.userData.nightMaterial,
      ]) {
        if (
          candidate instanceof MeshBasicMaterial ||
          candidate instanceof MeshStandardMaterial
        ) {
          materials.add(candidate);
        }
      }
    });
    for (const material of materials) expect(material.map).toBeNull();

    setIsoNightPresentation(adlon, true, true, "night");
    expect(bodies.material).toBe(bodies.userData.nightMaterial);
    expect(lamps.material).toBe(lamps.userData.nightMaterial);
    expect(
      (lamps.userData.nightMaterial as MeshStandardMaterial).emissiveIntensity,
    ).toBeGreaterThan(0);
    setModeOnlyDetails(adlon, "snowstorm");
    expect(snow.visible).toBe(true);
    setIsoNightPresentation(adlon, false, true, "schwellenraum");
    expect(bodies.material).toBe(bodies.userData.schwellenraumMaterial);
    expect(lamps.material).toBe(lamps.userData.schwellenraumMaterial);
    expect(bodies.material).not.toBe(bodies.userData.dayMaterial);
    expect(bodies.visible).toBe(true);
    expect(snow.visible).toBe(false);
    setIsoNightPresentation(adlon, false, true, "day");
    expect(bodies.material).toBe(bodies.userData.dayMaterial);
    expect(lamps.material).toBe(lamps.userData.dayMaterial);
  });

  test("builds deterministic code-native geometry", () => {
    expect(geometryFingerprint(createHotelAdlon())).toEqual(
      geometryFingerprint(createHotelAdlon()),
    );
  });
});
