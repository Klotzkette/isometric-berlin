import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Vector3,
} from "three";

import streetJson from "../public/mesh/regierungsviertel/street-details.json";
import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import visualReferenceAttribution from "../public/dzi/regierungsviertel/visual_reference_attribution.json";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import {
  createKindertransportMemorial,
  KINDERTRANSPORT_MEMORIAL_OSM_KEY,
  KINDERTRANSPORT_MEMORIAL_PROFILE,
  KINDERTRANSPORT_VISUAL_REFERENCES,
} from "../src/KindertransportMemorial";
import {
  type VoxelPayload,
  worldGroundSampler,
} from "../src/MinecraftVoxelWorld";
import {
  createSchwellenraumMemorialProtectionIndex,
  schwellenraumProtectedMemorialAt,
} from "../src/schwellenraumMemorialProtection";
import { createTiergartenMonuments } from "../src/TiergartenMonuments";
import type { StreetDetailsPayload } from "../src/TrafficSignals";

const street = streetJson as unknown as StreetDetailsPayload;
const ground = groundJson as unknown as VoxelPayload;
const sourceEntry = street.monuments!.find(
  (entry) => entry.osm_key === KINDERTRANSPORT_MEMORIAL_OSM_KEY,
)!;

function childrenNamed(root: Group, name: string): Group[] {
  const matches: Group[] = [];
  root.traverse((object) => {
    if (object instanceof Group && object.name === name) matches.push(object);
  });
  return matches;
}

function bodyMeshes(root: Group): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && object.name === "monument bodies") {
      meshes.push(object);
    }
  });
  return meshes;
}

describe("Kindertransport memorial at Bahnhof Friedrichstrasse", () => {
  test("uses the exact protected OSM point and sampled pavement height", () => {
    expect(sourceEntry).toMatchObject({
      kind: "memorial",
      memorial_type: "sculpture",
      osm_id: "8912152881",
      schwellenraum_protected: true,
      x_dm: 11083,
      z_dm: -808,
    });
    expect(worldGroundSampler(ground)(1108.3, -80.8)).toBe(3.5);

    const memorial = createKindertransportMemorial();
    expect(memorial.position.toArray()).toEqual([
      1108.30716689, 3.5, -80.77000113,
    ]);
    expect(memorial.rotation.y).toBeCloseTo((-1.02 * Math.PI) / 180, 8);
    expect(memorial.userData.osmKey).toBe(KINDERTRANSPORT_MEMORIAL_OSM_KEY);
    expect(memorial.userData.groundYM).toBe(3.5);
    expect(memorial.userData.artists).toEqual(["Frank Meisler", "Arie Ovadia"]);
    expect(memorial.userData.completionYear).toBe(2008);
    expect(memorial.userData.titleDe).toBe(
      "Züge in das Leben – Züge in den Tod 1938–1945",
    );
    expect(memorial.userData.titleEn).toBe("Trains to Life – Trains to Death");
  });

  test("pins the published 3 x 2 m extent and 2.25 m catalogue height", () => {
    expect(KINDERTRANSPORT_MEMORIAL_PROFILE.documentedOverallLengthM).toBe(3);
    expect(KINDERTRANSPORT_MEMORIAL_PROFILE.documentedOverallDepthM).toBe(2);
    expect(KINDERTRANSPORT_MEMORIAL_PROFILE.overallHeightM).toBe(2.25);

    const memorial = createKindertransportMemorial(0);
    memorial.position.set(0, 0, 0);
    memorial.rotation.set(0, 0, 0);
    memorial.updateMatrixWorld(true);
    const size = new Box3().setFromObject(memorial).getSize(new Vector3());
    expect(size.x).toBeGreaterThanOrEqual(3);
    expect(size.x).toBeLessThan(3.12);
    expect(size.z).toBeGreaterThanOrEqual(2);
    expect(size.z).toBeLessThan(2.12);
    expect(size.y).toBeGreaterThan(2.17);
    expect(size.y).toBeLessThanOrEqual(2.25);
    expect(memorial.userData.geometryStatus).toContain("source-described");
    expect(memorial.userData.geometryStatus).toContain("not surveyed");
  });

  test("packages complete credits for all five CC BY 4.0 reference views", () => {
    expect(KINDERTRANSPORT_VISUAL_REFERENCES).toHaveLength(5);
    for (const reference of KINDERTRANSPORT_VISUAL_REFERENCES) {
      expect(reference).toMatchObject({
        artist: "Pauline Ahrens",
        license: "CC BY 4.0",
        year: 2021,
      });
      expect(reference.licenseUrl).toBe(
        "https://creativecommons.org/licenses/by/4.0/",
      );
      expect(reference.pageUrl).toContain("bildhauerei-in-berlin.de/bildwerk/");
      expect(reference.fileUrl).toContain(reference.title);
      expect(reference.role).toContain("not bundled");
    }
    expect(
      visualReferenceAttribution.records.map((record) => record.file_url),
    ).toEqual(
      KINDERTRANSPORT_VISUAL_REFERENCES.map((reference) => reference.fileUrl),
    );
    expect(visualReferenceAttribution.required_attribution).toBe(
      "Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)",
    );

    const memorial = createKindertransportMemorial();
    expect(memorial.userData.visualReferences).toEqual(
      KINDERTRANSPORT_VISUAL_REFERENCES,
    );
  });

  test("draws the two documented groups, luggage and single north rail", () => {
    const memorial = createKindertransportMemorial();
    expect(memorial.userData.figureCounts).toEqual({
      deportedAndMurderedBoys: 3,
      deportedAndMurderedGirls: 2,
      deportedAndMurdered: 5,
      rescued: 2,
      total: 7,
    });
    expect(memorial.userData.opposingDirections).toEqual({
      deportedAndMurdered: "east",
      rescued: "west",
    });
    expect(memorial.userData.railSide).toBe("north / station side");
    expect(memorial.userData.railStrandCount).toBe(1);
    expect(memorial.userData.railSleeperCount).toBe(8);
    expect(memorial.userData.luggageCount).toBe(8);
    expect(memorial.userData.openSuitcaseCount).toBe(1);
    expect(memorial.userData.endPlates).toEqual({
      sponsor: "west",
      title: "east",
    });
    expect(
      memorial.getObjectByName(
        "Kindertransport granite base and single north-side rail",
      ),
    ).toBeInstanceOf(Group);
    expect(
      memorial.getObjectByName("Kindertransport five grey-brown children"),
    ).toBeInstanceOf(Group);
    expect(
      memorial.getObjectByName("Kindertransport two red-brown children"),
    ).toBeInstanceOf(Group);
    expect(
      memorial.getObjectByName("Kindertransport separated luggage"),
    ).toBeInstanceOf(Group);

    const deathBody = memorial
      .getObjectByName("Kindertransport five grey-brown children")!
      .getObjectByName("monument bodies") as Mesh;
    const lifeBody = memorial
      .getObjectByName("Kindertransport two red-brown children")!
      .getObjectByName("monument bodies") as Mesh;
    expect(deathBody.material).not.toBe(lifeBody.material);
    expect(
      Array.from(deathBody.geometry.getAttribute("color").array).slice(0, 3),
    ).not.toEqual(
      Array.from(lifeBody.geometry.getAttribute("color").array).slice(0, 3),
    );
  });

  test("replaces the generic sculpture fallback exactly once", () => {
    const monuments = createTiergartenMonuments(
      { ...street, monuments: [sourceEntry] },
      ground,
    )!;
    const dedicated = childrenNamed(
      monuments,
      KINDERTRANSPORT_MEMORIAL_PROFILE.name,
    );
    expect(dedicated).toHaveLength(1);
    expect(bodyMeshes(dedicated[0])).toHaveLength(4);
    expect(monuments.userData.protectedRenderedSourceKeys).toEqual([
      KINDERTRANSPORT_MEMORIAL_OSM_KEY,
    ]);
    expect(monuments.userData.protectedExternallyModelledSourceKeys).toEqual(
      [],
    );
  });

  test("is visible in every drawn mode and stays exact Day in Schwellenraum", () => {
    const monuments = createTiergartenMonuments(
      { ...street, monuments: [sourceEntry] },
      ground,
    )!;
    const dedicated = monuments.getObjectByName(
      KINDERTRANSPORT_MEMORIAL_PROFILE.name,
    ) as Group;
    const body = bodyMeshes(dedicated)[0];
    const ink = dedicated.getObjectByName("monument ink lines") as LineSegments;

    setIsoNightPresentation(monuments, false, true, "day");
    const dayMaterial = body.material;
    const dayInk = (ink.material as LineBasicMaterial).color.getHex();
    const dayMatrix = dedicated.matrix.toArray();
    setIsoNightPresentation(monuments, true, true, "night");
    expect(body.material).not.toBe(dayMaterial);
    expect(dedicated.visible).toBeTrue();
    setIsoNightPresentation(monuments, false, true, "snowstorm");
    expect(body.material).toBe(dayMaterial);
    expect(dedicated.visible).toBeTrue();
    setIsoNightPresentation(monuments, false, true, "schwellenraum");
    expect(body.material).toBe(dayMaterial);
    expect((ink.material as LineBasicMaterial).color.getHex()).toBe(dayInk);
    expect(dedicated.matrix.toArray()).toEqual(dayMatrix);
    expect(dedicated.visible).toBeTrue();
    expect(dedicated.userData.schwellenraumGeschuetzt).toBeTrue();
  });

  test("blocks the complete memorial envelope in Schwellenraum", () => {
    const index = createSchwellenraumMemorialProtectionIndex([sourceEntry]);
    const [halfX, halfZ] =
      KINDERTRANSPORT_MEMORIAL_PROFILE.collisionHalfExtentsM;
    expect(index.shapes).toHaveLength(1);
    expect(index.shapes[0]).toMatchObject({
      halfDepthM: halfZ,
      halfWidthM: halfX,
      kind: "box",
      osmKey: KINDERTRANSPORT_MEMORIAL_OSM_KEY,
      x: 1108.3,
      z: -80.8,
    });
    expect(
      schwellenraumProtectedMemorialAt(
        index,
        1108.3 + halfX - 0.01,
        4,
        -80.8 + halfZ - 0.01,
      ),
    ).toBeTrue();
    expect(
      schwellenraumProtectedMemorialAt(index, 1108.3 + halfX + 0.01, 4, -80.8),
    ).toBeFalse();
  });
});
