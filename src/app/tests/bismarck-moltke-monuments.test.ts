import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  Object3D,
  Raycaster,
  Vector3,
} from "three";
import {
  BISMARCK_MOLTKE_PROFILES,
  BISMARCK_MOLTKE_PRISM_IDS,
  bismarckMoltkeSolidAt,
  bismarckMoltkeSourceColumnAt,
  createBismarckMoltkeMonuments,
  createMinecraftBismarckMoltkeMonuments,
  setBismarckMoltkeSnow,
} from "../src/BismarckMoltkeMonuments";
import source from "../src/bismarckMoltkeSource.json";

type Key = keyof typeof BISMARCK_MOLTKE_PROFILES;
function world(key: Key, x: number, y: number, z: number): Vector3 {
  const p = BISMARCK_MOLTKE_PROFILES[key],
    c = Math.cos(p.rotationY),
    s = Math.sin(p.rotationY);
  return new Vector3(
    p.worldM[0] + c * x + s * z,
    p.worldM[1] + y,
    p.worldM[2] - s * x + c * z,
  );
}
function stats(root: Object3D): {
  renderables: number;
  vertices: number;
  blocks: number;
} {
  const result = { renderables: 0, vertices: 0, blocks: 0 };
  root.traverse((o) => {
    if (o instanceof Mesh || o instanceof LineSegments) {
      result.renderables++;
      result.vertices +=
        o.geometry.getAttribute("position").count *
        (o instanceof InstancedMesh ? o.count : 1);
      if (o instanceof InstancedMesh) result.blocks += o.count;
    }
  });
  return result;
}

describe("Bismarck and Moltke present-day source-bound monuments", () => {
  test("retains exact OSM anchors, DGM ground and all three conflicting LoD2 records", () => {
    expect(BISMARCK_MOLTKE_PROFILES.bismarck.worldM).toEqual([
      -1479.688344, 5.2, 300.73664,
    ]);
    expect(BISMARCK_MOLTKE_PROFILES.moltke.worldM).toEqual([
      -1420.113409, 5.2, 351.650691,
    ]);
    expect([...BISMARCK_MOLTKE_PRISM_IDS].sort()).toEqual([
      "2iy0007y",
      "Mo00007F",
      "Mo00007J",
    ]);
    expect(source.parts[1].ring).toEqual(source.parts[2].ring);
    expect(source.sourceColumns).toHaveLength(5);
    for (const c of source.sourceColumns) {
      expect(bismarckMoltkeSourceColumnAt(c[0], c[1], c[2], c[3])).toBe(true);
      expect(bismarckMoltkeSourceColumnAt(c[0], c[1], c[2], c[3] + 4)).toBe(
        false,
      );
    }
    expect(bismarckMoltkeSourceColumnAt(-1482, 306, 5.2, 9.2)).toBe(false);
    expect(BISMARCK_MOLTKE_PROFILES.moltke.totalHeightStatus).toContain(
      "11.5 m describes the lost 1905",
    );
  });
  test("actual triangles preserve the published Bismarck height and the lower current Moltke silhouette", () => {
    const root = createBismarckMoltkeMonuments();
    root.updateMatrixWorld(true);
    for (const key of ["bismarck", "moltke"] as const) {
      const part = root.children.find((o) => o.userData.monumentKey === key)!;
      const box = new Box3().setFromObject(part),
        p = BISMARCK_MOLTKE_PROFILES[key];
      expect(box.max.y - p.worldM[1]).toBeCloseTo(p.totalHeightM, 4);
      expect(box.min.y).toBeCloseTo(p.worldM[1], 4);
      expect(box.max.x - box.min.x).toBeLessThan(key === "bismarck" ? 17 : 6);
    }
    // Four distinct assistive groups occupy all four cardinal sides of the base.
    for (const [x, z, minHeight] of [
      [0, 2.15, 6],
      [-4.36, 0, 5.7],
      [4.49, 0, 6],
      [0, -2.2, 5.3],
    ]) {
      const ray = new Raycaster(
        world("bismarck", x, 25, z),
        new Vector3(0, -1, 0),
      );
      const hits = ray
        .intersectObject(root, true)
        .filter((h) => h.object instanceof Mesh);
      expect(hits[0]?.point.y).toBeGreaterThan(5.2 + minHeight);
    }
    const p = BISMARCK_MOLTKE_PROFILES.moltke;
    const front = new Vector3(Math.sin(p.rotationY), 0, Math.cos(p.rotationY));
    // Open leg-side space and the two solid rear columns are tested on the mesh.
    const leftColumn = new Raycaster(
      world("moltke", -0.94, 4.7, 4),
      front.clone().negate(),
    ).intersectObject(root, true);
    expect(leftColumn.some((h) => h.object instanceof Mesh)).toBe(true);
    const legCrossing = new Raycaster(
      world("moltke", 0, 4.8, 4),
      front.clone().negate(),
    ).intersectObject(root, true);
    expect(legCrossing.some((h) => h.object instanceof Mesh)).toBe(true);
  });
  test("only the physical sculptural solids block walking; all surrounding approaches remain free", () => {
    for (const key of ["bismarck", "moltke"] as const) {
      const c = world(key, 0, 1.4, 0);
      expect(bismarckMoltkeSolidAt(c.x, c.y, c.z)).toBe(true);
      for (let i = 0; i < 8; i++) {
        const p = world(
          key,
          Math.cos((i * Math.PI) / 4) * 12,
          1.6,
          Math.sin((i * Math.PI) / 4) * 12,
        );
        expect(bismarckMoltkeSolidAt(p.x, p.y, p.z, 0.42)).toBe(false);
      }
      const above = world(key, 0, 19, 0);
      expect(bismarckMoltkeSolidAt(above.x, above.y, above.z)).toBe(false);
    }
    const gap = world("moltke", 1.7, 5, 1.5);
    expect(bismarckMoltkeSolidAt(gap.x, gap.y, gap.z)).toBe(false);
    expect(bismarckMoltkeSolidAt(NaN, 5, 0)).toBe(false);
  });
  test("full and phone Minecraft use cubes at both source anchors and retain the sculpture identities", () => {
    for (const mobileLike of [false, true]) {
      const root = createMinecraftBismarckMoltkeMonuments({ mobileLike });
      root.updateMatrixWorld(true);
      expect(root.children).toHaveLength(2);
      const total = stats(root);
      expect(total.renderables).toBe(2);
      expect(total.blocks).toBeLessThan(mobileLike ? 3400 : 6500);
      const dummy = new Matrix4(),
        point = new Vector3();
      for (const child of root.children) {
        expect(child).toBeInstanceOf(InstancedMesh);
        const mesh = child as InstancedMesh;
        expect(mesh.geometry.type).toBe("BoxGeometry");
        expect(mesh.userData.textureFree).toBe(true);
        const p = BISMARCK_MOLTKE_PROFILES[mesh.userData.monumentKey as Key];
        expect(mesh.position.toArray()).toEqual([...p.worldM]);
        expect(mesh.userData.solidCues).toContain(
          mesh.userData.monumentKey === "bismarck"
            ? "atlas-globe-front"
            : "moltke-crossed-legs",
        );
        // Exterior block face samples remain inside the common pedestrian solids.
        for (let i = 0; i < mesh.count; i += 37) {
          mesh.getMatrixAt(i, dummy);
          point.setFromMatrixPosition(dummy).applyMatrix4(mesh.matrixWorld);
          expect(bismarckMoltkeSolidAt(point.x, point.y, point.z)).toBe(true);
        }
      }
    }
  });
  test("snow is reversible and all meshes carry the standard night-material hooks without textures", () => {
    const root = createBismarckMoltkeMonuments(),
      original = root.children.map((o) => o.matrix.toArray());
    const snow: Object3D[] = [];
    root.traverse((o) => {
      if (o.userData.bismarckMoltkeSnow) snow.push(o);
      if (o instanceof Mesh) {
        expect(o.userData.dayMaterial).toBeDefined();
        expect(o.userData.nightMaterial).toBeDefined();
        expect((o.material as any).map ?? null).toBeNull();
      }
    });
    expect(snow.length).toBeGreaterThan(0);
    expect(snow.every((o) => !o.visible)).toBe(true);
    setBismarckMoltkeSnow(root, true);
    expect(snow.every((o) => o.visible)).toBe(true);
    setBismarckMoltkeSnow(root, false);
    expect(snow.every((o) => !o.visible)).toBe(true);
    expect(root.children.map((o) => o.matrix.toArray())).toEqual(original);
    expect(stats(root).renderables).toBe(6);
    expect(stats(root).vertices).toBeLessThan(36000);
    expect(
      stats(createBismarckMoltkeMonuments({ mobileLike: true })).vertices,
    ).toBeLessThan(22000);
  });
});
