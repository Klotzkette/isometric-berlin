import { expect, test } from "bun:test";
import { InterleavedBufferAttribute, LineSegments, Mesh } from "three";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot, validateSurroundingManifest } from "../src/SurroundingCity";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";

test("all new Ringbahn packets decode through the production renderer without lost vertices", async () => {
  const folder = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
  const manifest = validateSurroundingManifest(await Bun.file(new URL("manifest.json", folder)).json());
  const additions = manifest.chunks.filter(chunk => chunk.id.startsWith("ring182-"));
  expect(additions).toHaveLength(150);
  let vertices = 0, largest = 0;
  for (const descriptor of additions) for (const family of ["drawn", "minecraft"] as const) {
    const packed = new Uint8Array(await Bun.file(new URL(descriptor[family].url, folder)).arrayBuffer());
    const payload = JSON.parse(new TextDecoder().decode(Bun.gunzipSync(packed))) as SurroundingCityChunk;
    const built = createSurroundingCityChunk(payload, descriptor.id, family === "minecraft");
    try {
      const sources = [...payload.meshes, ...(payload.lines?.positions ? [payload.lines] : [])];
      const objects = built.root.children.filter(object => object instanceof Mesh || object instanceof LineSegments) as (Mesh | LineSegments)[];
      expect(objects.length).toBe(sources.length);
      expect(built.nav).toBe(payload.nav);
      for (let i = 0; i < objects.length; i++) {
        const source = new Uint16Array(Uint8Array.from(Buffer.from(sources[i].positions, "base64")).buffer);
        const position = objects[i].geometry.getAttribute("position") as InterleavedBufferAttribute;
        expect(position.count * 3).toBe(source.length);
        for (let p = 0; p < source.length; p++) {
          if (position.data.array[Math.floor(p / 3) * 6 + p % 3] !== source[p]) {
            throw new Error(`Ringbahn source vertex changed in ${descriptor.id}/${family}`);
          }
        }
        vertices += position.count;
      }
      largest = Math.max(largest, built.geometryBytes);
    } finally { disposeSurroundingCityRoot(built.root); }
  }
  expect(vertices).toBeGreaterThan(1_000_000);
  expect(largest).toBeLessThan(3 * 1024 * 1024);
}, 60_000);

test("new Ringbahn and Steglitz ground exists before streaming; the original core stays owned", () => {
  for (const [x, z] of [[5800, 4500], [-3450, 7000], [0, 5200]]) {
    expect(surroundingScopeGroundAt(x, z)).toBe(3);
  }
  expect(surroundingScopeGroundAt(0, 0)).toBeNull();
  expect(surroundingScopeGroundAt(20000, 20000)).toBeNull();
});
