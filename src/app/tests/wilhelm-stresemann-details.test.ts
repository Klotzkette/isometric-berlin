import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { LineSegments, Mesh } from "three";

import {
  createWilhelmStresemannDetails,
  WILHELM_STRESEMANN_DETAIL_PROFILE,
  WILHELM_STRESEMANN_DETAILS_GROUP_NAME,
} from "../src/WilhelmStresemannDetails";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";

const prisms = JSON.parse(
  readFileSync(
    new URL(
      "../public/mesh/regierungsviertel/lod2-prisms.json",
      import.meta.url,
    ),
    "utf8",
  ),
).buildings as {
  h_dm: number;
  id: string;
  ring: [number, number][];
  y0_dm: number;
}[];
const byId = new Map(prisms.map((prism) => [prism.id, prism]));

describe("Wilhelmstrasse and Stresemannstrasse recognition detail", () => {
  test("binds every facade run to one exact LoD2 edge", () => {
    const profile = WILHELM_STRESEMANN_DETAIL_PROFILE;
    expect(profile.maxOverlayDepthM).toBeLessThanOrEqual(0.32);
    expect(profile.buildings.map(({ parentId }) => parentId)).toEqual([
      "DEBE01AL1H500002",
      "DEBE01AL1H500005",
      "DEBE01YYK00005zY",
      "DEBE01YYK00001Te",
      "DEBE01YYK000028X",
    ]);
    for (const building of profile.buildings) {
      for (const run of building.runs) {
        const prism = byId.get(run.sourcePartId)!;
        expect(prism, `${building.name}/${run.sourcePartId}`).toBeDefined();
        expect(run.groundYM).toBeCloseTo(prism.y0_dm / 10, 1);
        expect(run.measuredHeightM).toBeCloseTo(prism.h_dm / 10, 1);
        const start = run.startWorldM.map((value) => Math.round(value * 10));
        const end = run.endWorldM.map((value) => Math.round(value * 10));
        const edge = prism.ring.findIndex(
          ([x, z]) => x === start[0] && z === start[1],
        );
        expect(
          edge,
          `${building.name}/${run.sourcePartId}/edge`,
        ).toBeGreaterThanOrEqual(0);
        expect(prism.ring[(edge + 1) % prism.ring.length]).toEqual(end);
      }
    }
  });

  test("keeps the exact mapped tennis footprint and current HIT identity", () => {
    expect(WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt).toMatchObject({
      osmWayId: "323827330",
      surface: "rubber",
    });
    expect(
      WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt.worldRingM,
    ).toHaveLength(4);
    expect(WILHELM_STRESEMANN_DETAIL_PROFILE.hit).toMatchObject({
      officialAddress: "Anton-Wilhelm-Amo-Strasse 69, 10117 Berlin",
      osmNodeId: "1588155369",
      worldM: [827.971, 811.243],
    });
  });

  test("merges the richer desktop layer into five or fewer renderables", () => {
    const group = createWilhelmStresemannDetails("full");
    expect(group.name).toBe(WILHELM_STRESEMANN_DETAILS_GROUP_NAME);
    expect(FINE_DETAIL_LAYER_NAMES).toContain(
      WILHELM_STRESEMANN_DETAILS_GROUP_NAME,
    );
    let renderables = 0;
    let mappedMaterials = 0;
    group.traverse((object) => {
      if (!(object instanceof Mesh) && !(object instanceof LineSegments))
        return;
      renderables += 1;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      mappedMaterials += materials.filter((material) => material.map).length;
    });
    expect(renderables).toBeLessThanOrEqual(group.userData.renderableBudget);
    expect(mappedMaterials).toBeLessThanOrEqual(
      group.userData.textureCountBudget,
    );
    expect(
      group.getObjectByName("Former Fuehrerbunker exact OSM tennis court"),
    ).toBeDefined();
    expect(
      group.getObjectByName("HIT Ullrich exact-facade lettering"),
    ).toBeDefined();
  });

  test("uses the same source geometry with a coarser mobile facade rhythm", () => {
    const full = createWilhelmStresemannDetails("full");
    const mobile = createWilhelmStresemannDetails("mobile");
    const vertices = (group: typeof full): number => {
      let count = 0;
      group.traverse((object) => {
        if (!(object instanceof Mesh) && !(object instanceof LineSegments))
          return;
        count += object.geometry.getAttribute("position").count;
      });
      return count;
    };
    expect(vertices(mobile)).toBeLessThan(vertices(full));
    expect(mobile.userData.keepInMinecraft).toBeFalse();
  });

  test("replaces the old embassy box with exactly one integrated source layer", () => {
    const expanded = createExpandedCityDetails([
      { name: "Mall of Berlin", world: [633.506, 5.1, 953.597] },
    ]);
    const matches: string[] = [];
    expanded.traverse((object) => {
      if (object.name === WILHELM_STRESEMANN_DETAILS_GROUP_NAME) {
        matches.push(object.uuid);
      }
    });
    expect(matches).toHaveLength(1);
    expect(expanded.userData.wilhelmStresemannArchitecture).toEqual(
      WILHELM_STRESEMANN_DETAIL_PROFILE,
    );
  });
});
