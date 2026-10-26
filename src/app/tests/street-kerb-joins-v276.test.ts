import { expect, test } from "bun:test";
import { Mesh } from "three";
import { streetKerbJoinOffsetV276 } from "../src/streetKerbJoinsV276";
import { createDistrictStreets, createSourceStreetSurfaces, type StreetSource } from "../src/DistrictStreets";
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

test("repeated open endpoints and corner runs share distinct neighbouring tangents", () => {
  const line: [number, number][] = [[0, 0], [0, 0], [2, 0], [2, 0], [2, 0], [2, 2], [2, 2]];
  const before = JSON.stringify(line);
  const expected = [[0, .11], [0, .11], [-.11, .11], [-.11, .11], [-.11, .11], [-.11, 0], [-.11, 0]];
  for (let i = 0; i < line.length; i++) {
    const offset = streetKerbJoinOffsetV276(line, i, .11, [0, 0]);
    expect(offset[0]).toBeCloseTo(expected[i][0], 12);
    expect(offset[1]).toBeCloseTo(expected[i][1], 12);
    if (i && line[i][0] === line[i - 1][0] && line[i][1] === line[i - 1][1]) {
      expect(offset).toEqual(streetKerbJoinOffsetV276(line, i - 1, .11, [0, 0]));
    }
  }
  expect(JSON.stringify(line)).toBe(before);
});

test("closed duplicate runs wrap through both seam copies, while degenerate lines and reversals stay finite", () => {
  const line: [number, number][] = [[0, 0], [0, 0], [2, 0], [2, 0], [2, 2], [0, 2], [0, 0], [0, 0]];
  const before = JSON.stringify(line);
  const seam = streetKerbJoinOffsetV276(line, 0, .11, [0, 0]);
  expect(seam[0]).toBeCloseTo(.11, 12);
  expect(seam[1]).toBeCloseTo(.11, 12);
  for (const i of [1, 6, 7]) expect(streetKerbJoinOffsetV276(line, i, .11, [0, 0])).toEqual(seam);
  for (const i of [2, 3]) {
    const offset = streetKerbJoinOffsetV276(line, i, .11, [0, 0]);
    expect(offset[0]).toBeCloseTo(-.11, 12);
    expect(offset[1]).toBeCloseTo(.11, 12);
  }
  expect(JSON.stringify(line)).toBe(before);
  for (const count of [1, 2, 3, 12]) {
    const degenerate: [number, number][] = Array.from({ length: count }, () => [1, 2]);
    for (let i = 0; i < count; i++) expect(streetKerbJoinOffsetV276(degenerate, i, .11, [8, 9])).toEqual([0, 0]);
  }
  const reversal: [number, number][] = [[0, 0], [2, 0], [2, 0], [2, 0], [0, 0]];
  for (const i of [1, 2, 3]) expect(streetKerbJoinOffsetV276(reversal, i, .11, [0, 0])).toEqual([0, 0]);
});

test("the real 99-degree duplicate corner has zero-area Float32 null-segment triangles and full-width adjoining kerbs", () => {
  const line = source.curbs_m[1980] as [number, number][];
  expect(line.slice(10, 14)).toEqual([[-208.14, -661.77], [-208.05, -668.83], [-208.05, -668.83], [-209.51, -668.61]]);
  const snapshot = JSON.stringify(line);
  const input: StreetSource = { source: {}, surfaces: [], curbs_m: [line], elevated_path_ids: [], markings_m: [] };
  const root = createSourceStreetSurfaces(ground as unknown as VoxelPayload, input, "real duplicate corner");
  try {
    const curb = root.getObjectByName("District raised kerbstones") as Mesh;
    const p = curb.geometry.getAttribute("position"), indices = curb.geometry.index!;
    expect(p.array).toBeInstanceOf(Float32Array);
    expect(p.count).toBe(line.length * 4);
    expect(indices.count).toBe((line.length - 1) * 18);
    for (let side = 0; side < 4; side++) {
      const a = 11 * 4 + side, b = 12 * 4 + side;
      expect([p.getX(a), p.getY(a), p.getZ(a)]).toEqual([p.getX(b), p.getY(b), p.getZ(b)]);
    }
    // Use the production indices and actual Float32 vertex positions. Every
    // triangle of the retained zero-length segment has zero 3D area, so its
    // two top triangles cannot retain their former 0.00597 m² overlap.
    for (let at = 11 * 18; at < 12 * 18; at += 3) {
      const [a, b, c] = [indices.getX(at), indices.getX(at + 1), indices.getX(at + 2)];
      const u = [p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a)];
      const v = [p.getX(c) - p.getX(a), p.getY(c) - p.getY(a), p.getZ(c) - p.getZ(a)];
      expect(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])).toBe(0);
    }
    const a = 11 * 4, width = [p.getX(a + 1) - p.getX(a), p.getZ(a + 1) - p.getZ(a)];
    for (const [start, end] of [[line[10], line[11]], [line[12], line[13]]]) {
      const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz);
      expect((width[0] * -dz + width[1] * dx) / length).toBeCloseTo(.22, 3);
    }
    expect(JSON.stringify(line)).toBe(snapshot);
  } finally { disposeStaticAudit(root); }
});

test("the actual complete curb batch keeps every original course, height pair, index and byte capacity", () => {
  const root = createDistrictStreets(ground as unknown as VoxelPayload);
  try {
    const curb = root.getObjectByName("District raised kerbstones") as Mesh;
    const p = curb.geometry.getAttribute("position");
    expect(p.count).toBe(309940);
    expect(p.array.byteLength + curb.geometry.index!.array.byteLength).toBe(9051672);
    let vertex = 0, ringCount = 0, duplicatePairs = 0;
    for (const line of source.curbs_m) {
      const start = vertex;
      for (const [pointIndex, [x, z]] of line.entries()) {
        // Float32 output rounds at large Berlin coordinates. The unchanged
        // source point remains at the centre of each physical cross-section.
        expect((p.getX(vertex) + p.getX(vertex + 1)) / 2).toBeCloseTo(x, 3);
        expect((p.getZ(vertex) + p.getZ(vertex + 1)) / 2).toBeCloseTo(z, 3);
        expect(p.getY(vertex)).toBe(p.getY(vertex + 1));
        expect(p.getY(vertex + 2)).toBe(p.getY(vertex + 3));
        expect(p.getY(vertex + 2) - p.getY(vertex)).toBeCloseTo(.14, 5);
        expect(p.getX(vertex)).toBe(p.getX(vertex + 2));
        expect(p.getZ(vertex)).toBe(p.getZ(vertex + 2));
        if (pointIndex && x === line[pointIndex - 1][0] && z === line[pointIndex - 1][1]) {
          duplicatePairs++;
          for (let side = 0; side < 4; side++) {
            expect([p.getX(vertex + side), p.getY(vertex + side), p.getZ(vertex + side)])
              .toEqual([p.getX(vertex - 4 + side), p.getY(vertex - 4 + side), p.getZ(vertex - 4 + side)]);
          }
        }
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
    expect(duplicatePairs).toBe(1599);
  } finally { disposeStaticAudit(root); }
});
