import { describe, expect, test } from "bun:test";
import {
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import {
  type ParkDetailsPayload,
  WALL_TRACE_PROFILE,
  createPathGeometry,
  createParkDetails,
  decodeTrees,
  parkDetailFocusDistance,
  setParkDetailsFocus,
  setParkSnowPresentation,
  setParkSettledDetail,
  smoothParkPathPoints,
  treePresentationForm,
} from "../src/ParkDetails";
import type { TunnelPortalPayload } from "../src/TunnelPortals";

const payload: ParkDetailsPayload = {
  schema_version: 2,
  source: {
    attribution: "© OpenStreetMap contributors",
    geometry_status: "test geometry",
    name: "OpenStreetMap",
  },
  paths: [
    {
      id: "path-1",
      kind: "footway",
      m: "g",
      name: "Parkweg",
      points: [
        [0, 1, 0],
        [5, 1.1, 5],
        [10, 1.2, 5],
      ],
      w: 14,
    },
    {
      id: "path-2",
      kind: "cycleway",
      m: "a",
      name: null,
      points: [
        [0, 1, 2],
        [8, 1, 2],
      ],
      w: 28,
    },
  ],
  trees: [
    {
      crown_radius_m: 3.2,
      height_m: 11,
      id: "tree-1",
      leaf_type: "broadleaved",
      position: [2, 1, 3],
      source: "berlin_official",
      variant: 0,
    },
    {
      crown_radius_m: 4,
      height_m: 13,
      id: "tree-2",
      leaf_type: null,
      position: [8, 1.1, 4],
      source: "osm",
      variant: 2,
    },
  ],
  street_lights: [
    {
      height_m: 7,
      id: "lamp-1",
      light_type: "Lichtmast mit Aufsatzleuchte",
      position: [4, 1, 4],
      rotation_degrees: 15,
      street: "Testweg",
    },
  ],
  wall_traces: [
    {
      id: "wall-1",
      points: [
        [0, 1, 0],
        [2, 1, 0],
      ],
      wall_type: "Vorderlandmauer",
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
  test("accepts the schema-4 material and width wire form", () => {
    expect(() =>
      createParkDetails({ ...payload, schema_version: 4 }),
    ).not.toThrow();
  });

  test("joins curved path segments into one continuous ribbon", () => {
    const path = payload.paths[0];
    const smoothPoints = smoothParkPathPoints(path);
    const geometry = createPathGeometry([path], 1.6);
    expect(geometry.getAttribute("position").count).toBe(
      smoothPoints.length * 2,
    );
    expect(geometry.getIndex()?.count).toBe((smoothPoints.length - 1) * 6);
    const positions = geometry.getAttribute("position");
    expect(positions.getY(0)).toBeCloseTo(path.points[0][1] + 0.12);
    expect(positions.getY(1)).toBeCloseTo(path.points[0][1] + 0.12);
    expect(positions.getY(positions.count - 2)).toBeCloseTo(
      path.points.at(-1)![1] + 0.12,
    );
    expect(positions.getY(positions.count - 1)).toBeCloseTo(
      path.points.at(-1)![1] + 0.12,
    );
  });

  test("rounds mapped park bends without moving any source point", () => {
    const path = payload.paths[0];
    const points = smoothParkPathPoints(path);
    expect(points.length).toBeGreaterThan(path.points.length);
    for (const sourcePoint of path.points) {
      expect(
        points.some((point) =>
          point.toArray().every((value, index) => value === sourcePoint[index]),
        ),
      ).toBe(true);
    }
    expect(points.every((point) => point.toArray().every(Number.isFinite))).toBe(
      true,
    );

    const steps = smoothParkPathPoints({ ...path, kind: "steps" });
    expect(steps).toHaveLength(path.points.length);
    expect(steps.map((point) => point.toArray())).toEqual(path.points);
  });

  test("batches paths and granular tree crowns", () => {
    const park = createParkDetails(payload);
    expect(park.userData.pathCount).toBe(2);
    expect(park.userData.treeCount).toBe(2);
    const pathMeshes = park.children.filter((child) =>
      child.name.includes("batched path ribbons"),
    );
    expect(pathMeshes).toHaveLength(2);
    expect(pathMeshes.map((child) => child.name).sort()).toEqual([
      "Berlin park asphalt batched path ribbons",
      "Berlin park gravel and compacted batched path ribbons",
    ]);
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

  test("keeps tree crowns out of both open Tiergartentunnel approaches", () => {
    const tunnel: TunnelPortalPayload = {
      clear_height_m: 5,
      clear_width_each_direction_m: 10.5,
      points: [
        [0, -10, 0],
        [0, -10, 400],
        [0, -10, 900],
      ],
      portal_approaches: {
        minna_cauer: {
          carriageways: [
            {
              id: "east",
              lane_count: 2,
              osm_way_ids: ["north-test"],
              points: [
                [0, 1, 40],
                [0, 0, 120],
              ],
              widths_m: [6, 6],
            },
          ],
          geometry_status: "source-backed test corridor",
          label: "North test portal",
          structure: "open_cut",
        },
        kemperplatz: {
          carriageways: [
            {
              id: "east",
              lane_count: 2,
              osm_way_ids: ["south-test"],
              points: [
                [0, 1, 860],
                [0, 0, 780],
              ],
              widths_m: [6, 6],
            },
          ],
          geometry_status: "source-backed test corridor",
          label: "South test portal",
          structure: "open_cut",
        },
      },
    };
    const park = createParkDetails(
      {
        ...payload,
        trees: [
          { ...payload.trees[0], id: "north-ramp", position: [0, 1, 80] },
          { ...payload.trees[0], id: "south-ramp", position: [0, 1, 820] },
          { ...payload.trees[0], id: "beside-ramp", position: [45, 1, 80] },
        ],
      },
      { tunnel },
    );
    const trunks = park.getObjectByName(
      "OSM instanced granular tree trunks",
    ) as InstancedMesh;
    expect(trunks.count).toBe(1);
    expect(park.userData.treeCount).toBe(1);
    expect(park.userData.suppressedTunnelApproachTreeCount).toBe(2);
    expect(park.userData.suppressedConstructionTreeCount).toBe(0);
  });

  test("keeps official conifers and shrubs distinct from broadleaf crowns", () => {
    const conifer = {
      ...payload.trees[0],
      id: "tree-conifer",
      leaf_type: "needleleaved",
      tree_group: "Nadelbäume",
    };
    const shrub = {
      ...payload.trees[0],
      id: "tree-shrub",
      leaf_type: "broadleaved",
      tree_group: "Großsträucher",
    };
    const orchard = {
      ...payload.trees[0],
      id: "tree-orchard",
      leaf_type: "broadleaved",
      tree_group: "Obstbäume",
    };
    expect(treePresentationForm(conifer)).toBe("conifer");
    expect(treePresentationForm(shrub)).toBe("shrub");
    expect(treePresentationForm(orchard)).toBe("orchard");

    const park = createParkDetails({
      ...payload,
      trees: [conifer, shrub, orchard],
    });
    const coniferCrowns = park.children
      .filter((child) => child.name.includes("tiered conifer crowns"))
      .reduce((sum, child) => sum + (child as InstancedMesh).count, 0);
    const shrubCrowns = park.children
      .filter((child) => child.name.includes("low shrub crowns"))
      .reduce((sum, child) => sum + (child as InstancedMesh).count, 0);
    expect(coniferCrowns).toBe(3);
    expect(shrubCrowns).toBe(2);
    expect(park.userData.treePresentationForms).toEqual({
      broadleaf: 0,
      conifer: 1,
      orchard: 1,
      shrub: 1,
    });
  });

  test("adds official-tree microcrowns only to settled desktop detail", () => {
    const park = createParkDetails(payload);
    const settledCrowns = park.children.filter(
      (child) => child.userData.settledOnly === true,
    );
    expect(settledCrowns.length).toBeGreaterThan(0);
    expect(
      settledCrowns.reduce(
        (sum, child) => sum + (child as InstancedMesh).count,
        0,
      ),
    ).toBe(2);
    expect(park.userData.settledOfficialTreeDetailFaces).toBe(160);
    expect(settledCrowns.every((crown) => !crown.visible)).toBeTrue();

    setParkSettledDetail(park, true);
    expect(settledCrowns.every((crown) => crown.visible)).toBeTrue();
    setParkDetailsFocus(park, "Spielplatz an der Luiseninsel");
    expect(settledCrowns.every((crown) => !crown.visible)).toBeTrue();

    setParkDetailsFocus(park, "Großer Tiergarten");
    expect(settledCrowns.every((crown) => crown.visible)).toBeTrue();
    setParkSettledDetail(park, false);
    expect(settledCrowns.every((crown) => !crown.visible)).toBeTrue();
  });

  test("shows tree snow caps only during the snowstorm", () => {
    const park = createParkDetails(payload);
    const caps = park.children.filter(
      (child) => child.userData.snowOnly === true,
    );
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((cap) => !cap.visible)).toBeTrue();
    setParkSnowPresentation(park, true);
    expect(caps.every((cap) => cap.visible)).toBeTrue();
    setParkSnowPresentation(park, false);
    expect(caps.every((cap) => !cap.visible)).toBeTrue();
  });

  test("does not allocate settled-only tree geometry for touch profiles", () => {
    const park = createParkDetails(payload, { settledDetail: false });
    expect(
      park.children.some((child) => child.userData.settledOnly === true),
    ).toBeFalse();
    expect(park.userData.settledOfficialTreeDetailFaces).toBe(0);
  });

  test("renders the Luiseninsel footprint and recognizable climbing equipment", () => {
    const park = createParkDetails(payload);
    expect(
      park.getObjectByName("Spielplatz an der Luiseninsel OSM footprint"),
    ).toBeDefined();
    expect(
      park.getObjectByName("climbingframe climb-1 climbing net"),
    ).toBeDefined();
    expect(park.getObjectByName("slide slide-1 chute")).toBeDefined();
  });

  test("renders official lighting and the granular double-row Wall trace", () => {
    const park = createParkDetails(payload);
    expect(park.userData.streetLightCount).toBe(1);
    expect(park.userData.wallStoneCount).toBeGreaterThan(8);
    expect(
      park.getObjectByName("Geoportal Berlin official public-lighting masts"),
    ).toBeInstanceOf(InstancedMesh);
    const cones = park.getObjectByName(
      "Geoportal Berlin night-only instanced street-light cones",
    );
    expect(cones).toBeInstanceOf(InstancedMesh);
    expect(cones?.userData.nightOnly).toBeTrue();
    const trace = park.getObjectByName(
      "Official Vorderlandmauer double row of individual granite setts",
    ) as InstancedMesh;
    expect(trace).toBeInstanceOf(InstancedMesh);
    expect(trace.material).toBeInstanceOf(MeshBasicMaterial);
    expect(trace.receiveShadow).toBeFalse();
    expect(trace.instanceColor).toBeDefined();
    expect(trace.userData.sourceUrl).toContain("berlin.de/mauer/");

    const matrix = new Matrix4();
    const first = new Vector3();
    const second = new Vector3();
    trace.getMatrixAt(0, matrix);
    first.setFromMatrixPosition(matrix);
    trace.getMatrixAt(1, matrix);
    second.setFromMatrixPosition(matrix);
    expect(first.y).toBeCloseTo(1 + WALL_TRACE_PROFILE.centreLiftM);
    expect(first.distanceTo(second)).toBeCloseTo(
      WALL_TRACE_PROFILE.rowOffsetM * 2,
    );
    // The double row clears the road by millimetres, never by wall height.
    expect(first.y - WALL_TRACE_PROFILE.heightM / 2).toBeGreaterThan(1.14);
    expect(first.y - WALL_TRACE_PROFILE.heightM / 2).toBeLessThanOrEqual(
      1.142,
    );
    expect(WALL_TRACE_PROFILE.heightM).toBeLessThanOrEqual(0.01);
  });

  test("rejects unknown payload schemas instead of partially rendering them", () => {
    expect(() => createParkDetails({ ...payload, schema_version: 5 })).toThrow(
      "Unsupported park-detail schema 5",
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
      (child) =>
        child.userData.focusCutawayFor === "Spielplatz an der Luiseninsel" &&
        child.userData.settledOnly !== true &&
        child.userData.snowOnly !== true,
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

describe("schema-3 compact tree wire form", () => {
  // The task-09 bounds carry 20,911 official catalogue points instead of
  // 6,893. The verbose per-tree records went past the payload budget, so the
  // shipped file interns the repeated strings and shortens the keys. Decoding
  // must restore exactly what the viewer used to read, or measured species,
  // catalogue and OSM-evidence provenance would silently disappear.
  const vocabulary = {
    catalogue: ["strassenbaum"],
    leaf_type: ["broadleaved"],
    source: ["berlin_official", "osm"],
    species: ["Spitz-Ahorn"],
    tree_group: ["Laubbäume"],
  };
  const compact = [
    {
      c: 0,
      cm: 1,
      cr: 2,
      e: ["12077445781"],
      g: 0,
      h: 7,
      hm: 1,
      i: "a",
      lt: 0,
      position: [1, 2, 3] as [number, number, number],
      s: 0,
      sp: 0,
      tr: 0.12,
      v: 2,
    },
    {
      cr: 3.33,
      h: 9.8,
      i: "b",
      position: [4, 5, 6] as [number, number, number],
      s: 1,
      tr: 0.317,
      v: 1,
    },
  ];

  test("restores interned strings and leaves absent fields null", () => {
    const [official, osm] = decodeTrees(compact, vocabulary);
    expect(official.id).toBe("a");
    expect(official.source).toBe("berlin_official");
    expect(official.species).toBe("Spitz-Ahorn");
    expect(official.tree_group).toBe("Laubbäume");
    expect(official.catalogue).toBe("strassenbaum");
    expect(official.leaf_type).toBe("broadleaved");
    expect(official.position).toEqual([1, 2, 3]);
    expect(osm.source).toBe("osm");
    expect(osm.species).toBeNull();
    expect(osm.catalogue).toBeNull();
    expect(osm.leaf_type).toBeNull();
    expect(osm.trunk_radius_m).toBe(0.317);
  });

  test("schema 1 and 2 payloads still pass through untouched", () => {
    expect(decodeTrees(payload.trees)).toEqual(payload.trees);
  });

  test("createParkDetails builds the same trees from either form", () => {
    const verbose = createParkDetails(payload);
    const wire = createParkDetails({
      ...payload,
      schema_version: 3,
      tree_vocabulary: {
        leaf_type: ["broadleaved"],
        source: ["berlin_official", "osm"],
      },
      trees: [
        { cr: 3.2, h: 11, i: "tree-1", lt: 0, position: [2, 1, 3], s: 0, v: 0 },
        { cr: 4, h: 13, i: "tree-2", position: [8, 1.1, 4], s: 1, v: 2 },
      ],
    });
    expect(wire.userData.treeCount).toBe(verbose.userData.treeCount);
    expect(wire.userData.settledOfficialTreeDetailFaces).toBe(
      verbose.userData.settledOfficialTreeDetailFaces,
    );
  });
});
