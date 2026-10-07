import { expect, test } from "bun:test";
import { Matrix4, Vector3 } from "three";
import { createGroundSlabs, smoothGroundTopSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";

function fixture(raised: boolean): VoxelPayload {
  const heights = new Array(100 * 25).fill(52);
  if (raised) for (let row = 15; row < 24; row++) for (let col = 45; col < 85; col++) heights[row * 100 + col] = 120 + (col - 45) * 10;
  const rows: VoxelPayload["ground_rows"] = Array.from({ length: 100 }, () => []);
  rows[0] = [[0, 400, 0]]; // Outside the terrain's finite support.
  rows[80] = [[0, 400, 0]]; // One long old run crosses the corrected hill.
  return {
    schema_version: 2, cell_m: 4, classes: ["grass"],
    grid: { min_x_idx: 0, min_z_idx: -850, cols: 400, rows: 100 },
    ground_height: { cols: 100, rows: 25, stride_cells: 4, y_dm: heights },
    ground_rows: rows, water_top_y_m: -1.15,
  };
}
const shades = { grass: [0x778899, 0x889977, 0x997788] };

for (const mode of ["drawn", "native"] as const) {
  test(`${mode} park grading keeps all land, outside transforms and original paint`, () => {
    const before = createGroundSlabs(fixture(false), "before", shades);
    const payload = fixture(true);
    const after = createGroundSlabs(payload, "after", shades, { parkRelief: mode });
    const smooth = smoothGroundTopSampler(payload);
    try {
      expect(after.count).toBeGreaterThan(before.count);
      expect(Array.from(after.instanceMatrix.array.slice(0, 16)))
        .toEqual(Array.from(before.instanceMatrix.array.slice(0, 16)));
      const matrix = new Matrix4(), scale = new Vector3();
      let width = 0, lastEdge = 0, highest = 0;
      for (let i = 1; i < after.count; i++) {
        after.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix);
        const x = matrix.elements[12], z = matrix.elements[14];
        const top = matrix.elements[13] + scale.y / 2;
        expect(x - scale.x / 2).toBeCloseTo(lastEdge, 4);
        width += scale.x; lastEdge = x + scale.x / 2;
        highest = Math.max(highest, top);
        expect(Array.from(after.instanceColor!.array.slice(i * 3, i * 3 + 3)))
          .toEqual(Array.from(before.instanceColor!.array.slice(3, 6)));
        if (mode === "drawn" && top > 5.201) {
          const a = (x - scale.x / 2) / 4, b = (x + scale.x / 2) / 4;
          const north = z / 4 + 850 - .5;
          for (const px of [a, b]) for (const pz of [north, north + 1]) {
            expect(top).toBeLessThanOrEqual(smooth(px, pz) - .1999);
          }
        }
      }
      expect(width).toBe(1600);
      expect(lastEdge).toBe(1600);
      expect(highest).toBeGreaterThan(40);
    } finally { before.geometry.dispose(); after.geometry.dispose(); }
  });
}
