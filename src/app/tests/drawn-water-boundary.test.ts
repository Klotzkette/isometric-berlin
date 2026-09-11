import { describe, expect, test } from "bun:test";
import { Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import groundJson from "../public/mesh/regierungsviertel/ground-context.json";
import data from "../src/data/drawnWaterBoundary.json";
import { createDrawnWaterBoundaryCellTester, restoreDrawnWaterBoundary, type DrawnWaterBoundaryData } from "../src/drawnWaterBoundary";
import { createGroundSlabs, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { compactStaticGeometry } from "../src/compactStaticGeometry";
import { ISO_GROUND_SHADES, setIsoNightPresentation } from "../src/IsometricCityWorld";

const encode = (array: ArrayBufferView): string => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
function fixture(): { ground: VoxelPayload; boundary: DrawnWaterBoundaryData } {
  const ground = {
    ...groundJson, cell_m: 4, classes: ["grass"],
    grid: { min_x_idx: 0, min_z_idx: 0, cols: 3, rows: 1 },
    ground_rows: [[[0, 3, 0]]],
    ground_height: { ...groundJson.ground_height, cols: 3, rows: 1, stride_cells: 1, y_dm: [100, 140, 180] },
  } as VoxelPayload;
  return { ground, boundary: {
    format: "exact-drawn-water-boundary", version: 1, cell_m: 4, grid: ground.grid,
    source_sha256: "fixture", ground_sha256: "fixture",
    cells_u32: encode(new Uint32Array([1, 0, 0, 6, 0, 8])),
    triangles_f32: encode(new Float32Array([4,0,6,0,6,4, 4,0,6,4,4,4])),
    edges_f32: encode(new Float32Array([4,0,6,0, 6,0,6,4, 6,4,4,4, 4,4,4,0])),
  }};
}
function slabsFor(ground: VoxelPayload, skipAtWorld?: (x: number, z: number) => boolean): InstancedMesh {
  const slabs = createGroundSlabs(ground, "Drawn ground slabs", ISO_GROUND_SHADES, { emissive: 0, skipWater: true, skipBridge: true, skipAtWorld });
  slabs.userData.nightMaterial = slabs.material;
  slabs.userData.dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  slabs.material = slabs.userData.dayMaterial;
  return slabs;
}
function rayAt(root: InstancedMesh, x: number, z: number) {
  root.updateMatrixWorld(true);
  return new Raycaster(new Vector3(x, 30, z), new Vector3(0, -1, 0), 0, 50).intersectObject(root, true);
}

describe("exact water-boundary land complements", () => {
  test("cuts only water intrusion while every remaining piece keeps the original run height and shade", () => {
    const { ground, boundary } = fixture(), slabs = slabsFor(ground);
    const previous = Array.from(slabs.instanceMatrix.array), color = new Color(); slabs.getColorAt(0, color);
    expect(slabs.count).toBe(1);
    restoreDrawnWaterBoundary(slabs, ground, boundary);
    expect(slabs.count).toBe(2);
    for (let i = 0; i < slabs.count; i++) {
      const matrix = new Matrix4(), paint = new Color(); slabs.getMatrixAt(i, matrix); slabs.getColorAt(i, paint);
      expect(matrix.elements[13]).toBe(previous[13]);
      expect(matrix.elements[5]).toBe(previous[5]);
      expect(paint).toEqual(color);
    }
    for (const [x, z] of [[2,2], [5,2], [10,2]]) expect(rayAt(slabs, x, z)[0].point.y).toBe(14);
    expect(rayAt(slabs, 7, 2)).toHaveLength(0);
    const clipped = slabs.children[0].children[0] as Mesh;
    const paint = clipped.geometry.getAttribute("color");
    for (let i = 0; i < paint.count; i++) expect([paint.getX(i), paint.getY(i), paint.getZ(i)]).toEqual(color.toArray());
    expect(clipped.userData.dayMaterial.vertexColors).toBeTrue();
    expect(clipped.userData.nightMaterial.vertexColors).toBeTrue();
    expect(clipped.userData.nightMaterial.roughness).toBe((slabs.userData.nightMaterial).roughness);
  });
  test("existing authored whole-cell exclusions win and cannot be reintroduced by a replacement", () => {
    const { ground, boundary } = fixture(), slabs = slabsFor(ground, x => x >= 4 && x < 8);
    const before = Array.from(slabs.instanceMatrix.array), colors = Array.from(slabs.instanceColor!.array);
    restoreDrawnWaterBoundary(slabs, ground, boundary);
    expect(Array.from(slabs.instanceMatrix.array)).toEqual(before);
    expect(Array.from(slabs.instanceColor!.array)).toEqual(colors);
    expect(slabs.children).toHaveLength(0);
    expect(rayAt(slabs, 5, 2)).toHaveLength(0);
  });
  test("a fully water-covered false land cell disappears without losing either adjacent land cell", () => {
    const { ground, boundary } = fixture(), slabs = slabsFor(ground);
    boundary.cells_u32 = encode(new Uint32Array([1,0,0,0,0,0])); boundary.triangles_f32 = ""; boundary.edges_f32 = "";
    restoreDrawnWaterBoundary(slabs, ground, boundary);
    expect(slabs.count).toBe(2);
    expect(rayAt(slabs, 6, 2)).toHaveLength(0);
    expect(rayAt(slabs, 2, 2)[0].point.y).toBe(14);
    expect(rayAt(slabs, 10, 2)[0].point.y).toBe(14);
  });
  test("a different grid is unchanged, and cell lookup cannot mark neighbouring cells", () => {
    const { ground, boundary } = fixture(), testCell = createDrawnWaterBoundaryCellTester(ground, boundary);
    expect(testCell(5, 2)).toBeTrue(); expect(testCell(2, 2)).toBeFalse(); expect(testCell(10, 2)).toBeFalse();
    boundary.grid = { ...boundary.grid, min_x_idx: -100 };
    const slabs = slabsFor(ground), before = Array.from(slabs.instanceMatrix.array);
    restoreDrawnWaterBoundary(slabs, ground, boundary);
    expect(Array.from(slabs.instanceMatrix.array)).toEqual(before); expect(slabs.children).toHaveLength(0);
  });
  test("day, night and alternate drawn modes retain the same indexed land geometry and vertex paint", () => {
    const { ground, boundary } = fixture(), slabs = slabsFor(ground), world = new Group();
    restoreDrawnWaterBoundary(slabs, ground, boundary); world.add(slabs);
    const clipped = slabs.children[0].children[0] as Mesh;
    const submitted = () => {
      const result: Record<string, number[]> = {};
      for (const name of ["position", "normal", "color"]) {
        const attribute = clipped.geometry.getAttribute(name), indices = clipped.geometry.index;
        result[name] = [];
        for (let i = 0; i < (indices?.count ?? attribute.count); i++) {
          const index = indices ? indices.getX(i) : i;
          result[name].push(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
        }
      }
      return result;
    };
    const before = submitted(); expect(compactStaticGeometry(clipped)).toBeGreaterThan(0);
    expect(submitted()).toEqual(before);
    for (const mode of ["night", "day", "snowstorm", "schwellenraum", "day"] as const) {
      setIsoNightPresentation(world, mode === "night", true, mode);
      expect((clipped.material as MeshBasicMaterial).vertexColors).toBeTrue();
      expect(submitted()).toEqual(before);
      if (mode === "night") expect(clipped.material).toBe(clipped.userData.nightMaterial);
      if (mode === "day") expect(clipped.material).toBe(clipped.userData.dayMaterial);
    }
  });
  test("retained source data covers the reported station and Otto-Weidt bank cells", () => {
    expect(data.affected_cells).toBe(11_366);
    expect(data.water_polygon_count).toBe(175);
    expect(data.water_kinds).toEqual({ basin:37, pond:39, river:76, stream:23 });
    const testCell = createDrawnWaterBoundaryCellTester(groundJson as VoxelPayload);
    for (const [x,z] of [[102,-1098], [134,-1098], [106,-1094], [138,-1094]]) expect(testCell(x,z)).toBeTrue();
    expect(testCell(1000, 1000)).toBeFalse();
    expect(data.regions.hauptbahnhof.cells).toBe(588);
    expect(data.regions.otto_weidt.cells).toBe(312);
  });
});
