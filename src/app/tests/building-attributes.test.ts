import { describe, expect, test } from "bun:test";
import { Color, InstancedMesh, LineSegments, Matrix4, MeshStandardMaterial, ShaderLib } from "three";
import {
  BUILDING_ATTRIBUTE_SOURCE,
  buildingAttributes,
  mappedColor,
  mappedFacadeTone,
  mappedGlazing,
  mappedRoofTone,
  mappedStoreyProfile,
  type BuildingAttributes,
} from "../src/buildingAttributes";
import { applyMinecraftColumnDetail } from "../src/MinecraftColumnDetail";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import { buildColumnToneLookup, createMinecraftVoxelWorld, type ColumnToneLookup, type VoxelPayload } from "../src/MinecraftVoxelWorld";

const attributes: BuildingAttributes = {
  osm: "way/fixture",
  part: false,
  tags: { "building:levels": "5", "building:material": "brick", "roof:material": "copper" },
};

describe("source-separated ordinary building details", () => {
  test("uses only original mapped attributes and explicitly mapped material wins", () => {
    expect(Object.keys(BUILDING_ATTRIBUTE_SOURCE.prisms).length).toBeGreaterThan(12_000);
    expect(buildingAttributes("unmapped-building")).toBeUndefined();
    expect(mappedGlazing(attributes)).toBe(false);
    expect(mappedGlazing({ ...attributes, tags: { "building:material": "glass" } })).toBe(true);
    expect(mappedGlazing(undefined)).toBeUndefined();
    expect(mappedRoofTone(attributes)).not.toBe(mappedFacadeTone(attributes));
    expect(mappedFacadeTone({ ...attributes, tags: { ...attributes.tags, "building:colour": "#abcdef" } })).toBe(0xabcdef);
    expect(mappedColor("#adf")).toBe(0xaaddff);
    expect(mappedColor("red;white")).toBeUndefined();
  });

  test("retains recorded floor count without inflating the measured envelope", () => {
    const profile = mappedStoreyProfile(attributes, 17.5)!;
    expect(profile.count).toBe(5);
    expect(profile.floorPitch * profile.count).toBeCloseTo(17.5);
    expect(profile.sillStart + profile.height).toBeLessThan(profile.floorPitch);
    expect(mappedStoreyProfile(attributes, 3.5)).toBeNull();
    expect(mappedStoreyProfile(attributes, 45)).toBeNull();
    expect(mappedStoreyProfile({ ...attributes, tags: { "building:levels": "5;6" } }, 18)).toBeNull();
    expect(mappedStoreyProfile({ ...attributes, tags: { ...attributes.tags, "building:min_level": "2" } }, 18)).toBeNull();
  });

  test("small unmatched annexes gain envelope detail without invented openings or geometry", () => {
    const payload: PrismPayload = { schema_version: 1, classes: ["concrete"], buildings: [{
      id: "unmapped-annex", class: 0, h_dm: 28, y0_dm: 40, roof: 1000,
      ring: [[35000, 20000], [35080, 20000], [35080, 20050], [35000, 20050]],
    }] };
    const original = JSON.stringify(payload);
    const city = createIsometricCity(payload, null, null, null, { includeContext: false });
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(axes).toBeDefined();
    expect(axes.geometry.getAttribute("position").count).toBe(8);
    expect(city.userData.buildingDetailCoverage).toMatchObject({ envelopeDetailedParts: 1, envelopeStrokes: 4, mappedStoreyParts: 0, extraRenderables: 0 });
    expect(city.getObjectByName("LoD2 prism windows")).toBeUndefined();
    expect(JSON.stringify(payload)).toBe(original);
  });

  test("mobile keeps recorded roof material inside the same source column envelope", () => {
    const payload: VoxelPayload = {
      schema_version: 1, cell_m: 4, classes: ["concrete"],
      grid: { cols: 1, rows: 1, min_x_idx: 875, min_z_idx: 500 },
      ground_height: { cols: 1, rows: 1, stride_cells: 1, y_dm: [40] },
      ground_rows: [], buildings: [[875, 500, 40, 215, 0]], trees: [], water_top_y_m: 3,
    };
    const lookup: ColumnToneLookup = () => 0xc0b090;
    lookup.attributesAt = () => attributes;
    const world = createMinecraftVoxelWorld(payload, lookup, null, { detailProfile: "mobile" });
    const columns = world.getObjectByName("Voxel building columns") as InstancedMesh;
    expect(columns.count).toBe(2);
    const matrix = new Matrix4();
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < columns.count; i += 1) {
      columns.getMatrixAt(i, matrix);
      minY = Math.min(minY, matrix.elements[13] - matrix.elements[5] / 2);
      maxY = Math.max(maxY, matrix.elements[13] + matrix.elements[5] / 2);
    }
    expect(minY).toBeCloseTo(4, 5);
    expect(maxY).toBeCloseTo(21.5, 5);
    const roof = new Color();
    columns.getColorAt(1, roof);
    expect(roof.getHex()).toBe(mappedRoofTone(attributes)!);
    expect(columns.userData.buildingDetail.extraAttributes).toBe(0);
  });

  test("mapped glass walls cannot flatten a retained pitched roof", () => {
    expect(mappedGlazing(buildingAttributes("NKE26iHe"))).toBe(true);
    const city = createIsometricCity({ schema_version: 1, classes: ["concrete"], buildings: [{
      id: "NKE26iHe", class: 0, h_dm: 180, y0_dm: 40, roof: 2100,
      ring: [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]],
    }] }, null, null, null, { includeContext: false });
    expect(city.getObjectByName("LoD2 prism buildings")).toBeDefined();
    expect(city.getObjectByName("LoD2 glass prisms")).toBeUndefined();
  });

  test("every voxel column shares the original prism storey datum and excludes courts", () => {
    const id = Object.keys(BUILDING_ATTRIBUTE_SOURCE.prisms).find((id) => buildingAttributes(id)?.tags["building:levels"] === "5")!;
    const lookup = buildColumnToneLookup({ buildings: [{
      id, h_dm: 175, tone: [190, 180, 165],
      ring: [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]],
      holes: [[[35080, 20020], [35120, 20020], [35120, 20060], [35080, 20060]]],
    }] });
    expect(lookup.storeysAt?.(3502, 2002)?.floorPitch).toBeCloseTo(3.5);
    expect(lookup.storeysAt?.(3506, 2002)).toEqual(lookup.storeysAt?.(3502, 2002));
    expect(lookup.attributesAt?.(3510, 2004)).toBeUndefined();
    expect(lookup(3510, 2004)).toBeNull();
  });

  test("tone-less source buildings retain mapped storeys without an invented facade colour", () => {
    const id = "IFEWEgdb";
    expect(buildingAttributes(id)?.tags["building:levels"]).toBe("10");
    const lookup = buildColumnToneLookup({ buildings: [{
      id, h_dm: 442,
      ring: [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]],
    }] });
    expect(lookup(3502, 2002)).toBeNull();
    expect(lookup.attributesAt?.(3502, 2002)?.osm).toBe(buildingAttributes(id)?.osm);
    expect(lookup.storeysAt?.(3502, 2002)?.count).toBe(10);
    expect(lookup.storeysAt?.(3502, 2002)?.floorPitch).toBeCloseTo(4.42);
  });

  test("generic glass mullions honour mapped floors inside the unchanged roof envelope", () => {
    const id = Object.keys(BUILDING_ATTRIBUTE_SOURCE.prisms).find((id) => {
      const source = buildingAttributes(id);
      return source?.tags["building:levels"] === "5" && mappedGlazing(source) !== false;
    })!;
    const city = createIsometricCity({ schema_version: 1, classes: ["glass"], buildings: [{
      id, class: 0, h_dm: 175, y0_dm: 40, roof: 1000,
      ring: [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]],
    }] }, null, null, null, { includeContext: false });
    expect(city.userData.buildingDetailCoverage.mappedGlassStoreyParts).toBe(1);
    const mullions = city.getObjectByName("LoD2 glass mullions") as LineSegments;
    const positions = mullions.geometry.getAttribute("position");
    const levels = new Set<number>();
    for (let i = 0; i < positions.count; i += 2) {
      if (positions.getY(i) === positions.getY(i + 1)) levels.add(positions.getY(i));
    }
    expect([...levels].sort((a, b) => a - b)).toEqual([7.5, 11, 14.5, 18]);
  });

  test("an attribute-only overlap cannot hide an existing sampled facade colour", () => {
    const ring = [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]];
    const sampled = { id: "sampled-overlap", h_dm: 442, ring, tone: [190, 180, 165] as [number, number, number] };
    const original = buildColumnToneLookup({ buildings: [sampled] });
    const combined = buildColumnToneLookup({ buildings: [
      { id: "IFEWEgdb", h_dm: 442, ring }, sampled,
    ] });
    expect(combined(3502, 2002)).toBe(original(3502, 2002));
    expect(combined(3502, 2002)).not.toBeNull();
    expect(combined.attributesAt?.(3502, 2002)?.osm).toBe(buildingAttributes("IFEWEgdb")?.osm);
    expect(combined.storeysAt?.(3502, 2002)?.count).toBe(10);
  });

  test("block-course material adds no attributes, textures or draw calls", () => {
    const material = new MeshStandardMaterial();
    applyMinecraftColumnDetail(material, 4);
    const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} };
    material.onBeforeCompile(shader as never, {} as never);
    expect(shader.vertexShader).toContain("instanceMatrix * detailWorld");
    expect(shader.fragmentShader).toContain("dFdx(vMinecraftDetailWorld)");
    expect(shader.fragmentShader).toContain("nearDetail");
    expect(material.map).toBeNull();
    expect(material.customProgramCacheKey()).toBe("minecraft-source-columns-v1-4");
  });
});
