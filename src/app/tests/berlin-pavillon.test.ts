import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Vector3,
} from "three";

import {
  BERLIN_PAVILLON_PROFILE,
  createBerlinPavillon,
} from "../src/BerlinPavillon";

describe("the LoD2-anchored Berlin Pavillon", () => {
  test("uses the current four-part official building shell", () => {
    expect(BERLIN_PAVILLON_PROFILE.lod2ParentBuildingId).toBe(
      "DEBE01YYK0002Pvf",
    );
    expect(BERLIN_PAVILLON_PROFILE.lod2PartIds).toEqual([
      "DEBE3DNLloEussQR",
      "DEBE3DDgAhATwErH",
      "DEBE3DgrmxDq2ssM",
      "DEBE3DdXH5BzPXTO",
    ]);
    expect(BERLIN_PAVILLON_PROFILE.footprintAreaM2).toBeCloseTo(599.35, 2);
    expect(BERLIN_PAVILLON_PROFILE.landmarkWorld).toEqual([
      157.11971173324855, 8, 160.52018948458135,
    ]);
    expect(BERLIN_PAVILLON_PROFILE.geometryStatus).toContain("LoD2");
    expect(BERLIN_PAVILLON_PROFILE.geometryStatus).toContain("approximations");
  });

  test("draws a stable transparent storefront in front of the merchandise", () => {
    const pavilion = createBerlinPavillon();
    const glass = pavilion.getObjectByName(
      "Berlin Pavillon transparent storefront glazing",
    ) as Mesh;
    expect(glass).toBeInstanceOf(Mesh);
    expect(glass.material).toBeInstanceOf(MeshPhysicalMaterial);
    expect((glass.material as MeshPhysicalMaterial).transparent).toBe(true);
    expect((glass.material as MeshPhysicalMaterial).depthWrite).toBe(false);
    expect(glass.renderOrder).toBe(8);
    expect(glass.userData.paneCount).toBe(20);
    expect(glass.userData.antiFlicker).toContain("0.21 m forward");
  });

  test("makes the souvenir shop and cafe legible without photo textures", () => {
    const pavilion = createBerlinPavillon();
    expect(
      pavilion.getObjectByName("Berlin Pavillon photo-bounded facade bodies"),
    ).toBeInstanceOf(Mesh);
    const interior = pavilion.getObjectByName(
      "Berlin Pavillon visible souvenir and cafe interior bodies",
    ) as Mesh;
    expect(interior).toBeInstanceOf(Mesh);
    expect(interior.userData.nightMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(interior.userData.nightMaterial.vertexColors).toBe(true);
    expect(
      pavilion.getObjectByName(
        "Berlin Pavillon visible souvenir and cafe interior lamps",
      ),
    ).toBeInstanceOf(Mesh);
    expect(BERLIN_PAVILLON_PROFILE.souvenirObjectCount).toBe(60);
    expect(BERLIN_PAVILLON_PROFILE.postcardRackCount).toBe(2);
    expect(BERLIN_PAVILLON_PROFILE.cafeTableCount).toBe(4);
    expect(BERLIN_PAVILLON_PROFILE.cafeChairCount).toBe(12);
    expect(BERLIN_PAVILLON_PROFILE.visualReferences[0].license).toBe(
      "CC BY-SA 4.0",
    );
  });

  test("keeps the shaded terrace and street furniture at human scale", () => {
    const pavilion = createBerlinPavillon();
    const terrace = pavilion.getObjectByName(
      "Berlin Pavillon shaded restaurant terrace",
    );
    expect(terrace).toBeInstanceOf(Group);
    expect(terrace?.userData.canopyCount).toBe(2);
    expect(BERLIN_PAVILLON_PROFILE.outdoorTableCount).toBe(5);
    expect(BERLIN_PAVILLON_PROFILE.outdoorChairCount).toBe(15);
    expect(BERLIN_PAVILLON_PROFILE.pedestrianBollardCount).toBe(16);
    const size = new Box3().setFromObject(pavilion).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(31);
    expect(size.x).toBeLessThan(34);
    expect(size.y).toBeGreaterThan(5.5);
    expect(size.y).toBeLessThan(6.5);
    expect(size.z).toBeLessThan(7.5);
  });

  test("provides the three photographed facade inscriptions", () => {
    const pavilion = createBerlinPavillon();
    const expected = [
      ["Berlin Pavillon cafe lettering", "CAFE"],
      ["Berlin Pavillon name lettering", "BERLIN PAVILLON"],
      ["Berlin Pavillon restaurant lettering", "RESTAURANT"],
    ] as const;
    for (const [name, text] of expected) {
      const sign = pavilion.getObjectByName(name) as Mesh;
      expect(sign).toBeInstanceOf(Mesh);
      expect(sign.userData.lettering).toBe(text);
      expect(sign.userData.visualReference).toContain("wikimedia.org");
    }
  });
});
