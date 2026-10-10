import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import data from "../src/data/labourQuartierV208.json";
import { createLabourQuartierV208, LABOUR_QUARTIER_V208_GROUP } from "../src/LabourQuartierV208";
import { createMinecraftGendarmenmarktPerimeterShells } from "../src/GendarmenmarktPerimeterShells";
import { buildingTerrainOffset } from "../src/weinbergTerrainV176";

function attributeBytes(root: ReturnType<typeof createLabourQuartierV208>): number {
  let result = 0;
  for (const child of root.children as Mesh[]) {
    for (const a of Object.values(child.geometry.attributes)) result += a.array.byteLength;
    result += child.geometry.index?.array.byteLength ?? 0;
    if (child instanceof InstancedMesh) result += child.instanceMatrix.array.byteLength + child.instanceColor!.array.byteLength;
  }
  return result;
}

describe("BMAS campus and Quartier 206 source-bound refinement", () => {
  test("identical complete touch detail, two drawn batches and one native batch", () => {
    for (const native of [false, true]) {
      const root = createLabourQuartierV208(native);
      expect(root.name).toBe(LABOUR_QUARTIER_V208_GROUP + (native ? " native" : ""));
      expect(root.children).toHaveLength(native ? 1 : 2);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.sourceGeometryRetained).toBe(true);
      expect(root.userData.newCourtWalls).toBe(false);
      expect(root.userData.newPassageClosures).toBe(false);
      expect(attributeBytes(root)).toBeLessThan(1500 * 1024);
      for (const child of root.children as Mesh[]) {
        expect(child.matrixAutoUpdate).toBe(false);
        expect(child.geometry.getAttribute("uv")).toBeUndefined();
        expect(child.userData.dayMaterial.map).toBeNull();
        expect(child.userData.nightMaterial.map).toBeNull();
      }
      const mesh = root.children.at(-1) as InstancedMesh;
      const rows = native ? data.blocks : data.boxes;
      expect(mesh.count).toBe(rows.length);
      expect(mesh.instanceMatrix.array.length).toBe(rows.length * 16);
      expect(mesh.instanceColor!.array.length).toBe(rows.length * 3);
      rows.forEach((row, i) => {
        const owner = data.owners[Number(row[native ? 7 : 8])];
        const offset = buildingTerrainOffset(owner.id, owner.anchor[0], owner.anchor[1], owner.groundY);
        expect(mesh.instanceMatrix.array[i * 16 + 13]).toBeCloseTo(Number(row[1]) + offset, 4);
        if (native) for (const axis of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + axis]).toBe(0);
      });
    }
  });

  test("every new native Q206 member clears actual retained 2.5m runtime source matrices", () => {
    const source = createMinecraftGendarmenmarktPerimeterShells().children[0] as InstancedMesh;
    const matrix = new Matrix4(), boxes: number[][] = [];
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, matrix);
      const e = matrix.elements, x = e[12], z = e[14];
      if (x < 1200 || x > 1290 || z < 580 || z > 680) continue;
      boxes.push([x - e[0] / 2, e[13] - e[5] / 2, z - e[10] / 2, x + e[0] / 2, e[13] + e[5] / 2, z + e[10] / 2]);
    }
    expect(boxes.length).toBeGreaterThan(100);
    for (const row of data.blocks) {
      if (data.owners[Number(row[7])].kind !== "quartier206") continue;
      const [x, y, z, w, h, d] = row.slice(0, 6).map(Number);
      const overlaps = boxes.some(([x0, y0, z0, x1, y1, z1]) =>
        x - w / 2 < x1 && x + w / 2 > x0 && y - h / 2 < y1 && y + h / 2 > y0 && z - d / 2 < z1 && z + d / 2 > z0);
      expect(overlaps).toBe(false);
    }
  });

  test("world disposal cannot dispose another world's storage", () => {
    const roots = [createLabourQuartierV208(), createLabourQuartierV208(true), createLabourQuartierV208()];
    const meshes = roots.flatMap(r => r.children as Mesh[]);
    expect(new Set(meshes.map(m => m.geometry)).size).toBe(meshes.length);
    expect(new Set(meshes.flatMap(m => [m.userData.dayMaterial, m.userData.nightMaterial])).size).toBe(meshes.length * 2);
  });
});
