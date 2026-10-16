import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import source from "../src/data/kalkscheuneOwnershipV218.json";
import { transferKalkscheuneFacadeV218 } from "../src/kalkscheuneOwnershipV218";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const packet = JSON.parse(gunzipSync(readFileSync(new URL(
  "../public/mesh/surrounding-berlin-v159/2_-2.drawn.json.gz", import.meta.url,
))).toString()) as SurroundingCityChunk;
const finish = (iterator: Generator<void, number>) => {
  let step = iterator.next();
  while (!step.done) step = iterator.next();
  return step.value;
};
const part = packet.meshes.find(mesh => mesh.kind === "alt-mitte-v169")!;
const bytes = Buffer.from(part.indices, "base64");
const original = new Uint32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));

describe("Kalkscheune measured owners retain their shells", () => {
  test("transfers all 1458 exact old facade triangles and no other index", () => {
    const indices = new Uint32Array(original);
    const selected = new Set(source.records.flatMap(record => record.triangles));
    expect(finish(transferKalkscheuneFacadeV218("2_-2", false, part, indices, 0))).toBe(1458);
    expect(selected.size).toBe(1458);
    for (let triangle = 0; triangle < original.length / 3; triangle++) {
      const at = triangle * 3;
      expect(indices[at]).toBe(original[at]);
      if (selected.has(triangle)) {
        expect(indices[at + 1]).toBe(indices[at]);
        expect(indices[at + 2]).toBe(indices[at]);
      } else {
        expect(indices[at + 1]).toBe(original[at + 1]);
        expect(indices[at + 2]).toBe(original[at + 2]);
      }
    }
  });
  test("native, resident source shells and changed packet bytes are untouched", () => {
    for (const [tile, native, mesh] of [
      ["2_-2", true, part],
      ["alt-mitte-v169-2_-2-piece-0", false, part],
      ["2_-2", false, { ...part, colors: part.colors + "AAAA" }],
      ["2_-2", false, { ...part, kind: "city" }],
    ] as const) {
      const indices = new Uint32Array(original);
      expect(finish(transferKalkscheuneFacadeV218(tile, native, mesh, indices, 0))).toBe(0);
      expect(indices).toEqual(original);
    }
    expect(source.residentShellTrianglesTransferred).toBe(0);
    expect(source.nativeTrianglesTransferred).toBe(0);
    expect(source.sourceOwners).toHaveLength(3);
    expect(source.sourceParts).toHaveLength(5);
  });
});
