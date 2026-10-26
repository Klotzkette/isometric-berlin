import { expect, test } from "bun:test";
import { Mesh } from "three";
import { streetKerbJoinOffsetV276 } from "../src/streetKerbJoinsV276";
import { createDistrictStreets } from "../src/DistrictStreets";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";
import source from "../src/data/districtStreets.json";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import type { VoxelPayload } from "../src/terrainPayload";

test("unequal segment lengths retain the same 22cm perpendicular width on both sides", () => {
  const line: [number, number][] = [[0, 0], [100, 0], [101, 1]];
  const offset = streetKerbJoinOffsetV276(line, 1, .11, [0, 0]);
  expect(offset[1]).toBeCloseTo(.11, 12);
  expect(offset[0] * -Math.SQRT1_2 + offset[1] * Math.SQRT1_2).toBeCloseTo(.11, 12);
  expect(streetKerbJoinOffsetV276([[99, 0], [100, 0], [110, 10]], 1, .11, [0, 0])).toEqual(offset);
  expect(line).toEqual([[0, 0], [100, 0], [101, 1]]);
});

test("closed curb courses meet at an identical cross-section without changing the corner", () => {
  const line: [number, number][] = [[0, 0], [10, 0], [10, 2], [0, 2], [0, 0]];
  const start = streetKerbJoinOffsetV276(line, 0, .11, [0, 0]);
  expect(streetKerbJoinOffsetV276(line, 4, .11, [0, 0])).toEqual(start);
  expect(start[0]).toBeCloseTo(.11, 12);
  expect(start[1]).toBeCloseTo(.11, 12);
});

test("acute corners, duplicates and reversals remain bounded without smoothing away source corners", () => {
  for (const line of [
    [[0, 0], [10, 0], [0, .1]],
    [[0, 0], [10, 0], [0, 0]],
    [[0, 0], [0, 0], [10, 0]],
    [[0, 0], [0, 0], [0, 0]],
    [[0, 0]],
  ] as [number, number][][]) {
    const before = JSON.stringify(line);
    for (let i = 0; i < line.length; i++) {
      const offset = streetKerbJoinOffsetV276(line, i, .11, [0, 0]);
      expect(offset.every(Number.isFinite)).toBeTrue();
      expect(Math.hypot(...offset)).toBeLessThanOrEqual(.220000001);
    }
    expect(JSON.stringify(line)).toBe(before);
  }
});

test("the actual complete curb batch keeps every original course, height pair, index and byte capacity", () => {
  const root = createDistrictStreets(ground as unknown as VoxelPayload);
  try {
    const curb = root.getObjectByName("District raised kerbstones") as Mesh;
    const p = curb.geometry.getAttribute("position");
    expect(p.count).toBe(309940);
    expect(p.array.byteLength + curb.geometry.index!.array.byteLength).toBe(9051672);
    let vertex = 0, ringCount = 0;
    for (const line of source.curbs_m) {
      const start = vertex;
      for (const [x, z] of line) {
        // Float32 output rounds at large Berlin coordinates. The unchanged
        // source point remains at the centre of each physical cross-section.
        expect((p.getX(vertex) + p.getX(vertex + 1)) / 2).toBeCloseTo(x, 3);
        expect((p.getZ(vertex) + p.getZ(vertex + 1)) / 2).toBeCloseTo(z, 3);
        expect(p.getY(vertex)).toBe(p.getY(vertex + 1));
        expect(p.getY(vertex + 2)).toBe(p.getY(vertex + 3));
        expect(p.getY(vertex + 2) - p.getY(vertex)).toBeCloseTo(.14, 5);
        expect(p.getX(vertex)).toBe(p.getX(vertex + 2));
        expect(p.getZ(vertex)).toBe(p.getZ(vertex + 2));
        vertex += 4;
      }
      if (line.length > 2 && line[0][0] === line.at(-1)![0] && line[0][1] === line.at(-1)![1]) {
        ringCount++;
        for (let i = 0; i < 4; i++) {
          expect([p.getX(start + i), p.getY(start + i), p.getZ(start + i)])
            .toEqual([p.getX(vertex - 4 + i), p.getY(vertex - 4 + i), p.getZ(vertex - 4 + i)]);
        }
      }
    }
    expect(vertex).toBe(p.count);
    expect(ringCount).toBe(84);
  } finally { disposeStaticAudit(root); }
});
