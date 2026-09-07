import { describe, expect, test } from "bun:test";
import { Group, Mesh } from "three";
import { createAbgeordnetenhausDetails } from "../src/AbgeordnetenhausDetails";
import { createGropiusBauDetails } from "../src/GropiusBauDetails";
import { ABGEORDNETENHAUS_PROFILE } from "../src/abgeordnetenhausProfile";
import { GROPIUS_BAU_PRISM_IDS } from "../src/gropiusBauProfile";
import {
  HERO_PRISM_ROOF_TONES, HERO_PRISM_TONES, PRISM_SUPPRESSED_IDS,
  setIsoNightPresentation,
} from "../src/IsometricCityWorld";
import {
  splitProgressiveBuildings, DESKTOP_INITIAL_BUILDING_COUNT,
  MOBILE_INITIAL_BUILDING_COUNT, DESKTOP_TOTAL_BUILDING_LIMIT,
  MOBILE_TOTAL_BUILDING_LIMIT, PROGRESSIVE_BUILDING_BATCH_SIZE,
} from "../src/progressiveWorld";

describe("civic buildings in the assembled viewer", () => {
  test("both runtime partitions retain all four exact Gropius parts from the first frame", async () => {
    const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json();
    for (const full of [true, false]) {
      const initialCount = full ? DESKTOP_INITIAL_BUILDING_COUNT : MOBILE_INITIAL_BUILDING_COUNT;
      const totalLimit = full ? DESKTOP_TOTAL_BUILDING_LIMIT : MOBILE_TOTAL_BUILDING_LIMIT;
      const partition = splitProgressiveBuildings(payload.buildings, initialCount,
        PROGRESSIVE_BUILDING_BATCH_SIZE, totalLimit, full);
      expect(partition.initial).toHaveLength(initialCount);
      expect(partition.initial.length + partition.remaining.flat().length).toBe(totalLimit);
      for (const id of GROPIUS_BAU_PRISM_IDS) {
        expect(partition.initial.some(part => part.id === id)).toBeTrue();
        expect(partition.omitted.some(part => part.id === id)).toBeFalse();
        expect(partition.remaining.flat().some(part => part.id === id)).toBeFalse();
      }
    }
  });
  test("replaces only the defective main envelope while retaining Gropius source parts", () => {
    expect(PRISM_SUPPRESSED_IDS.has(ABGEORDNETENHAUS_PROFILE.mainPrismId)).toBeTrue();
    for (const id of GROPIUS_BAU_PRISM_IDS) expect(PRISM_SUPPRESSED_IDS.has(id)).toBeFalse();
    expect(HERO_PRISM_TONES.RQLhhnrF).toBe(0xb97962);
    expect(HERO_PRISM_ROOF_TONES.RQLhhnrF).toBe(0x757c77);
  });

  test("actual city lighting switches every new mesh and restores its authored day material", () => {
    const city = new Group();
    city.add(createAbgeordnetenhausDetails("mobile"), createGropiusBauDetails("mobile"));
    const meshes: Mesh[] = [];
    city.traverse((object) => { if (object instanceof Mesh) meshes.push(object); });
    expect(meshes.length).toBeGreaterThan(5);
    for (const mode of ["night", "day", "schwellenraum", "snowstorm", "day"] as const) {
      setIsoNightPresentation(city, mode === "night", true, mode);
      for (const mesh of meshes) {
        expect(mesh.visible).toBeTrue();
        if (mode === "night") expect(mesh.material).toBe(mesh.userData.nightMaterial);
        else if (mode === "schwellenraum") expect(mesh.material).not.toBe(mesh.userData.nightMaterial);
        else expect(mesh.material).toBe(mesh.userData.dayMaterial);
      }
    }
  });
});
