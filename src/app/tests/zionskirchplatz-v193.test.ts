import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import data from "../src/data/zionskirchplatzV193.json";
import { createZionskirchplatzV193, ZIONSKIRCHPLATZ_V193_OWNER_OFFSETS } from "../src/ZionskirchplatzV193";
import { buildingTerrainOffset } from "../src/weinbergTerrainV176";

describe("complete source-bound Zionskirchplatz perimeter", () => {
  test("all twenty owners retain their separate hill datums", () => {
    expect(data.owners.length).toBe(20);
    data.owners.forEach((o, i) => expect(ZIONSKIRCHPLATZ_V193_OWNER_OFFSETS[i]).toBe(buildingTerrainOffset(o.id, o.anchor[0], o.anchor[1], o.groundY)));
    const offsets = new Set(ZIONSKIRCHPLATZ_V193_OWNER_OFFSETS);
    expect(offsets.size).toBeGreaterThan(12);
    expect(Math.min(...offsets)).toBeGreaterThan(10);
    for (const native of [false, true]) {
      const root = createZionskirchplatzV193(native);
      const mesh = root.children[root.children.length - 1] as InstancedMesh;
      const rows = native ? data.blocks : data.boxes;
      rows.forEach((r, i) => {
        const matrix = mesh.instanceMatrix.array;
        expect(matrix[i * 16 + 13]).toBeCloseTo(r[1] + ZIONSKIRCHPLATZ_V193_OWNER_OFFSETS[r[native ? 8 : 11]], 4);
        expect(matrix[i * 16 + 12]).toBeCloseTo(r[0], 3);
        expect(matrix[i * 16 + 14]).toBeCloseTo(r[2], 3);
      });
    }
  });
  test("full detail stays in two drawn or one orthogonal native batch", () => {
    for (const native of [false, true]) {
      const root = createZionskirchplatzV193(native);
      expect(root.children.length).toBe(native ? 1 : 2);
      expect(root.userData.additiveOnly).toBe(true);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      let bytes = 0;
      for (const child of root.children) {
        const mesh = child as Mesh;
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
        expect((mesh instanceof InstancedMesh ? mesh.boundingSphere! : mesh.geometry.boundingSphere!).radius).toBeGreaterThan(1);
        for (const a of Object.values(mesh.geometry.attributes)) bytes += a.array.byteLength;
        bytes += mesh.geometry.index?.array.byteLength ?? 0;
        if (mesh instanceof InstancedMesh) {
          bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
          expect(mesh.count).toBe(native ? 7006 : 2114);
          if (native) for (let i = 0; i < mesh.count; i++) {
            for (const j of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + j]).toBe(0);
          }
        }
      }
      expect(bytes).toBe(native ? 533104 : 173192);
      expect(bytes).toBeLessThan(1024 * 1024);
    }
  });
});
