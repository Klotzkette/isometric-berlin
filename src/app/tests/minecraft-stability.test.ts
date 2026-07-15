import { describe, expect, test } from "bun:test";

import { voxelGridOffset } from "../src/visual-modes/minecraft/voxelGrid";

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
