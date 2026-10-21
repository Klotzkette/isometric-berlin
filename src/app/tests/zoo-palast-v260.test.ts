import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Box3, Color, InstancedMesh, Mesh } from "three";
import source from "../src/data/cityWestCinemasV166Source.json";
import anchors from "../src/data/zooPalastV260.json";
import { createMinecraftZooPalastV260, createZooPalastV260, ZOO_PALAST_V260_BOUNDS } from "../src/ZooPalastV260";

function inspect(root: ReturnType<typeof createZooPalastV260>) {
  let bytes = 0, calls = 0, instances = 0;
  const hash = createHash("sha256");
  root.traverse(object => {
    expect(object.matrixAutoUpdate).toBe(false);
    if (!(object instanceof Mesh)) return;
    calls++; expect(object.userData.textureFree).toBe(true);
    for (const a of Object.values(object.geometry.attributes)) {
      bytes += a.array.byteLength;
      hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
      expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
    }
    bytes += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) {
      instances += object.count;
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      hash.update(new Uint8Array(object.instanceMatrix.array.buffer));
      hash.update(new Uint8Array(object.instanceColor!.array.buffer));
      for (let i = 0; i < object.count; i++) {
        const m = object.instanceMatrix.array.slice(i * 16, i * 16 + 16);
        expect(Array.from(m).every(Number.isFinite)).toBe(true);
        expect(Math.hypot(m[0], m[1], m[2])).toBeGreaterThan(0);
        expect(m[5]).toBeGreaterThan(0);
        expect(Math.hypot(m[8], m[9], m[10])).toBeGreaterThan(0);
        if (root.userData.nativeMinecraft) for (const index of [1, 2, 4, 6, 8, 9]) expect(Math.abs(m[index])).toBe(0);
      }
    }
  });
  const bounds = new Box3().setFromObject(root), b = ZOO_PALAST_V260_BOUNDS;
  expect(bounds.min.x).toBeGreaterThanOrEqual(b.minX);
  expect(bounds.min.y).toBeGreaterThanOrEqual(b.minY);
  expect(bounds.min.z).toBeGreaterThanOrEqual(b.minZ);
  expect(bounds.max.x).toBeLessThanOrEqual(b.maxX);
  expect(bounds.max.y).toBeLessThanOrEqual(b.maxY);
  expect(bounds.max.z).toBeLessThanOrEqual(b.maxZ);
  return { bytes, calls, instances, hash: hash.digest("hex") };
}

describe("Zoo Palast v260 additive recognition", () => {
  test("retains the exact prior city source and anchors fittings on its measured street facades", () => {
    const bytes = readFileSync(new URL("../src/data/cityWestCinemasV166Source.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(anchors.sourceSha256);
    const walls = source.surfaces.filter(s => anchors.sourcePolygonIds.includes(s.sourcePolygonId));
    expect(walls).toHaveLength(22);
    expect(walls.every(s => s.partId === "DEBE3DjeP5aTIgFW" && s.kind === "WallSurface")).toBe(true);
    for (const [x, z, low, high] of anchors.curve) {
      expect(walls.some(s => s.rings.flat().some(p => p[0] === x && p[1] === low && p[2] === z))).toBe(true);
      expect(walls.some(s => s.rings.flat().some(p => p[0] === x && p[1] === high && p[2] === z))).toBe(true);
      expect(high - low).toBeGreaterThan(12);
    }
    const foyer = source.parts.find(p => p.id === "DEBE3DX38LUj5DUN")!;
    for (const p of anchors.front) expect(foyer.polygons[0].ring.some(q => p[0] === q[0] && p[1] === q[1])).toBe(true);
    expect(anchors.studs.length).toBeGreaterThan(80);
    for (const s of anchors.studs) expect(source.facadeBoxes.some(p => p.every((v, i) => v === s[i]))).toBe(true);
  });
  test("complete drawn detail stays identical on touch and inside a small local budget", () => {
    const desktop = inspect(createZooPalastV260()), touch = inspect(createZooPalastV260({ mobileLike: true }));
    expect(desktop).toEqual(touch); expect(desktop.calls).toBe(2);
    expect(desktop.bytes).toBeLessThan(300_000); expect(desktop.instances).toBeGreaterThan(800);
    expect(createZooPalastV260().userData).toMatchObject({ portholes: 3, posterCases: 4, additiveOnly: true, fullStaticDetailOnTouch: true });
  });
  test("native uses only independently orthogonal fittings and has full touch parity", () => {
    const desktop = inspect(createMinecraftZooPalastV260()), touch = inspect(createMinecraftZooPalastV260({ mobileLike: true }));
    expect(desktop).toEqual(touch); expect(desktop.calls).toBe(1);
    expect(desktop.bytes).toBeLessThan(130_000); expect(desktop.instances).toBeGreaterThan(1200);
    expect(createMinecraftZooPalastV260().userData.noHiddenSolidInfill).toBe(true);
  });
  test("native inscription is not buried behind the retained source blocks in the checked front-right view", () => {
    const m = createMinecraftZooPalastV260().children[0] as InstancedMesh;
    const white = new Color(0xf5efdb).toArray(), camera = [-2550, 36, 1438];
    const cells = source.nativeBlocks.filter(b => b[0] > -2600 && b[0] < -2540 && b[2] > 1360 && b[2] < 1410);
    let letters = 0, blocked = 0;
    for (let i = 0; i < m.count; i++) {
      const color = Array.from(m.instanceColor!.array.slice(i * 3, i * 3 + 3));
      if (!color.every((v, j) => Math.abs(v - white[j]) < 1e-5)) continue;
      letters++;
      const p = Array.from(m.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15));
      const direction = p.map((v, j) => v - camera[j]);
      // Analytic segment/AABB intersection against the exact retained native
      // two-metre shell, independent of the addon's outward-placement code.
      if (cells.some(cell => {
        let low = 0, high = 1;
        for (let j = 0; j < 3; j++) {
          let a = (cell[j] - 1 - camera[j]) / direction[j], b = (cell[j] + 1 - camera[j]) / direction[j];
          if (a > b) [a, b] = [b, a];
          low = Math.max(low, a); high = Math.min(high, b);
        }
        return high >= low && low < .998;
      })) blocked++;
    }
    expect(letters).toBeGreaterThan(200); expect(blocked).toBe(0);
  });
});
