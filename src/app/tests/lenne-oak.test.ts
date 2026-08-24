import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, LineSegments, Mesh, Vector3 } from "three";

import parkDetailsJson from "../public/mesh/regierungsviertel/park-details.json";
import {
  createLenneOak,
  isLenneOakTree,
  LENNE_OAK_PROFILE,
} from "../src/LenneOak";
import {
  createParkDetails,
  decodeTrees,
  setParkSnowPresentation,
  type ParkDetailsPayload,
  type ParkTree,
} from "../src/ParkDetails";

const payload = parkDetailsJson as unknown as ParkDetailsPayload;

function sourceOak(): ParkTree {
  const tree = decodeTrees(payload.trees, payload.tree_vocabulary).find(
    isLenneOakTree,
  );
  if (!tree) {
    throw new Error("official Lenné-Eiche source tree missing");
  }
  return tree;
}

function localBounds(model: ReturnType<typeof createLenneOak>): Box3 {
  model.position.set(0, 0, 0);
  return new Box3().setFromObject(model);
}

describe("source-bound Lenné-Eiche", () => {
  test("matches exactly one official Trauben-Eiche at the supplied map point", () => {
    const trees = decodeTrees(payload.trees, payload.tree_vocabulary);
    const matches = trees.filter(isLenneOakTree);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      catalogue: LENNE_OAK_PROFILE.catalogue,
      crown_radius_m: 9.5,
      height_m: 23,
      position: [-274.82, 3.787, 154.97],
      source: "berlin_official",
      species: "Trauben-Eiche",
      trunk_radius_m: 0.5,
    });
    expect(LENNE_OAK_PROFILE.scientificName).toBe("Quercus petraea Liebl.");
  });

  test("keeps the photographed veteran silhouette and close-detail cues", () => {
    const model = createLenneOak(sourceOak(), "full");
    const bounds = localBounds(model);
    const size = bounds.getSize(new Vector3());

    expect(model.name).toContain("Lenné-Eiche");
    expect(model.userData.photoReferencesBundled).toBeFalse();
    expect(model.userData.forkHeightM).toBe(11.2);
    expect(model.userData.longHorizontalBranchReachM).toBe(8.1);
    expect(model.userData.recognitionCues).toContain("high twin leaders");
    expect(size.x).toBeGreaterThan(18);
    expect(size.x).toBeLessThanOrEqual(19.5);
    expect(bounds.max.y).toBeGreaterThanOrEqual(22.85);
    expect(bounds.max.y).toBeLessThanOrEqual(23.15);

    const bark = model.getObjectByName(
      "Lenné-Eiche furrowed trunk, root flare and exposed limbs",
    );
    const grooves = model.getObjectByName(
      "Lenné-Eiche deep longitudinal bark fissures",
    );
    const foliage = model.getObjectByName(
      "Lenné-Eiche airy asymmetric lobed oak foliage",
    );
    const plaque = model.getObjectByName(
      "Lenné-Eiche botanical identification plaque",
    );
    const snow = model.getObjectByName(
      "Snowstorm-only Lenné-Eiche branch and crown snow",
    );
    expect(bark).toBeInstanceOf(Mesh);
    expect(grooves).toBeInstanceOf(LineSegments);
    expect(
      (grooves as LineSegments).geometry.getAttribute("position").count,
    ).toBeGreaterThanOrEqual(600);
    expect(foliage).toBeInstanceOf(Mesh);
    expect(
      (foliage as Mesh).geometry.getAttribute("color"),
    ).toBeDefined();
    expect(plaque).toBeDefined();
    expect(snow?.userData.snowOnly).toBeTrue();
    expect(snow?.visible).toBeFalse();
    expect(model.userData.renderableCount).toBe(7);
    expect(model.userData.vertexCount).toBeLessThan(30_000);
  });

  test("retains the signature silhouette inside a much smaller mobile budget", () => {
    const full = createLenneOak(sourceOak(), "full");
    const mobile = createLenneOak(sourceOak(), "mobile");
    const bounds = localBounds(mobile);
    const size = bounds.getSize(new Vector3());

    expect(size.x).toBeGreaterThan(18);
    expect(bounds.max.y).toBeGreaterThanOrEqual(22.85);
    expect(mobile.userData.renderableCount).toBe(6);
    expect(mobile.userData.vertexCount).toBeLessThan(5_500);
    expect(mobile.userData.vertexCount).toBeLessThan(
      full.userData.vertexCount / 4,
    );
    expect(
      mobile.getObjectByName(
        "Snowstorm-only Lenné-Eiche branch and crown snow",
      ),
    ).toBeUndefined();
  });

  test("replaces only the generic drawing while keeping source counts and snow", () => {
    const exactTree = sourceOak();
    const fixture: ParkDetailsPayload = {
      paths: [],
      playgrounds: [],
      schema_version: 7,
      source: {
        attribution: "Geoportal Berlin (dl-de/zero-2-0)",
        geometry_status: "test fixture",
        name: "test",
      },
      trees: [exactTree],
    };
    const park = createParkDetails(fixture, { settledDetail: false });
    const genericTrunks = park.getObjectByName(
      "OSM instanced granular tree trunks",
    ) as InstancedMesh;
    const signature = park.getObjectByName(
      "Lenné-Eiche exact photo-informed Trauben-Eiche",
    );

    expect(park.userData.treeCount).toBe(1);
    expect(park.userData.genericTreeCount).toBe(0);
    expect(park.userData.signatureTreeCount).toBe(1);
    expect(park.userData.treePresentationForms.oak).toBe(1);
    expect(genericTrunks.count).toBe(0);
    expect(signature).toBeDefined();

    const snow = signature?.getObjectByName(
      "Snowstorm-only Lenné-Eiche branch and crown snow",
    );
    setParkSnowPresentation(park, true);
    expect(snow?.visible).toBeTrue();
    setParkSnowPresentation(park, false);
    expect(snow?.visible).toBeFalse();
  });

  test("does not hijack another Trauben-Eiche", () => {
    const other = {
      ...sourceOak(),
      id: "other-oak",
      position: [-270, 3.787, 154.97] as [number, number, number],
    };
    expect(isLenneOakTree(other)).toBeFalse();
  });
});
