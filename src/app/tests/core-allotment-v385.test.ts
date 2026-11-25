import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BoxGeometry, BufferAttribute, InstancedMesh, Mesh } from "three";
import { loadCoreAllotmentsV360 } from "../src/CoreAllotmentDetailsV360";

type Contact = { spans: number[][]; corners: number[]; hashes: string[][]; bounds: { center: { x: number; y: number; z: number }; radius: number } };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/core-allotment-contact-v385.json.gz", import.meta.url))).toString()) as {
  packetSha256: string; siteIds: string[]; tiles: number[][]; drawn: Contact; native: Contact;
};
const packet = readFileSync(new URL("../src/data/allotmentDetailsV360Core.json.gz", import.meta.url));
const sha = (bytes: Uint8Array | Uint32Array) => createHash("sha256").update(bytes).digest("hex");

test("the complete core packet contains the 13 surveyed tiles and 168 garden surfaces", () => {
  expect(sha(packet)).toBe(fixture.packetSha256);
  const { tiles } = JSON.parse(gunzipSync(packet).toString()) as { tiles: { x: number; z: number; sheets: unknown[] }[] };
  expect(tiles.map(t => [t.x, t.z])).toEqual(fixture.tiles);
  expect(tiles.length).toBe(13);
  expect(tiles.reduce((sum, t) => sum + t.sheets.length, 0)).toBe(168);
  expect(new Set(fixture.siteIds).size).toBe(14);
});

for (const native of [false, true]) {
  const mode = native ? "native" : "drawn";
  test(`complete ${mode} garden geometry fits one draw and preserves every original triangle word`, async () => {
    const reference = fixture[mode], groundFile = native ? "minecraft-voxels" : "ground-context";
    const ground = await Bun.file(new URL(`../public/mesh/regierungsviertel/${groundFile}.json`, import.meta.url)).json();
    const slabs = new InstancedMesh(new BoxGeometry(), undefined, reference.spans.length);
    const storage = slabs.instanceMatrix.array;
    for (const [i, [width, height, x, y, z]] of reference.spans.entries()) {
      const k = 16 * i;
      storage[k] = width; storage[k + 5] = height;
      storage[k + 12] = x; storage[k + 13] = y; storage[k + 14] = z;
    }
    const originalFetch = globalThis.fetch;
    let build;
    try {
      globalThis.fetch = (async () => new Response(packet)) as typeof fetch;
      build = await loadCoreAllotmentsV360(new AbortController().signal);
    } finally { globalThis.fetch = originalFetch; }
    const steps = build(ground, slabs, native);
    let step = steps.next();
    while (!step.done) step = steps.next();
    expect(step.value.children).toHaveLength(1);
    const mesh = step.value.children[0];
    if (!(mesh instanceof Mesh)) throw Error("Missing core garden mesh");
    const geometry = mesh.geometry, index = geometry.index;
    expect(geometry.groups).toHaveLength(0);
    expect(Array.isArray(mesh.material)).toBe(false);
    expect(index === null).toBe(native);
    const total = reference.corners.reduce((a, b) => a + b, 0);
    expect(index?.count ?? geometry.getAttribute("position").count).toBe(total);
    if (!native) expect(total * 3).toBeGreaterThan(750_000); // the previous raw position guard
    const attributes = ["position", "color", "normal"].map(name => geometry.getAttribute(name) as BufferAttribute);
    const bytes = attributes.reduce((size, a) => size + a.array.byteLength, index?.array.byteLength ?? 0);
    expect(bytes).toBe(native ? 8_806_320 : 6_186_516);
    expect(bytes).toBeLessThanOrEqual(9_000_000);
    expect(geometry.boundingSphere?.radius).toBe(reference.bounds.radius);
    expect(geometry.boundingSphere?.center.toArray()).toEqual(Object.values(reference.bounds.center));
    let first = 0;
    for (const [tile, corners] of reference.corners.entries()) {
      for (const [i, { array }] of attributes.entries()) {
        const originalWords = new Uint32Array(array.buffer, array.byteOffset, array.length);
        const words = new Uint32Array(corners * 3);
        for (let j = 0; j < corners; j++) {
          const vertex = 3 * (index?.getX(first + j) ?? first + j);
          words.set(originalWords.subarray(vertex, vertex + 3), j * 3);
        }
        expect(sha(words)).toBe(reference.hashes[tile][i]);
      }
      first += corners;
    }
  });
}
