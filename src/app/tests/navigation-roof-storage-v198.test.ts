import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import packed from "../src/data/altMitteRoofStorageV198.json";
import { decodeLosslessRoofCoordinates } from "../src/losslessRoofCoordinates";
import { createAltMitteV169NavigationIndex } from "../src/altMitteV169NavigationIndex";

test("all 75,029 retained roof triangles survive the packed store bit for bit", async () => {
  const coordinates = decodeLosslessRoofCoordinates(packed);
  let offset = 0;
  const roofs: number[][][] = [];
  for (const source of packed.sources) {
    const file = Bun.file(new URL(`../src/data/${source.path}`, import.meta.url));
    const raw = await file.arrayBuffer();
    expect(createHash("sha256").update(new Uint8Array(raw)).digest("hex")).toBe(source.sha256);
    const triangles = JSON.parse(new TextDecoder().decode(raw)) as number[][][];
    for (const triangle of triangles) for (const point of triangle) for (const value of point)
      expect(Object.is(coordinates[offset++], value)).toBeTrue();
    roofs.push(...triangles);
  }
  expect(offset).toBe(coordinates.length);
  expect(coordinates.length).toBe(75029 * 9);
  expect(createHash("sha256").update(new Uint8Array(coordinates.buffer, coordinates.byteOffset, coordinates.byteLength)).digest("hex")).toBe(packed.sha256);
  const common = { legacyPrisms: [], parts: [], nativeRoofCells: [] };
  const original = createAltMitteV169NavigationIndex({ ...common, roofTriangles: roofs }, { lazy: true });
  const compact = createAltMitteV169NavigationIndex({ ...common, roofTriangles: [], roofTriangleCoordinates: coordinates }, { lazy: true });
  // Exercise every source triangle, including overlaps, edge tolerances and
  // sloped interpolation. The older published fingerprint separately checks
  // arithmetic against v1.0.71, rather than against this new storage path.
  for (const [a, b, c] of roofs) {
    for (const [x, z] of [[a[0], a[2]], [(a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3]])
      expect(compact.roofAt(x, z)).toBe(original.roofAt(x, z));
  }
});

test("packed decoder rejects invalid layout and truncated declared buffers", () => {
  expect(() => decodeLosslessRoofCoordinates({ ...packed, format: "other" })).toThrow();
  expect(() => decodeLosslessRoofCoordinates({ ...packed, triangles: packed.triangles + 1 })).toThrow();
  expect(() => decodeLosslessRoofCoordinates({ ...packed, triangles: packed.triangles + 1, bytes: packed.bytes + 72 })).toThrow();
});
