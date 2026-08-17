import { describe, expect, test } from "bun:test";

import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  BRIDGE_REFINEMENT_PROFILES,
  CITY_REFINEMENT_PROFILES,
  DETAIL_COVERAGE,
  MEMORIAL_REFINEMENT_PROFILES,
  createCityRecognitionRefinements,
} from "../src/CityRecognitionRefinements";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";

const payload = voxelPayload as unknown as VoxelPayload;

describe("source-audited city recognition refinements", () => {
  test("merges the presentation geometry into four stable draw batches", () => {
    const details = createCityRecognitionRefinements(payload);

    expect(details.children).toHaveLength(4);
    expect(details.userData.batchCount).toBe(4);
    expect(details.userData.geometryStatus).toContain("not a 10 cm survey");
  });

  test("keeps the northern station buildings on their measured anchors", () => {
    const total = CITY_REFINEMENT_PROFILES.tourTotal;
    const motel = CITY_REFINEMENT_PROFILES.motelOneHauptbahnhof;

    expect(total.heightM).toBe(68.8);
    expect(total.centreWorldM).toEqual([-106.99, -1067.47]);
    expect(motel.widthM).toBeCloseTo(50.59, 2);
    expect(CITY_REFINEMENT_PROFILES.parisMoskau.sourceUrls).toContain(
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050226",
    );
  });

  test("records published dimensions for the two refined park bridges", () => {
    expect(BRIDGE_REFINEMENT_PROFILES.adlerbruecke.lengthM).toBe(7.3);
    expect(BRIDGE_REFINEMENT_PROFILES.adlerbruecke.widthM).toBe(3.35);
    expect(BRIDGE_REFINEMENT_PROFILES.lutherbruecke.lengthM).toBeGreaterThan(
      70,
    );
  });

  test("pins the political memorials to distinct mapped positions", () => {
    expect(MEMORIAL_REFINEMENT_PROFILES.karlLiebknecht.worldM).not.toEqual(
      MEMORIAL_REFINEMENT_PROFILES.rosaLuxemburg.worldM,
    );
    expect(MEMORIAL_REFINEMENT_PROFILES.tritonbrunnen.worldM).toEqual([
      -833.99, 184.99,
    ]);
  });

  test("documents requested coverage without importing gated Google content", () => {
    expect(DETAIL_COVERAGE["Zollpackhof"]).toBe("RiversideVenues");
    expect(DETAIL_COVERAGE["Tilla-Durieux-Park"]).toContain("Tilla-Durieux");
    const details = createCityRecognitionRefinements(payload);
    const sources = details.userData.sourceUrls as string[];
    expect(sources.every((source) => !source.includes("google"))).toBe(true);
  });
});
