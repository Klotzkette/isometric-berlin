import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import data from "../src/data/ministrySpreeV207.json";
import evidence from "../src/data/ministrySpreeV207Evidence.json";
import { createMinistrySpreeV207, MINISTRY_SPREE_V207_OWNER_OFFSETS } from "../src/MinistrySpreeV207";
import { buildingTerrainOffset } from "../src/weinbergTerrainV176";

function bytes(root: ReturnType<typeof createMinistrySpreeV207>): number {
  let result = 0;
  for (const child of root.children) {
    const mesh = child as Mesh;
    for (const a of Object.values(mesh.geometry.attributes)) result += a.array.byteLength;
    result += mesh.geometry.index?.array.byteLength ?? 0;
    if (mesh instanceof InstancedMesh) result += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
  }
  return result;
}

describe("source-bound green Kapelle-Ufer ministry", () => {
  test("ten ministry leaves plus the entrance keep all three main courtyards and datums", () => {
    expect(data.owners).toHaveLength(11);
    expect(new Set(data.owners.map(o => o.parentId))).toEqual(new Set(["DEBE01YYK00005iG", "DEBE01YYK0001xGY"]));
    expect(evidence.sourceParts.find(p => p.id === "DEBE3DvYGtxhg1Aq")!.holes).toHaveLength(3);
    expect(evidence.sourceParts.reduce((sum, p) => sum + p.surfaces.length, 0)).toBe(138);
    data.owners.forEach((o, i) => expect(MINISTRY_SPREE_V207_OWNER_OFFSETS[i]).toBe(buildingTerrainOffset(o.id, o.anchor[0], o.anchor[1], o.groundY)));
  });

  test("all static detail is tight, texture-free, frozen and shared across touch quality", () => {
    for (const native of [false, true]) {
      const root = createMinistrySpreeV207(native);
      expect(root.children).toHaveLength(native ? 2 : 3);
      expect(root.userData.additiveOnly).toBe(true);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.newCourtWalls).toBe(false);
      expect(bytes(root)).toBeLessThan(1600 * 1024);
      const mesh = root.children[native ? 0 : 1] as InstancedMesh;
      const rows = native ? data.blocks : data.boxes;
      expect(mesh.count).toBe(rows.length);
      expect(mesh.instanceMatrix.array.length).toBe(rows.length * 16);
      expect(mesh.instanceColor!.array.length).toBe(rows.length * 3);
      rows.forEach((r, i) => {
        const m = mesh.instanceMatrix.array;
        expect(m[i * 16 + 13]).toBeCloseTo(r[1] + MINISTRY_SPREE_V207_OWNER_OFFSETS[r[native ? 8 : 9]], 4);
        if (native) for (const k of [1, 2, 4, 6, 8, 9]) expect(m[i * 16 + k]).toBe(0);
      });
      for (const child of root.children as Mesh[]) {
        expect(child.matrixAutoUpdate).toBe(false);
        expect(child.geometry.getAttribute("uv")).toBeUndefined();
        expect(child.userData.dayMaterial.map).toBeNull();
        expect(child.userData.nightMaterial.map).toBeNull();
      }
    }
  });

  test("night glazing retains the shared lights-off contract in both representations", () => {
    for (const native of [false, true]) {
      const glow = createMinistrySpreeV207(native).children.at(-1) as InstancedMesh;
      expect(glow.userData.nightOnly).toBe(true);
      expect(glow.visible).toBe(false);
      expect(glow.userData.nightMaterial.userData.nightEmissiveIntensity).toBe(.7);
      expect(glow.count).toBeGreaterThan(30);
      expect(glow.instanceMatrix.array.length).toBe(glow.count * 16);
    }
  });

  test("world disposal does not reuse another world's buffers or materials", () => {
    const meshes = [createMinistrySpreeV207(), createMinistrySpreeV207(true), createMinistrySpreeV207()].flatMap(root => root.children as Mesh[]);
    expect(new Set(meshes.map(m => m.geometry)).size).toBe(meshes.length);
    expect(new Set(meshes.flatMap(m => [m.userData.dayMaterial, m.userData.nightMaterial])).size).toBe(meshes.length * 2);
  });
});
