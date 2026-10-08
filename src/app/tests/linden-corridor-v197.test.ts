import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import data from "../src/data/lindenCorridorV197.json";
import { createLindenCorridorV197, LINDEN_CORRIDOR_V197_OWNER_OFFSETS } from "../src/LindenCorridorV197";
import { buildingTerrainOffset } from "../src/weinbergTerrainV176";

describe("source-bound Linden corridor facade presentation", () => {
  test("all thirteen measured parents keep their source datums in both modes", () => {
    expect(data.owners.length).toBe(13);
    data.owners.forEach((o, i) => expect(LINDEN_CORRIDOR_V197_OWNER_OFFSETS[i]).toBe(buildingTerrainOffset(o.id, o.anchor[0], o.anchor[1], o.groundY)));
    for (const native of [false, true]) {
      const root = createLindenCorridorV197(native);
      const mesh = root.children.at(-1) as InstancedMesh;
      const rows = native ? data.blocks : data.boxes;
      expect(mesh.count).toBe(rows.length);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], m = mesh.instanceMatrix.array;
        expect(m[i * 16 + 12]).toBeCloseTo(r[0], 3);
        expect(m[i * 16 + 13]).toBeCloseTo(r[1] + LINDEN_CORRIDOR_V197_OWNER_OFFSETS[r[native ? 8 : 11]], 4);
        expect(m[i * 16 + 14]).toBeCloseTo(r[2], 3);
        if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(m[i * 16 + j]).toBe(0);
      }
    }
  });

  test("each mode owns at most two texture-free static batches below one MiB", () => {
    for (const native of [false, true]) {
      const root = createLindenCorridorV197(native);
      expect(root.children.length).toBe(native ? 1 : 2);
      expect(root.userData.sourceGeometryRetained).toBe(true);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.nativeMinecraft).toBe(native);
      let bytes = 0;
      for (const child of root.children) {
        const mesh = child as Mesh;
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
        expect(mesh.userData.dayMaterial.map).toBeNull();
        expect(mesh.userData.nightMaterial.map).toBeNull();
        expect((mesh instanceof InstancedMesh ? mesh.boundingSphere! : mesh.geometry.boundingSphere!).radius).toBeGreaterThan(1);
        for (const a of Object.values(mesh.geometry.attributes)) bytes += a.array.byteLength;
        bytes += mesh.geometry.index?.array.byteLength ?? 0;
        if (mesh instanceof InstancedMesh) bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      }
      expect(bytes).toBeLessThan(1024 * 1024);
    }
  });

  test("fresh mode roots never share disposable geometry or material ownership", () => {
    const roots = [createLindenCorridorV197(), createLindenCorridorV197(true), createLindenCorridorV197()];
    const meshes = roots.flatMap(root => root.children as Mesh[]);
    expect(new Set(meshes.map(mesh => mesh.geometry)).size).toBe(meshes.length);
    expect(new Set(meshes.flatMap(mesh => [mesh.userData.dayMaterial, mesh.userData.nightMaterial])).size).toBe(meshes.length * 2);
  });
});
