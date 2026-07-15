import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import {
  type ParkDetailsPayload,
  createParkDetails,
  parkDetailFocusDistance,
  setParkDetailsFocus,
} from "../src/ParkDetails";

const payload: ParkDetailsPayload = {
  schema_version: 1,
  source: {
    attribution: "© OpenStreetMap contributors",
    geometry_status: "test geometry",
    name: "OpenStreetMap",
  },
  paths: [
    {
      id: "path-1",
      kind: "footway",
      name: "Parkweg",
      points: [
        [0, 1, 0],
        [5, 1.1, 5],
        [10, 1.2, 5],
      ],
    },
    {
      id: "path-2",
      kind: "cycleway",
      name: null,
      points: [
        [0, 1, 2],
        [8, 1, 2],
      ],
    },
  ],
  trees: [
    {
      crown_radius_m: 3.2,
      height_m: 11,
      id: "tree-1",
      leaf_type: "broadleaved",
      position: [2, 1, 3],
      variant: 0,
    },
    {
      crown_radius_m: 4,
      height_m: 13,
      id: "tree-2",
      leaf_type: null,
      position: [8, 1.1, 4],
      variant: 2,
    },
  ],
  playgrounds: [
    {
      equipment: [
        {
          id: "climb-1",
          kind: "climbingframe",
          material: null,
          points: [],
          position: [4, 1, 8],
        },
        {
          id: "slide-1",
          kind: "slide",
          material: null,
          points: [
            [5, 1, 8],
            [8, 1, 9],
          ],
          position: [6.5, 1, 8.5],
        },
      ],
      id: "24911694:0",
      name: "Spielplatz an der Luiseninsel",
      outline: [
        [0, 1, 6],
        [10, 1, 6],
        [10, 1, 12],
        [0, 1, 12],
        [0, 1, 6],
      ],
      source_url: "https://www.openstreetmap.org/way/24911694",
      surface: "sand",
      wheelchair: "limited",
    },
  ],
};

describe("OSM park details", () => {
  test("batches paths and granular tree crowns", () => {
    const park = createParkDetails(payload);
    expect(park.userData.pathCount).toBe(2);
    expect(park.userData.treeCount).toBe(2);
    expect(
      park.children.filter((child) => child.name.includes("batched path ribbons")),
    ).toHaveLength(2);
    const trunks = park.getObjectByName("OSM instanced granular tree trunks");
    expect(trunks).toBeInstanceOf(InstancedMesh);
    expect((trunks as InstancedMesh).count).toBe(2);
    const crownInstances = park.children
      .filter((child) => child.name.includes("five-lobed tree crowns"))
      .reduce((sum, child) => sum + (child as InstancedMesh).count, 0);
    expect(crownInstances).toBe(10);
    const branches = park.getObjectByName(
      "OSM instanced granular tree fork branches",
    );
    expect(branches).toBeInstanceOf(InstancedMesh);
    expect((branches as InstancedMesh).count).toBe(4);
  });

  test("renders the Luiseninsel footprint and recognizable climbing equipment", () => {
    const park = createParkDetails(payload);
    expect(
      park.getObjectByName("Spielplatz an der Luiseninsel OSM footprint"),
    ).toBeDefined();
    expect(park.getObjectByName("climbingframe climb-1 climbing net")).toBeDefined();
    expect(park.getObjectByName("slide slide-1 chute")).toBeDefined();
  });

  test("rejects unknown payload schemas instead of partially rendering them", () => {
    expect(() => createParkDetails({ ...payload, schema_version: 2 })).toThrow(
      "Unsupported park-detail schema 2",
    );
  });

  test("uses a close camera for the small Luiseninsel equipment", () => {
    expect(parkDetailFocusDistance("Spielplatz an der Luiseninsel")).toBe(64);
    expect(parkDetailFocusDistance("Großer Tiergarten")).toBe(310);
    expect(parkDetailFocusDistance("Reichstagsgebäude")).toBeNull();
  });

  test("clears only nearby crowns while the playground is inspected", () => {
    const park = createParkDetails(payload);
    const cutawayCrowns = park.children.filter(
      (child) => child.userData.focusCutawayFor === "Spielplatz an der Luiseninsel",
    );
    expect(cutawayCrowns.length).toBeGreaterThan(0);

    setParkDetailsFocus(park, "Spielplatz an der Luiseninsel");
    expect(cutawayCrowns.every((crown) => !crown.visible)).toBeTrue();

    setParkDetailsFocus(park, "Großer Tiergarten");
    expect(cutawayCrowns.every((crown) => crown.visible)).toBeTrue();
  });

  test("reveals equipment above source-mesh tree canopies only in focus", () => {
    const park = createParkDetails(payload);
    const footprint = park.getObjectByName(
      "Spielplatz an der Luiseninsel OSM footprint",
    );
    const climbingPost = park.getObjectByName(
      "climbingframe climb-1 upright 1",
    );
    expect(footprint).toBeInstanceOf(Mesh);
    expect(climbingPost).toBeInstanceOf(Mesh);

    setParkDetailsFocus(park, "Spielplatz an der Luiseninsel");
    const focusedMaterial = (footprint as Mesh).material;
    const postMaterial = (climbingPost as Mesh).material;
    expect(Array.isArray(focusedMaterial)).toBeFalse();
    if (!Array.isArray(focusedMaterial)) {
      expect(focusedMaterial.depthTest).toBeTrue();
      expect(focusedMaterial.depthWrite).toBeTrue();
    }
    expect(Array.isArray(postMaterial)).toBeFalse();
    if (!Array.isArray(postMaterial)) {
      expect(postMaterial.depthTest).toBeFalse();
      expect(postMaterial.depthWrite).toBeFalse();
    }
    expect(footprint?.renderOrder).toBe(0);
    expect(climbingPost?.renderOrder).toBe(31);

    setParkDetailsFocus(park, "Großer Tiergarten");
    if (!Array.isArray(postMaterial)) {
      expect(postMaterial.depthTest).toBeTrue();
      expect(postMaterial.depthWrite).toBeTrue();
    }
    expect(climbingPost?.renderOrder).toBe(0);
  });

  test("hides exactly three true-scale coloured eggs across a full park payload", () => {
    const fullTrees = Array.from({ length: 24 }, (_, index) => ({
      ...payload.trees[index % payload.trees.length],
      id: `egg-tree-${index}`,
      position: [index * 2, 1, index * 3] as [number, number, number],
      variant: index % 3,
    }));
    const park = createParkDetails({ ...payload, trees: fullTrees });
    const eggs = park.getObjectByName(
      "Tiergarten three hidden real-scale Easter eggs",
    );
    expect(eggs).toBeInstanceOf(InstancedMesh);
    expect((eggs as InstancedMesh).count).toBe(3);
    expect(eggs?.userData.eggHeightM).toBeLessThan(0.07);
    expect(park.userData.eggCount).toBe(3);
  });
});
