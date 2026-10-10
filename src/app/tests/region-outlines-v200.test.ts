import { expect, test } from "bun:test";
import { LineSegments, Material, Mesh } from "three";
import {
  createRegionOutlinesV200, regionalV200NavigationTiles,
  regionalV200SolidAt, regionalV200WaterAt,
} from "../src/RegionOutlinesV200";
import drawn from "../src/data/regionOutlinesV200.json";
import nativeSource from "../src/data/regionOutlinesV200Native.json";

function release(root: ReturnType<typeof createRegionOutlinesV200>): void {
  root.traverse(object => {
    if (!(object instanceof LineSegments) && !(object instanceof Mesh)) return;
    const line = object as LineSegments;
    for (const material of new Set([line.material, line.userData.dayMaterial, line.userData.nightMaterial])) {
      if (material instanceof Material) material.dispose();
    }
    line.geometry.dispose();
  });
}

test("each regional family preserves fourteen exact batches plus the bounded BER refinement", () => {
  for (const native of [false, true]) {
    const root = createRegionOutlinesV200(native);
    const source = native ? nativeSource : drawn;
    let bytes = 0;
    expect(root.children.length).toBe(15);
    expect(root.children[14].name).toContain("BER Willy Brandt");
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.blockNative).toBe(native);
    for (let b = 0; b < 14; b++) {
      const line = root.children[b] as LineSegments;
      expect(line).toBeInstanceOf(LineSegments);
      expect(line.matrixAutoUpdate).toBe(false);
      expect(line.frustumCulled).toBe(true);
      expect(line.geometry.getAttribute("uv")).toBeUndefined();
      const pos = line.geometry.getAttribute("position");
      const color = line.geometry.getAttribute("color");
      expect(pos.count).toBe(source.groups[b].features.reduce((n, f) => n + f.vertexCount, 0));
      expect(color.count).toBe(pos.count);
      expect(color.normalized).toBe(true);
      expect(line.geometry.boundingSphere!.radius).toBeLessThan(17000);
      expect(line.userData.dayMaterial).not.toBe(line.userData.nightMaterial);
      for (const attribute of Object.values(line.geometry.attributes)) {
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        bytes += attribute.array.byteLength;
      }
      // The selected source endpoints remain exact to the Float32 precision
      // needed at the outermost forty-kilometre coordinate, below 0.004 metres.
      const packed = Buffer.from(source.groups[b].positionsCm, "base64");
      for (let i = 0; i < pos.array.length; i++) {
        expect(Math.abs(pos.array[i] - packed.readInt32LE(i * 4) / 100)).toBeLessThan(.004);
      }
    }
    expect(bytes).toBeLessThan(2_600_000);
    release(root);
    const recreated = createRegionOutlinesV200(native);
    expect((recreated.children[0] as LineSegments).geometry).not.toBe((root.children[0] as LineSegments).geometry);
    release(recreated);
  }
});

test("stable regional navigation recognizes current terminals and preserves the island opening", () => {
  const tiles = regionalV200NavigationTiles;
  expect(tiles).toBe(regionalV200NavigationTiles);
  expect(tiles.length).toBeGreaterThan(100);
  expect(tiles.length).toBeLessThan(150);
  expect(regionalV200SolidAt(8938.88, 10, 17436.53)).toBe(true);
  expect(regionalV200SolidAt(8938.88, 36, 17436.53)).toBe(false);
  expect(regionalV200SolidAt(8335.38, 72, 17572.79)).toBe(true);
  expect(regionalV200SolidAt(8335.38, 74, 17572.79)).toBe(false);
  expect(regionalV200WaterAt(29904.92, 11485.49)).toBe(true);
  expect(regionalV200WaterAt(0, 0)).toBe(false);
  expect(regionalV200SolidAt(NaN, 3, 0)).toBe(false);
  expect(regionalV200WaterAt(Infinity, 0)).toBe(false);
  expect(tiles.reduce((n, t) => n + t.nav.roads!.length, 0)).toBeGreaterThan(1000);
});
