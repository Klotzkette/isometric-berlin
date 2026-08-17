import { describe, expect, test } from "bun:test";
import {
  Box3,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";

import { createExpandedCityDetails } from "../src/ExpandedCityDetails";
import {
  FEDERAL_STATE_REPRESENTATION_FALLBACK_SUPPRESSION_IDS,
  FEDERAL_STATE_REPRESENTATION_SOURCE_REGISTRY,
  FEDERAL_STATE_REPRESENTATIONS,
  createFederalStateRepresentations,
  federalStateRepresentationSolidAt,
} from "../src/FederalStateRepresentations";
import {
  PRISM_SUPPRESSED_IDS,
  createIsometricCity,
  setIsoNightPresentation,
} from "../src/IsometricCityWorld";

const EXPECTED_STATE_CODES = [
  "BB",
  "BW",
  "BY",
  "HB",
  "HE",
  "HH",
  "MV",
  "NI",
  "NW",
  "RP",
  "SH",
  "SL",
  "SN",
  "ST",
  "TH",
] as const;

function groupName(id: string): string {
  return `Federal state representation ${id}`;
}

function body(root: ReturnType<typeof createFederalStateRepresentations>, id: string): Mesh {
  return root.getObjectByName(`${groupName(id)} bodies`) as Mesh;
}

describe("federal-state representations", () => {
  test("registers all 15 Länder at exactly 13 shared or individual houses", () => {
    expect(FEDERAL_STATE_REPRESENTATIONS).toHaveLength(13);
    expect(
      FEDERAL_STATE_REPRESENTATIONS.flatMap((site) => [...site.stateCodes]).sort(),
    ).toEqual([...EXPECTED_STATE_CODES]);

    const bbmv = FEDERAL_STATE_REPRESENTATIONS.find(
      (site) => site.id === "brandenburg-mecklenburg-vorpommern",
    )!;
    expect(bbmv.stateCodes).toEqual(["BB", "MV"]);
    expect(bbmv.states).toEqual(["Brandenburg", "Mecklenburg-Vorpommern"]);
    expect(bbmv.lod2?.parentId).toBe("DEBE01YYK00001YS");

    const nish = FEDERAL_STATE_REPRESENTATIONS.find(
      (site) => site.id === "niedersachsen-schleswig-holstein",
    )!;
    expect(nish.stateCodes).toEqual(["NI", "SH"]);
    expect(nish.states).toEqual(["Niedersachsen", "Schleswig-Holstein"]);
    expect(nish.lod2?.parentId).toBe("DEBE01YYK00002Rc");
  });

  test("exports exact OSM and LoD2 identities with primary source links", () => {
    const byId = new Map(
      FEDERAL_STATE_REPRESENTATIONS.map((site) => [site.id, site]),
    );
    expect(byId.get("baden-wuerttemberg")?.lod2?.partIds).toHaveLength(13);
    expect(byId.get("bayern")?.lod2?.parentId).toBe("DEBE01YYK0000Dr4");
    expect(byId.get("hessen")?.lod2?.parentId).toBe("DEBE01YYK00002M9");
    expect(byId.get("nordrhein-westfalen")?.lod2?.partIds).toEqual([
      "DEBE01YYK0002MFj",
    ]);
    expect(byId.get("rheinland-pfalz")?.lod2?.partIds).toHaveLength(12);
    expect(byId.get("sachsen-anhalt")?.osm.buildingWayIds).toEqual([
      "105352786",
    ]);
    expect(byId.get("thueringen")?.lod2?.parentId).toBe(
      "DEBE01YYK00004h2",
    );
    expect(byId.get("thueringen")?.address).toBe(
      "Anton-Wilhelm-Amo-Straße 64, 10117 Berlin",
    );

    const hamburg = byId.get("hamburg")!;
    expect(hamburg.address).toContain("1–3");
    expect(hamburg.osm.buildingWayIds).toEqual(["32699537"]);
    expect(hamburg.osm.poiNodeIds).toEqual(["2497234679", "609711392"]);
    expect(hamburg.lod2?.parentId).toBe("DEBE01YYK00003Lc");

    for (const site of FEDERAL_STATE_REPRESENTATIONS) {
      expect(site.sources.length).toBeGreaterThan(0);
      for (const source of site.sources) {
        expect(source.url.startsWith("https://")).toBe(true);
      }
      expect(FEDERAL_STATE_REPRESENTATION_SOURCE_REGISTRY[site.id]).toBeDefined();
    }
  });

  test("binds every surveyed façade to its parent part", () => {
    for (const site of FEDERAL_STATE_REPRESENTATIONS) {
      expect(site.facadeRuns.length).toBeGreaterThanOrEqual(4);
      const partIds = new Set(site.lod2?.partIds ?? []);
      for (const facade of site.facadeRuns) {
        expect(
          site.lod2 === null
            ? facade.sourcePartId.startsWith("OSM-way-")
            : partIds.has(facade.sourcePartId),
        ).toBe(true);
        expect(
          Math.hypot(
            facade.endWorldM[0] - facade.startWorldM[0],
            facade.endWorldM[1] - facade.startWorldM[1],
          ),
        ).toBeGreaterThan(4);
        expect(facade.measuredHeightM).toBeGreaterThan(7);
      }
    }
  });

  test("labels Bremen and Sachsen as source-bounded, not surveyed LoD2", () => {
    const bremen = FEDERAL_STATE_REPRESENTATIONS.find(
      (site) => site.id === "bremen",
    )!;
    expect(bremen.lod2).toBeNull();
    expect(bremen.osm.buildingWayIds).toEqual(["24045937"]);
    expect(bremen.geometryStatus).toContain("no official LoD2 measurement");
    expect(bremen.manualMassing?.footprintRingWorldM).toHaveLength(14);
    expect(bremen.footprint.axisAlignedBboxSizeM).toEqual([54.7, 38.2]);
    expect(new Set(bremen.facadeRuns.map((facade) => facade.storeys))).toEqual(
      new Set([8, 4]),
    );

    const saxony = FEDERAL_STATE_REPRESENTATIONS.find(
      (site) => site.id === "sachsen",
    )!;
    expect(saxony.lod2).toBeNull();
    expect(saxony.osm.buildingWayIds).toEqual(["23075521"]);
    expect(saxony.geometryStatus).toContain("not an available LoD2 survey");
    expect(saxony.manualMassing?.footprintRingWorldM).toHaveLength(15);
    expect(saxony.footprint.axisAlignedBboxSizeM).toEqual([48.9, 45.6]);
    expect(saxony.facadeRuns[0].storeys).toBe(4);
    expect(saxony.facadeRuns[0].bayCount).toBe(7);
    expect(saxony.footprint.heightRangeM).toEqual([18.2, 18.2]);
  });

  test("suppresses only the two named false-height OSM fallback shells", () => {
    expect(FEDERAL_STATE_REPRESENTATION_FALLBACK_SUPPRESSION_IDS).toEqual([
      "24045937",
      "23075521",
    ]);
    for (const id of FEDERAL_STATE_REPRESENTATION_FALLBACK_SUPPRESSION_IDS) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(true);
    }
    expect(PRISM_SUPPRESSED_IDS.has("15792001")).toBe(false);
  });

  test("builds 13 inspectable, metrically placed recognition groups", () => {
    const root = createFederalStateRepresentations();
    expect(root.children).toHaveLength(13);
    expect(root.userData.collisionPolicy).toContain("closed full-height manual solids");

    for (const site of FEDERAL_STATE_REPRESENTATIONS) {
      const siteGroup = root.getObjectByName(groupName(site.id))!;
      const mesh = body(root, site.id);
      const bounds = new Box3().setFromObject(siteGroup);
      expect(mesh).toBeInstanceOf(Mesh);
      expect(mesh.userData.federalStateRepresentation).toBe(true);
      expect(mesh.userData.stateCodes).toEqual(site.stateCodes);
      expect(mesh.geometry.getAttribute("color").count).toBeGreaterThan(3_000);
      expect(root.getObjectByName(`${groupName(site.id)} ink lines`)).toBeDefined();
      expect(bounds.min.x).toBeLessThan(site.centerWorldM[0]);
      expect(bounds.max.x).toBeGreaterThan(site.centerWorldM[0]);
      expect(bounds.min.z).toBeLessThan(site.centerWorldM[1]);
      expect(bounds.max.z).toBeGreaterThan(site.centerWorldM[1]);
    }
  });

  test("keeps the 11 official LoD2 centres free of replacement roof boxes", () => {
    const root = createFederalStateRepresentations();
    for (const site of FEDERAL_STATE_REPRESENTATIONS.filter(
      (candidate) => candidate.lod2 !== null,
    )) {
      const ray = new Raycaster(
        new Vector3(site.centerWorldM[0], 80, site.centerWorldM[1]),
        new Vector3(0, -1, 0),
      );
      expect(ray.intersectObject(body(root, site.id), false)).toHaveLength(0);
    }
  });

  test("closes Bremen and Sachsen at their full authored height and exports collision", () => {
    const root = createFederalStateRepresentations();
    for (const siteValue of FEDERAL_STATE_REPRESENTATIONS) {
      if (!("manualMassing" in siteValue)) continue;
      const [x, y, z] = siteValue.manualMassing.solidProbeWorldM;
      const roofHits = new Raycaster(
        new Vector3(x, 80, z),
        new Vector3(0, -1, 0),
      ).intersectObject(body(root, siteValue.id), false);
      expect(roofHits.length).toBeGreaterThan(0);
      expect(roofHits[0].point.y).toBeCloseTo(
        Math.max(...siteValue.manualMassing.zones.map((zone) => zone.topYM)),
        1,
      );
      expect(federalStateRepresentationSolidAt(x, y, z)).toBe(true);
      expect(federalStateRepresentationSolidAt(x, 80, z)).toBe(false);
    }
    expect(federalStateRepresentationSolidAt(-962.2, 20, 1232, 0.8)).toBe(
      true,
    );
    expect(federalStateRepresentationSolidAt(0, 10, 0, 2)).toBe(false);
  });

  test("uses the shared day/night presentation contract", () => {
    const root = createFederalStateRepresentations();
    const hessen = body(root, "hessen");
    expect(hessen.material).toBe(hessen.userData.dayMaterial as MeshBasicMaterial);

    setIsoNightPresentation(root, true, true, "night");
    expect(hessen.material).toBe(
      hessen.userData.nightMaterial as MeshStandardMaterial,
    );
    setIsoNightPresentation(root, false, true, "day");
    expect(hessen.material).toBe(hessen.userData.dayMaterial as MeshBasicMaterial);
  });

  test("integrates exactly once in the city and leaves no opaque Hessen double", () => {
    const city = createIsometricCity(
      {
        buildings: [
          {
            class: 0,
            h_dm: 80,
            id: "federal-state-integration-fixture",
            ring: [
              [-20, -20],
              [20, -20],
              [20, 20],
              [-20, 20],
            ],
            roof: 1000,
            y0_dm: 52,
          },
        ],
        classes: ["concrete"],
        schema_version: 1,
      },
      null,
    );
    expect(
      city.children.filter(
        (child) =>
          child.name === "Federal state representations source-bound details",
      ),
    ).toHaveLength(1);

    const expanded = createExpandedCityDetails([
      { name: "Mall of Berlin", world: [633.506, 5.1, 953.597] },
    ]);
    const hessenRay = new Raycaster(
      new Vector3(455.937, 80, 780.79),
      new Vector3(0, -1, 0),
    );
    const hessenHits: unknown[] = [];
    expanded.traverse((object) => {
      if (object instanceof Mesh) {
        hessenHits.push(...hessenRay.intersectObject(object, false));
      }
    });
    expect(hessenHits).toHaveLength(0);
  });
});
