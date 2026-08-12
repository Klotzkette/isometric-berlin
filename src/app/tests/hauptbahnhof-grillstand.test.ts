import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

import {
  HAUPTBAHNHOF_GRILLSTAND_PROFILE,
  createHauptbahnhofGrillstand,
} from "../src/HauptbahnhofGrillstand";
import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import railJson from "../public/mesh/regierungsviertel/rail-lines.json";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";

const ground = groundJson as unknown as VoxelPayload;
const rail = railJson as unknown as { deck_top_y_m: number };

function grillstand(): Group {
  const result = createHauptbahnhofGrillstand(ground, rail);
  if (!(result instanceof Group)) {
    throw new Error("the Grillstand HBF model must fit below the viaduct");
  }
  return result;
}

describe("the OSM-anchored Grillstand HBF", () => {
  test("pins its centre to OSM node/2231321435", () => {
    const kiosk = grillstand();
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.sourceEpsg25833).toEqual([
      389289.797799, 5820630.088062,
    ]);
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.world).toEqual([
      -210.202201, -630.088062,
    ]);
    expect(kiosk.position.x).toBeCloseTo(
      HAUPTBAHNHOF_GRILLSTAND_PROFILE.world[0],
      6,
    );
    expect(kiosk.position.z).toBeCloseTo(
      HAUPTBAHNHOF_GRILLSTAND_PROFILE.world[1],
      6,
    );
    expect(kiosk.userData.profile.osmNodeId).toBe("2231321435");
    expect(kiosk.userData.geometryStatus).toContain("not surveyed geometry");
  });

  test("keeps the whole kiosk below the measured rail deck", () => {
    const kiosk = grillstand();
    const bounds = new Box3().setFromObject(kiosk);
    expect(kiosk.userData.groundY).toBeCloseTo(4.8, 4);
    expect(bounds.min.y).toBeGreaterThanOrEqual(kiosk.userData.groundY - 0.02);
    expect(bounds.max.y).toBeLessThan(kiosk.userData.deckUndersideY);
    expect(kiosk.userData.clearanceM).toBeGreaterThanOrEqual(
      HAUPTBAHNHOF_GRILLSTAND_PROFILE.deckClearanceM,
    );
  });

  test("draws the photo-recognition fixtures without copied textures", () => {
    const kiosk = grillstand();
    expect(
      kiosk.getObjectByName("Grillstand HBF detailed kiosk bodies"),
    ).toBeInstanceOf(Mesh);
    expect(
      kiosk.getObjectByName("Grillstand HBF detailed kiosk lamps"),
    ).toBeInstanceOf(Mesh);
    expect(
      kiosk.getObjectByName("Grillstand HBF static patio light strings"),
    ).toBeInstanceOf(Group);
    expect(
      kiosk.getObjectByName("Grillstand HBF light-string cables"),
    ).toBeInstanceOf(LineSegments);
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.fairyLightCount).toBe(20);
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.pedestrianBollardCount).toBe(7);
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.outdoorTableCount).toBe(2);
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.outdoorChairCount).toBe(6);
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.menuPosterCount).toBe(4);
    expect(HAUPTBAHNHOF_GRILLSTAND_PROFILE.coolerDoorCount).toBe(3);
  });

  test("carries stable day and night lettering for the photographed signs", () => {
    const kiosk = grillstand();
    const expected = [
      ["Grillstand HBF front fascia lettering", "GRILLSTAND"],
      ["Grillstand HBF front DB-style badge", "HBF"],
      [
        "Grillstand HBF menu strip lettering",
        "DOENER NUDELBOX BURGER SALAT",
      ],
      ["Grillstand HBF east side lettering", "GRILLSTAND"],
    ] as const;
    for (const [name, lettering] of expected) {
      const sign = kiosk.getObjectByName(name) as Mesh;
      expect(sign).toBeInstanceOf(Mesh);
      expect(sign.userData.lettering).toBe(lettering);
      expect(sign.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(sign.userData.nightMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(sign.userData.visualReference).toContain("owner-supplied");
      expect((sign.material as MeshBasicMaterial).map).toBeNull();
    }
  });

  test("uses the mapped street axis rather than an arbitrary station axis", () => {
    const kiosk = grillstand();
    expect(kiosk.rotation.y).toBeCloseTo(
      (HAUPTBAHNHOF_GRILLSTAND_PROFILE.streetAxisDegrees * Math.PI) / 180,
      8,
    );
    const size = new Box3().setFromObject(kiosk).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(20);
    expect(size.z).toBeGreaterThan(9);
    expect(size.y).toBeLessThan(5);
  });
});
