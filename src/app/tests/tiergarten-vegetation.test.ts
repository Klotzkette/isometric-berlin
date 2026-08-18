import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";

import parkDetailsJson from "../public/mesh/regierungsviertel/park-details.json";
import {
  createParkDetails,
  decodeTrees,
  type ParkDetailsPayload,
} from "../src/ParkDetails";

const payload = parkDetailsJson as unknown as ParkDetailsPayload & {
  sources: {
    tiergarten_vegetation: {
      available: boolean;
      license: string;
      metrics: Record<string, number>;
      park_relation_url: string;
    };
  };
};

describe("source-bounded Großer Tiergarten vegetation", () => {
  test("retains exact source inventory and veteran-tree dimensions", () => {
    expect(payload.schema_version).toBe(7);
    expect(payload.sources.tiergarten_vegetation.available).toBeTrue();
    expect(payload.sources.tiergarten_vegetation.license).toBe("ODbL-1.0");
    expect(payload.sources.tiergarten_vegetation.park_relation_url).toContain(
      "/relation/7643526",
    );
    expect(payload.sources.tiergarten_vegetation.metrics).toEqual({
      hedge_area_count: 2,
      hedge_area_m2: 526.8,
      hedge_line_count: 21,
      hedge_line_length_m: 1099.2,
      scrub_area_count: 83,
      scrub_area_m2: 106628.5,
    });
    expect(payload.shrub_patches).toHaveLength(83);
    expect(payload.hedges).toHaveLength(23);
    const trees = decodeTrees(payload.trees, payload.tree_vocabulary);
    expect(Math.max(...trees.map((tree) => tree.height_m))).toBe(35);
    expect(trees.some((tree) => tree.crown_radius_m === 12.5)).toBeTrue();
    expect(trees.some((tree) => tree.trunk_radius_m === 1.426)).toBeTrue();
  });

  test("adds diverse understorey in a bounded number of instanced draw calls", () => {
    const park = createParkDetails(payload, { settledDetail: false });
    expect(park.userData.shrubPatchCount).toBe(83);
    expect(park.userData.shrubClusterCount).toBe(3535);
    expect(park.userData.hedgeCount).toBe(23);
    expect(park.userData.hedgeSegmentCount).toBe(691);
    expect(park.userData.hedgeAreaClusterCount).toBe(208);
    expect(
      park.getObjectByName(
        "OSM exact Großer Tiergarten scrub-area footprints",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      park.getObjectByName("OSM polygon-bounded diverse Tiergarten shrub clumps"),
    ).toBeInstanceOf(InstancedMesh);
    expect(
      (
        park.getObjectByName(
          "OSM polygon-bounded diverse Tiergarten shrub clumps",
        ) as InstancedMesh
      ).count,
    ).toBe(3535);
    expect(
      (
        park.getObjectByName("OSM finite Tiergarten hedge course bodies") as
          | InstancedMesh
          | undefined
      )?.count,
    ).toBe(691);
    const addedVegetationMeshes = park.children.filter(
      (child) => child.userData.vegetation === true,
    );
    expect(addedVegetationMeshes.length).toBeLessThanOrEqual(7);
    const snow = park.getObjectByName(
      "Snowstorm-only Tiergarten shrub and hedge caps",
    );
    expect(snow?.userData.snowOnly).toBeTrue();
    expect(snow?.visible).toBeFalse();
  });
});
