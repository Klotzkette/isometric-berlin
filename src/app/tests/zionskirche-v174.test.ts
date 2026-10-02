import { expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { Box3, InstancedMesh, Mesh, Texture } from "three";
import { createMinecraftZionskircheV174, createZionskircheV174,
  ZIONSKIRCHE_V174_RENDER_BUDGET } from "../src/ZionskircheV174";
import { ZIONSKIRCHE_V174_PROFILE, ZIONSKIRCHE_V174_TOWER_CENTER,
  ZIONSKIRCHE_V174_TOWER_RING, zionskircheV174RoofAt } from "../src/zionskircheV174Profile";
import drawn from "../src/data/zionskircheV174Drawn.json";
import native from "../src/data/zionskircheV174Native.json";
import evidence from "../src/data/zionskircheV174Evidence.json";

function bytes(mesh: Mesh): number {
  return Object.values(mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) +
    (mesh.geometry.index?.array.byteLength ?? 0) + (mesh instanceof InstancedMesh ?
      mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0) : 0);
}

test("Zionskirche retains its source owner and existing outer-ground datum", () => {
  expect(ZIONSKIRCHE_V174_PROFILE.parentId).toBe("DEBE01YYK0000014");
  expect(ZIONSKIRCHE_V174_PROFILE.osmWayId).toBe("27685450");
  expect(ZIONSKIRCHE_V174_PROFILE.monumentId).toBe("09011312");
  expect(ZIONSKIRCHE_V174_PROFILE.groundY).toBe(3);
  expect(evidence.verticalTransform.offsetY).toBe(-50.332);
  expect(evidence.sourceBoundaryPolygons).toBe(228);
  expect(evidence.partIds).toHaveLength(4);
  expect(ZIONSKIRCHE_V174_PROFILE.sourceShellDuplicated).toBe(false);
  expect(ZIONSKIRCHE_V174_PROFILE.sourcePacketsChanged).toBe(false);
  expect(evidence.publishedOverallHeightM).toBe(67);
  expect(evidence.sourceTowerHeightM + evidence.authoredHeightDifferenceM).toBeCloseTo(67, 8);
  expect(drawn.spire.ring).toEqual(ZIONSKIRCHE_V174_TOWER_RING);
});

test("eager navigation has no drawn/native data import or startup decode", () => {
  const url = new URL("../src/zionskircheV174Profile.ts", import.meta.url);
  const text = readFileSync(url, "utf8");
  expect(statSync(url).size).toBeLessThan(6500);
  expect(text).not.toMatch(/import\s.*(Drawn|Native|Evidence|data\/)/);
  expect(text).not.toContain("JSON.parse");
});

test("all drawn profiles retain the complete bounded texture-free model", () => {
  const a = createZionskircheV174(), b = createZionskircheV174({ mobileLike: true });
  expect(a.children).toHaveLength(3);
  let total = 0;
  for (let i = 0; i < a.children.length; i++) {
    const x = a.children[i] as Mesh, y = b.children[i] as Mesh;
    total += bytes(x);
    expect(x.matrixAutoUpdate).toBe(false);
    expect(x.geometry.getAttribute("position").array).toEqual(y.geometry.getAttribute("position").array);
    expect(x.geometry.getAttribute("uv")).toBeUndefined();
    for (const material of [x.userData.dayMaterial, x.userData.nightMaterial]) {
      expect(Object.values(material).some(value => value instanceof Texture)).toBe(false);
    }
    if (x instanceof InstancedMesh && y instanceof InstancedMesh) {
      expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
      expect(x.instanceColor!.array).toEqual(y.instanceColor!.array);
    }
  }
  const bounds = new Box3().setFromObject(a);
  expect(bounds.max.y).toBeCloseTo(70, 4);
  expect(bounds.min.y).toBeGreaterThan(2.7);
  expect(total).toBeLessThan(1_600_000);
  expect((a.children[1] as InstancedMesh).count).toBe(ZIONSKIRCHE_V174_RENDER_BUDGET.facadeInstances);
  expect((a.children[2] as InstancedMesh).count).toBe(ZIONSKIRCHE_V174_RENDER_BUDGET.detailInstances);
  console.log({ zionskircheDrawnBytes: total, batches: a.children.length });
});

test("native reading retains arches clocks galleries and a 67 m stepped spire", () => {
  const a = createMinecraftZionskircheV174(), b = createMinecraftZionskircheV174({ mobileLike: true });
  expect(a.children).toHaveLength(1);
  const x = a.children[0] as InstancedMesh, y = b.children[0] as InstancedMesh;
  expect(x.count).toBe(native.blocks.length);
  expect(x.count).toBe(5677);
  expect(bytes(x)).toBeLessThan(450_000);
  expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
  expect(new Set(native.blocks.map(r => r[5]))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  for (let i = 0; i < x.count; i++) {
    const m = x.instanceMatrix.array;
    expect([m[i * 16 + 1], m[i * 16 + 2], m[i * 16 + 4], m[i * 16 + 6], m[i * 16 + 8], m[i * 16 + 9]]).toEqual([0, 0, 0, 0, 0, 0]);
    // Vertically adjacent equal-color cubes are coalesced without new fill.
    expect(m[i * 16 + 5] % .25).toBe(0);
    expect(m[i * 16]).toBe(m[i * 16 + 10]);
  }
  const bounds = new Box3().setFromObject(a);
  expect(bounds.max.y).toBe(70);
  console.log({ zionskircheNativeBytes: bytes(x), blocks: x.count, batches: 1 });
});

test("native column compression retains distinct occupied cells without filling gaps", () => {
  const cells = new Set<string>();
  for (const [x, y, z, , size, , height, depth] of native.blocks) {
    expect(size).toBe(depth);
    const count = height / size;
    expect(count).toBe(Math.round(count));
    for (let iy = 0; iy < count; iy++) {
      const key = `${size},${x},${y - height / 2 + (iy + .5) * size},${z}`;
      expect(cells.has(key)).toBe(false);
      cells.add(key);
    }
  }
  expect(cells.size).toBe(44298);
});

test("additive roof query stays on the spire and agrees with upper native solids", () => {
  const [cx, cz] = ZIONSKIRCHE_V174_TOWER_CENTER;
  expect(zionskircheV174RoofAt(cx, cz)).toBe(70);
  expect(zionskircheV174RoofAt(cx + 3, cz)).toBeGreaterThan(53);
  expect(zionskircheV174RoofAt(cx + 3, cz)).toBeLessThan(61);
  expect(zionskircheV174RoofAt(2228, -1718)).toBeNull();
  expect(zionskircheV174RoofAt(cx + 8, cz)).toBeNull();
  createMinecraftZionskircheV174();
  for (const [x, y, z, , , role, height] of native.blocks) {
    if (role < 9) continue;
    expect(zionskircheV174RoofAt(x, z, true)!).toBeGreaterThanOrEqual(y + height / 2);
  }
  expect(zionskircheV174RoofAt(2228, -1718, true)).toBeNull();
});
