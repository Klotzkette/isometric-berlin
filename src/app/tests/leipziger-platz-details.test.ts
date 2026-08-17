import { describe, expect, test } from "bun:test";
import { Box3, Mesh, Raycaster, Vector3 } from "three";

import { createExpandedCityDetails } from "../src/ExpandedCityDetails";
import {
  createLeipzigerPlatzDetails,
  LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE,
  LEIPZIGER_PLATZ_PORTALS,
  leipzigerPlatzPortalAt,
} from "../src/LeipzigerPlatzDetails";

const GROUP_NAMES = {
  canada: "Canadian Embassy complete-parent facade overlays",
  magenta: "Magenta Mitte curved-band facade overlays",
  mall: "Mall of Berlin LoD2-bound facade overlays",
  taylor: "Taylor Wessing exact-parent facade overlays",
} as const;

function bodies(
  details: ReturnType<typeof createLeipzigerPlatzDetails>,
  name: string,
): Mesh {
  return details.getObjectByName(`${name} bodies`) as Mesh;
}

describe("Leipziger Platz source-bound architecture details", () => {
  test("keeps exact OSM and LoD2 identities in one metric registry", () => {
    const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE;
    expect(profile.renderingStrategy).toBe("component-bound-surface-overlays");
    expect(profile.maxOverlayDepthM).toBeLessThanOrEqual(0.32);

    expect(profile.mall.osmBuildingWayIds).toEqual([
      "194066303",
      "380104430",
    ]);
    expect(profile.mall.coveredPassage.osmRoofWayId).toBe("380104431");
    expect(profile.mall.lod2ParentIds).toEqual([
      "DEBE00YY1mc0002W",
      "DEBE00YY1mc0003Y",
      "DEBE01YYK00000lH",
    ]);
    expect(profile.mall.blocks.map((block) => block.partIds.length)).toEqual([
      4, 2, 20,
    ]);

    expect(profile.canada.lod2ParentId).toBe("DEBE01YYK000022A");
    expect(profile.canada.partIds).toHaveLength(13);
    expect(profile.canada.footprintAreaM2).toBeCloseTo(2_186.5, 1);
    expect(profile.canada.centerWorldM).toEqual([380.648, 945.665]);

    expect(profile.taylorWessing.lod2ParentId).toBe("DEBE01YYK00009eV");
    expect(profile.taylorWessing.centerWorldM).toEqual([376.463, 885.086]);
    expect(profile.taylorWessing.footprintSizeM).toEqual([25.23, 16.9]);
    expect(profile.taylorWessing.storeys).toBe(4);

    expect(profile.magentaMitte.lod2ParentId).toBe("DEBE01YYK0000B8N");
    expect(profile.magentaMitte.centerWorldM).toEqual([379.507, 854.014]);
    expect(profile.magentaMitte.footprintSizeM).toEqual([23.4, 16.65]);
    expect(profile.magentaMitte.storeys).toBe(6);
    expect(profile.magentaMitte.brandMagentaHex).toBe("#e20074");
  });

  test("binds every rendered facade run to a part of its named parent", () => {
    const profile = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE;
    const mallParts = new Set(
      profile.mall.blocks.flatMap((block) => [...block.partIds]),
    );
    for (const run of profile.mall.facadeRuns) {
      expect(mallParts.has(run.sourcePartId)).toBe(true);
    }
    for (const [runs, ids] of [
      [profile.canada.facadeRuns, profile.canada.partIds],
      [profile.taylorWessing.facadeRuns, profile.taylorWessing.partIds],
      [profile.magentaMitte.facadeRuns, profile.magentaMitte.partIds],
    ] as const) {
      const parts = new Set<string>(ids);
      for (const run of runs) {
        expect(parts.has(run.sourcePartId)).toBe(true);
        expect(Math.hypot(
          run.endWorldM[0] - run.startWorldM[0],
          run.endWorldM[1] - run.startWorldM[1],
        )).toBeGreaterThan(4);
        expect(run.measuredHeightM).toBeGreaterThan(8);
      }
    }
  });

  test("builds four independently inspectable thin detail groups", () => {
    const details = createLeipzigerPlatzDetails();
    expect(details.children.map((child) => child.name)).toEqual([
      GROUP_NAMES.mall,
      GROUP_NAMES.canada,
      GROUP_NAMES.taylor,
      GROUP_NAMES.magenta,
    ]);
    expect(details.userData.collisionPolicy).toContain("do not enter");
    expect(details.userData.portals).toEqual(LEIPZIGER_PLATZ_PORTALS);

    for (const name of Object.values(GROUP_NAMES)) {
      const mesh = bodies(details, name);
      expect(mesh).toBeInstanceOf(Mesh);
      expect(mesh.geometry.getAttribute("color").count).toBeGreaterThan(100);
      expect(details.getObjectByName(`${name} ink lines`)).toBeDefined();
    }
  });

  test("covers both Mall blocks and the measured round-roof axis", () => {
    const details = createLeipzigerPlatzDetails();
    const mall = details.getObjectByName(GROUP_NAMES.mall)!;
    const bounds = new Box3().setFromObject(mall);
    expect(bounds.min.x).toBeCloseTo(483.5, 0);
    expect(bounds.max.x).toBeCloseTo(821.6, 0);
    expect(bounds.min.z).toBeCloseTo(860.4, 0);
    expect(bounds.max.z).toBeCloseTo(1023.1, 0);
    expect(bounds.max.y).toBeCloseTo(24.06, 1);

    const passage = LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.mall.coveredPassage;
    expect(passage.spanM).toBeCloseTo(24.06, 2);
    expect(passage.lengthM).toBeCloseTo(75.18, 2);
    expect(Math.hypot(...passage.axis)).toBeCloseTo(1, 3);
  });

  test("uses the complete Canadian parent rather than its narrow OSM component", () => {
    const details = createLeipzigerPlatzDetails();
    const bounds = new Box3().setFromObject(
      details.getObjectByName(GROUP_NAMES.canada)!,
    );
    expect(bounds.min.x).toBeLessThan(354);
    expect(bounds.max.x).toBeGreaterThan(404.5);
    expect(bounds.min.z).toBeLessThan(918);
    expect(bounds.max.z).toBeGreaterThan(984.5);
    expect(bounds.max.y).toBeCloseTo(33.43, 1);
    expect(
      LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.canada.sources.some((source) =>
        source.includes("kpmb.com"),
      ),
    ).toBe(true);
  });

  test("keeps corrected Taylor geometry inside the 25 by 17 metre parent", () => {
    const details = createLeipzigerPlatzDetails();
    const taylor = details.getObjectByName(GROUP_NAMES.taylor)!;
    const bounds = new Box3().setFromObject(taylor);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(26);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(20);
    expect(bounds.max.y).toBeLessThan(25.1);
    expect(
      taylor.getObjectByName("Taylor Wessing facade lettering"),
    ).toBeDefined();
  });

  test("renders six glazed Magenta levels, curved bands and a roof terrace", () => {
    const details = createLeipzigerPlatzDetails();
    const magenta = details.getObjectByName(GROUP_NAMES.magenta)!;
    const bounds = new Box3().setFromObject(magenta);
    expect(bounds.max.y).toBeCloseTo(27.61, 1);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(24);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(20);
    expect(
      LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.magentaMitte.sources.some(
        (source) => source.includes("telekom.com"),
      ),
    ).toBe(true);
  });

  test("leaves building centres hollow instead of adding replacement boxes", () => {
    const details = createLeipzigerPlatzDetails();
    for (const [name, center] of [
      [GROUP_NAMES.mall, [563.374, 957.736]],
      [GROUP_NAMES.canada, [380.648, 945.665]],
      [GROUP_NAMES.taylor, [376.463, 885.086]],
      [GROUP_NAMES.magenta, [379.507, 854.014]],
    ] as const) {
      const raycaster = new Raycaster(
        new Vector3(center[0], 60, center[1]),
        new Vector3(0, -1, 0),
      );
      expect(
        raycaster.intersectObject(bodies(details, name), false),
      ).toHaveLength(0);
    }
  });

  test("exports source-filtered portal contracts without changing collision", () => {
    const mall = LEIPZIGER_PLATZ_PORTALS[0];
    expect(
      leipzigerPlatzPortalAt(
        mall.centerWorldM[0],
        mall.centerWorldM[1],
        mall.centerWorldM[2],
        "h1IwtXlI",
      )?.id,
    ).toBe("mall-covered-piazza-axis");
    expect(
      leipzigerPlatzPortalAt(
        mall.centerWorldM[0],
        mall.centerWorldM[1],
        mall.centerWorldM[2],
        "DEBE3DAuPHF6qQ7w",
      )?.id,
    ).toBe("mall-covered-piazza-axis");
    expect(
      leipzigerPlatzPortalAt(
        mall.centerWorldM[0],
        mall.centerWorldM[1],
        mall.centerWorldM[2],
        "unrelated-building",
      ),
    ).toBeNull();
    expect(leipzigerPlatzPortalAt(0, 10, 0)).toBeNull();
  });

  test("integrates once and replaces the old Taylor double", () => {
    const details = createExpandedCityDetails([
      {
        name: "Mall of Berlin",
        world: [633.506, 5.1, 953.597],
      },
    ]);
    expect(
      details.getObjectByName(
        "Leipziger Platz source-bound architecture details",
      ),
    ).toBeDefined();
    expect(details.getObjectByName(GROUP_NAMES.mall)).toBeDefined();
    expect(details.getObjectByName(GROUP_NAMES.canada)).toBeDefined();
    expect(details.getObjectByName(GROUP_NAMES.taylor)).toBeDefined();
    expect(details.getObjectByName(GROUP_NAMES.magenta)).toBeDefined();
    expect(
      details.getObjectByName("Taylor Wessing facade lettering"),
    ).toBeDefined();
    expect(details.userData.leipzigerPlatzArchitecture).toEqual(
      LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE,
    );
  });
});
