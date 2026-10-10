import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import data from "../src/data/northCorridorV208.json";
import { createHungarianEnvelopeV208, createNorthCorridorV208, NORTH_CORRIDOR_V208_OWNER_OFFSETS } from "../src/NorthCorridorV208";
import { buildingTerrainOffset } from "../src/weinbergTerrainV176";

describe("source-bound Linden corridor facade presentation", () => {
  test("all five measured parents keep their source datums in both modes", () => {
    expect(data.owners.length).toBe(5);
    data.owners.forEach((o, i) => expect(NORTH_CORRIDOR_V208_OWNER_OFFSETS[i]).toBe(buildingTerrainOffset(o.id, o.anchor[0], o.anchor[1], o.groundY)));
    for (const native of [false, true]) {
      const root = createNorthCorridorV208(native);
      const mesh = root.children[native ? 0 : 1] as InstancedMesh;
      const rows = native ? data.blocks : data.boxes;
      expect(mesh.count).toBe(rows.length);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], m = mesh.instanceMatrix.array;
        expect(m[i * 16 + 12]).toBeCloseTo(r[0], 3);
        expect(m[i * 16 + 13]).toBeCloseTo(r[1] + NORTH_CORRIDOR_V208_OWNER_OFFSETS[r[native ? 8 : 9]], 4);
        expect(m[i * 16 + 14]).toBeCloseTo(r[2], 3);
        if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(m[i * 16 + j]).toBe(0);
      }
    }
  });

  test("each mode owns at most three texture-free static batches below one MiB", () => {
    for (const native of [false, true]) {
      const root = createNorthCorridorV208(native);
      expect(root.children.length).toBe(native ? 2 : 3);
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
        if (mesh instanceof InstancedMesh) bytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
      }
      expect(bytes).toBeLessThan(1024 * 1024);
    }
  });

  test("required embassy shell and optional facade sheets have disjoint source ownership", () => {
    const required = createHungarianEnvelopeV208(), optional = createNorthCorridorV208();
    const shell = required.children[0] as Mesh, paint = optional.children[0] as Mesh;
    const count = (faces: typeof data.surfaces) => faces.reduce((sum, face) => sum + face.triangles.length * 3, 0);
    expect(shell.geometry.getAttribute("position").count).toBe(count(data.surfaces.filter(s => s.face === -1)));
    expect(paint.geometry.getAttribute("position").count).toBe(count(data.surfaces.filter(s => s.face !== -1)));
    expect(shell.geometry.getAttribute("position").count + paint.geometry.getAttribute("position").count).toBe(count(data.surfaces));
    expect(required.userData.exactHungarianLegacySubstitution).toBe(true);
    expect(shell.matrixAutoUpdate).toBe(false);
    for (const native of [false, true]) {
      const glow = createNorthCorridorV208(native).children.at(-1) as InstancedMesh;
      expect(glow.count).toBeGreaterThan(100);
      expect(glow.visible).toBe(false);
      expect(glow.userData.nightOnly).toBe(true);
      expect(glow.userData.nightMaterial.emissiveIntensity).toBe(.5);
    }
  });

  test("fresh mode roots never share disposable geometry or material ownership", () => {
    const roots = [createNorthCorridorV208(), createNorthCorridorV208(true), createNorthCorridorV208()];
    const meshes = roots.flatMap(root => root.children as Mesh[]);
    expect(new Set(meshes.map(mesh => mesh.geometry)).size).toBe(meshes.length);
    expect(new Set(meshes.flatMap(mesh => [mesh.userData.dayMaterial, mesh.userData.nightMaterial])).size).toBe(meshes.length * 2);
  });
});
