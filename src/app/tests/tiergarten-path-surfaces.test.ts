import { describe, expect, test } from "bun:test";
import { DataTexture, Mesh, MeshStandardMaterial } from "three";

import parkDetailsJson from "../public/mesh/regierungsviertel/park-details.json";
import {
  type ParkDetailsPayload,
  type ParkPath,
  createParkDetails,
  createParkPathSurfaceTexture,
} from "../src/ParkDetails";
import {
  createMinecraftMaterialState,
  disposeMinecraftMaterialState,
  setMinecraftMaterialPresentation,
} from "../src/visual-modes/minecraft/materialMode";

const sourcePayload = parkDetailsJson as unknown as ParkDetailsPayload;
const MATERIAL_CODES: NonNullable<ParkPath["m"]>[] = [
  "a",
  "c",
  "e",
  "f",
  "g",
  "m",
  "p",
  "s",
  "w",
];

function pathFixture(paths: ParkPath[], schemaVersion = 7): ParkDetailsPayload {
  return {
    paths,
    playgrounds: [],
    schema_version: schemaVersion,
    source: {
      attribution: "© OpenStreetMap contributors",
      geometry_status: "source-backed test geometry",
      name: "OpenStreetMap",
    },
    trees: [],
  };
}

function straightPath(
  code: NonNullable<ParkPath["m"]>,
  index = 0,
  width = 240,
): ParkPath {
  return {
    id: `surface-${code}`,
    kind: "footway",
    m: code,
    points: [
      [0, 3, index * 8],
      [12, 3.1, index * 8],
    ],
    w: width,
  };
}

describe("source-faithful Tiergarten path surfaces", () => {
  test("keeps every mapped close-view material family distinct", () => {
    expect(sourcePayload.schema_version).toBe(7);
    expect(new Set(sourcePayload.paths.map((path) => path.m))).toEqual(
      new Set(MATERIAL_CODES),
    );

    const park = createParkDetails(
      pathFixture(MATERIAL_CODES.map((code, index) => straightPath(code, index))),
    );
    const ribbons = park.children.filter((child) =>
      child.name.endsWith("batched path ribbons"),
    ) as Mesh[];
    expect(ribbons).toHaveLength(MATERIAL_CODES.length);
    expect(
      new Set(
        ribbons.map(
          (mesh) =>
            (mesh.material as MeshStandardMaterial).userData.pathMaterialCode,
        ),
      ),
    ).toEqual(new Set(MATERIAL_CODES));
    for (const ribbon of ribbons) {
      const surface = ribbon.material as MeshStandardMaterial;
      expect(surface.map).toBeInstanceOf(DataTexture);
      expect(surface.polygonOffset).toBeTrue();
      expect(surface.polygonOffsetFactor).toBe(-2);
      expect(surface.userData.sourceBackedPathSurface).toBeTrue();
      expect(ribbon.geometry.getAttribute("uv").count).toBe(
        ribbon.geometry.getAttribute("position").count,
      );
    }
  });

  test("builds deterministic but visibly non-flat grains and joints", () => {
    const signatures = new Map<string, string>();
    for (const code of MATERIAL_CODES) {
      const texture = createParkPathSurfaceTexture(code);
      const pixels = texture.image.data as Uint8Array;
      expect(new Set(pixels.filter((_, index) => index % 4 === 0)).size).toBeGreaterThan(
        1,
      );
      expect(texture.userData.materialCode).toBe(code);
      expect(texture.userData.sourceContract).toContain("OSM surface tag");
      signatures.set(code, Array.from(pixels.slice(0, 256)).join(","));
    }
    expect(new Set(signatures.values()).size).toBe(MATERIAL_CODES.length);
  });

  test("decodes centimetre widths without shifting the mapped centreline", () => {
    const park = createParkDetails(pathFixture([straightPath("c", 0, 375)]));
    const ribbon = park.getObjectByName(
      "Berlin park granite sett batched path ribbons",
    ) as Mesh;
    const positions = ribbon.geometry.getAttribute("position");
    const uvs = ribbon.geometry.getAttribute("uv");
    expect(positions.getZ(0)).toBeCloseTo(1.875, 6);
    expect(positions.getZ(1)).toBeCloseTo(-1.875, 6);
    expect((positions.getZ(0) + positions.getZ(1)) / 2).toBeCloseTo(0, 6);
    expect(positions.getY(0)).toBeCloseTo(3.12, 6);
    expect(uvs.getY(0)).toBeCloseTo(-1.875, 6);
    expect(uvs.getY(1)).toBeCloseTo(1.875, 6);

    const legacy = createParkDetails(
      pathFixture([straightPath("c", 0, 38)], 6),
    ).getObjectByName("Berlin park granite sett batched path ribbons") as Mesh;
    const legacyPositions = legacy.geometry.getAttribute("position");
    expect(legacyPositions.getZ(0) - legacyPositions.getZ(1)).toBeCloseTo(
      3.8,
      6,
    );
  });

  test("retains material identity through Minecraft and back", () => {
    const park = createParkDetails(pathFixture([straightPath("c")]));
    const ribbon = park.getObjectByName(
      "Berlin park granite sett batched path ribbons",
    ) as Mesh;
    const dayMaterial = ribbon.material as MeshStandardMaterial;
    const dayMap = dayMaterial.map;
    const state = createMinecraftMaterialState();

    setMinecraftMaterialPresentation(park, state, true);
    expect(ribbon.material).not.toBe(dayMaterial);
    expect((ribbon.material as MeshStandardMaterial).map).toBe(dayMap);
    expect(ribbon.material.userData.pathMaterialCode).toBe("c");

    setMinecraftMaterialPresentation(park, state, false);
    expect(ribbon.material).toBe(dayMaterial);
    expect((ribbon.material as MeshStandardMaterial).map).toBe(dayMap);
    expect(ribbon.material.userData.pathSurfacePattern).toContain("stone");
    disposeMinecraftMaterialState(state);
  });

  test("keeps named formal walks and mapped desire paths source-specific", () => {
    const namedMaterials = (name: string): Set<ParkPath["m"]> =>
      new Set(
        sourcePayload.paths
          .filter((path) => path.name === name)
          .map((path) => path.m),
      );
    expect(namedMaterials("Bellevueallee")).toEqual(new Set(["c"]));
    expect(namedMaterials("Kleine Querallee")).toEqual(new Set(["c"]));
    expect(namedMaterials("Großer Weg")).toEqual(
      new Set(["a", "c", "f", "g"]),
    );
    expect(namedMaterials("Löwen-Brücke")).toEqual(new Set(["w"]));

    // These are committed OSM ways whose current mapped informal=yes paths
    // also carry dirt/ground/grass/earth evidence. Their identity is tested,
    // not inferred from an approximate visual location.
    const mappedDesirePaths = [
      "117863786",
      "121339622",
      "355800319",
      "625921356",
      "671588154",
      "671588155",
      "828020122",
      "899609933",
      "1225011790",
      "1225011791",
      "1280708301",
      "1413319007",
      "1416110227",
      "1429783846",
      "1442579046",
      "1417732146",
      "1418066649",
      "1422873758",
      "1422873777",
      "1429526609",
      "1462063188",
      "1462081649",
    ];
    const bySourceWay = new Map(
      sourcePayload.paths.map((path) => [path.id.split(":")[0], path]),
    );
    for (const id of mappedDesirePaths) {
      expect(bySourceWay.get(id)?.m).toBe("e");
    }
  });
});
