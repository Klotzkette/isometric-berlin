import { describe, expect, test } from "bun:test";

import {
  VOXEL_BASE_CELL_CAP_DEVICE_PX,
  voxelCellForScale,
  voxelGridOffset,
} from "../src/visual-modes/minecraft/voxelGrid";

async function readShader(name: string): Promise<string> {
  return Bun.file(
    new URL(`../src/visual-modes/minecraft/${name}`, import.meta.url),
  ).text();
}

describe("Minecraft voxel grid world anchoring", () => {
  test("wraps the anchor into a single block cell", () => {
    const block = 4.7;
    const [x, y] = voxelGridOffset(9.4, 2.35, block);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(block);
    expect(y).toBeCloseTo(2.35, 6);
    // 9.4 == 2 * 4.7, so it wraps back to 0.
    expect(x).toBeCloseTo(0, 6);
  });

  test("is world-periodic: shifting the anchor by whole blocks is identical", () => {
    const block = 5.6;
    const [ax, ay] = voxelGridOffset(1.4, 3.1, block);
    const [bx, by] = voxelGridOffset(1.4 + block * 3, 3.1 - block * 2, block);
    expect(bx).toBeCloseTo(ax, 6);
    expect(by).toBeCloseTo(ay, 6);
  });

  test("handles negative pans without producing a negative offset", () => {
    const block = 4.7;
    const [x, y] = voxelGridOffset(-1, -block - 0.5, block);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(block);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(block);
  });

  test("falls back to a zero offset for non-finite input", () => {
    expect(voxelGridOffset(Number.NaN, 0, 4.7)).toEqual([0, 0]);
    expect(voxelGridOffset(0, Number.POSITIVE_INFINITY, 4.7)).toEqual([0, 0]);
  });
});

describe("Minecraft blocks stay glued under zoom", () => {
  test("cell grows in proportion to the zoom within the sane band", () => {
    const base = 5.6;
    expect(voxelCellForScale(base, 1)).toBeCloseTo(base, 6);
    expect(voxelCellForScale(base, 2)).toBeCloseTo(base * 2, 6);
    expect(voxelCellForScale(base, 3)).toBeCloseTo(base * 3, 6);
  });

  test("never smaller than the base cell nor larger than the cap", () => {
    const base = 4.7;
    // Zoomed further out than the reference: still at least the base cell.
    expect(voxelCellForScale(base, 0.25)).toBeCloseTo(base, 6);
    // Extreme zoom-in clamps at the cap so a building never becomes 1 block.
    expect(voxelCellForScale(base, 100)).toBe(VOXEL_BASE_CELL_CAP_DEVICE_PX);
    // Garbage scale falls back to the base cell.
    expect(voxelCellForScale(base, Number.NaN)).toBeCloseTo(base, 6);
    expect(voxelCellForScale(base, -3)).toBeCloseTo(base, 6);
  });

  test("a world feature keeps the same block index across zoom levels", () => {
    const base = 5.6;
    // The shader buckets by floor((pixel - gridOffset) / cell) and gridOffset
    // is the wrapped anchor, so the block a feature lands in, relative to the
    // anchor's own block, is floor((featurePixel - anchorPixel) / cell). The
    // feature's screen distance from the anchor is relWorld * zoom; with the
    // cell scaling by the same zoom, that relative index is invariant.
    const relWorld = 12.3;
    const anchorScreen = 40;
    const relIndexAt = (zoom: number): number => {
      const cell = voxelCellForScale(base, zoom);
      const featurePixel = anchorScreen + relWorld * zoom;
      return Math.floor((featurePixel - anchorScreen) / cell);
    };
    // Across the proportional band the relative block index does not change.
    expect(relIndexAt(1.5)).toBe(relIndexAt(3));
    expect(relIndexAt(2)).toBe(relIndexAt(2.7));
    expect(relIndexAt(1)).toBe(Math.floor(relWorld / base));
  });
});

describe("Minecraft rendering is temporally stable", () => {
  test("the voxel grid is anchored in world space, not the screen", async () => {
    const fragment = await readShader("postprocess.frag");
    // A camera-fed world anchor shifts the lattice so blocks stay glued to
    // the geometry while the view moves.
    expect(fragment).toContain("uniform vec2 gridOffset");
    expect(fragment).toContain("(pixel - gridOffset)");
    expect(fragment).toContain("+ gridOffset");
  });

  test("no animated time term drives the post-process (no shimmer)", async () => {
    const fragment = await readShader("postprocess.frag");
    const shimmer = await readShader("shimmer.frag");
    // The old sparkle/twinkle rode a `time` uniform; both the uniform and
    // any time reference are gone so nothing animates frame to frame.
    expect(fragment).not.toContain("uniform float time");
    expect(fragment).not.toMatch(/\btime\b/);
    expect(shimmer).not.toMatch(/\btime\b/);
    expect(shimmer).toContain("premiumShimmer(vec3 color, vec2 uv)");
  });
});
