import { describe, expect, test } from "bun:test";
import { transferExactPacketLines, transferExactPacketTriangles } from "../src/exactPacketTransfer";
import type { SurroundingPackedMesh } from "../src/SurroundingCityGeometry";

function finish(iterator: Generator<void, number>): number {
  let step = iterator.next();
  while (!step.done) step = iterator.next();
  return step.value;
}
const hash = (texts: string[]) => {
  let h = 2166136261;
  for (const text of texts) for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};
const part: SurroundingPackedMesh = {
  kind: "source", positionType: "u16cm", positions: "AAAA", colors: "AAAA",
  indices: Buffer.from(new Uint32Array([0, 1, 2, 2, 3, 0]).buffer).toString("base64"),
};
const receipt = { tile: "tile", kind: "source", mode: "drawn",
  fingerprint: hash([part.positions, part.colors, part.indices]), triangles: [1] };

describe("audited source transfers", () => {
  test("keeps unrelated triangles and offset neighbours byte-identical", () => {
    const index = new Uint16Array([9, 8, 7, 0, 1, 2, 2, 3, 0, 6, 5, 4]);
    expect(finish(transferExactPacketTriangles([receipt], "tile", false, part, index, 3))).toBe(1);
    expect([...index]).toEqual([9, 8, 7, 0, 1, 2, 2, 2, 2, 6, 5, 4]);
  });
  test("changed source bytes, a foreign tile, or other mode never lose geometry", () => {
    for (const [tile, native, source] of [
      ["other", false, part], ["tile", true, part],
      ["tile", false, { ...part, colors: "BBBB" }],
    ] as const) {
      const index = new Uint32Array([0, 1, 2, 2, 3, 0]);
      expect(finish(transferExactPacketTriangles([receipt], tile, native, source, index, 0))).toBe(0);
      expect([...index]).toEqual([0, 1, 2, 2, 3, 0]);
    }
  });
  test("a malformed triangle receipt cannot reach the next part", () => {
    const index = new Uint32Array(30);
    expect(() => finish(transferExactPacketTriangles([{ ...receipt, triangles: [2] }], "tile", false, part, index, 0))).toThrow();
  });
  test("old ink collapses only at audited segments, retaining per-vertex colours", () => {
    const lines = { positions: "AAAA", colors: "BBBB" };
    const records = [{ tile: "tile", mode: "drawn", fingerprint: hash([lines.positions, lines.colors]), segments: [1] }];
    const values = new Uint16Array([1, 2, 3, 7, 8, 9, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    expect(finish(transferExactPacketLines(records, "tile", lines, values, 6))).toBe(1);
    expect([...values]).toEqual([1, 2, 3, 7, 8, 9, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 13, 14, 15, 22, 23, 24]);
    expect(finish(transferExactPacketLines(records, "other", lines, values, 6))).toBe(0);
  });
});
