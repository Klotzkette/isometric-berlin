import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import data from "../src/data/librariesV202.json";
import evidence from "../src/data/librariesV202Evidence.json";
import { createLibrariesV202, LIBRARIES_V202_OWNER_OFFSETS } from "../src/LibrariesV202";
import { buildingTerrainOffset } from "../src/weinbergTerrainV176";

function bytes(root: ReturnType<typeof createLibrariesV202>): number {
  let result = 0;
  for (const child of root.children) {
    const mesh = child as Mesh;
    for (const a of Object.values(mesh.geometry.attributes)) result += a.array.byteLength;
    result += mesh.geometry.index?.array.byteLength ?? 0;
    if (mesh instanceof InstancedMesh) result += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
  }
  return result;
}

describe("two source-bound Staatsbibliothek houses", () => {
  test("all 18 historic and 56 Scharoun leaves retain their exact source datum", () => {
    expect(data.owners.filter(o => o.site === 0)).toHaveLength(18);
    expect(data.owners.filter(o => o.site === 1)).toHaveLength(56);
    data.owners.forEach((o, i) => expect(LIBRARIES_V202_OWNER_OFFSETS[i]).toBe(buildingTerrainOffset(o.id, o.anchor[0], o.anchor[1], o.groundY)));
    expect(evidence.sourceRecords[0].parts.find(p => p.id === "DEBE3Di3VeB8rUHf")!.footprintPolygons[0].holes).toHaveLength(8);
    const tops = new Map(data.owners.map(o => [o.id, o.topY]));
    expect(tops.get("DEBE3Do7uh0ZOkfL")).toBe(44.875);
    expect(tops.get("DEBE3DbBJ132QVQ7")).toBe(44.648);
  });

  test("both modes are frozen, image-free and bounded below one MiB each", () => {
    for (const native of [false, true]) {
      const root = createLibrariesV202(native);
      expect(root.children).toHaveLength(native ? 1 : 2);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.newCourtWalls).toBe(false);
      expect(root.userData.newPassageClosures).toBe(false);
      expect(bytes(root)).toBeLessThan(1024 * 1024);
      const mesh = root.children.at(-1) as InstancedMesh;
      const rows = native ? data.blocks : data.boxes;
      expect(mesh.count).toBe(rows.length);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], m = mesh.instanceMatrix.array;
        expect(m[i * 16 + 13]).toBeCloseTo(r[1] + LIBRARIES_V202_OWNER_OFFSETS[r[native ? 8 : 11]], 4);
        if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(m[i * 16 + j]).toBe(0);
      }
      for (const child of root.children) {
        const m = child as Mesh;
        expect(m.matrixAutoUpdate).toBe(false);
        expect(m.geometry.getAttribute("uv")).toBeUndefined();
        expect(m.userData.dayMaterial.map).toBeNull();
        expect(m.userData.nightMaterial.map).toBeNull();
      }
    }
  });

  test("library recognition retains large openings and blind magazine walls", () => {
    const archive = data.owners.findIndex(o => o.id === "DEBE3DabeVfooGWp");
    const archiveBoxes = data.boxes.filter(r => r[11] === archive);
    expect(archiveBoxes.some(r => r[8] === 5)).toBe(true);
    expect(archiveBoxes.filter(r => r[8] === 6).every(r => r[1] < 18)).toBe(true);
    const portico = data.boxes.filter(r => r[8] === 8);
    expect(portico.length).toBeGreaterThan(15);
    expect(portico.every(r => r[1] - r[4] / 2 > 10)).toBe(true);
    expect(data.surfaces.some(s => s.role === 7)).toBe(true);
  });

  test("mode disposal never reuses another world's buffers or materials", () => {
    const meshes = [createLibrariesV202(), createLibrariesV202(true), createLibrariesV202()].flatMap(root => root.children as Mesh[]);
    expect(new Set(meshes.map(m => m.geometry)).size).toBe(meshes.length);
    expect(new Set(meshes.flatMap(m => [m.userData.dayMaterial, m.userData.nightMaterial])).size).toBe(meshes.length * 2);
  });
});
