import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { OrthographicCamera, Raycaster, Vector3 } from "three";
import { createSurroundingCity, validateSurroundingManifest } from "../src/SurroundingCity";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const directory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, directory));
const receipt = await Bun.file(new URL("../../../geo_data/regierungsviertel/mitte-garden-details-receipt.json", import.meta.url)).json() as {
  sourceSha256: string;
  packets: Record<string, { placements: number; after: { url: string; bytes: number; decodedBytes: number; sha256: string } }>;
};
type Point = readonly [x: number, z: number, drawnY: number, nativeY: number];
const sourceBytes = readFileSync(new URL("../../../geo_data/regierungsviertel/mitte-garden-details-source.json.gz", import.meta.url));
const source = JSON.parse(gunzipSync(sourceBytes).toString()) as {
  features: { area: string; points: readonly Point[] }[];
};
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("Mitte garden and shore planting is streamed by the real controller in both model families", async () => {
  expect(digest(sourceBytes)).toBe(receipt.sourceSha256);
  const full = validateSurroundingManifest(JSON.parse(read("manifest.json").toString()));
  const chunks = full.chunks.filter(chunk => receipt.packets[`drawn:${chunk.id}`]);
  expect(chunks).toHaveLength(7);
  const files = new Map(chunks.flatMap(entry => [entry.drawn.url, entry.minecraft.url].map(url => [url, read(url)])));
  const manifest = { ...full, chunks };
  const camera = new OrthographicCamera(-1300, 1300, 1100, -1100, 1, 2000);
  camera.position.set(-1550, 500, -15);
  camera.up.set(0, 0, -1);
  camera.lookAt(-1550, 0, -15);
  camera.updateMatrixWorld(true);
  const errors: string[] = [];
  const city = createSurroundingCity({
    camera, manifestUrl: new URL("https://mitte-gardens.test/manifest.json"), mode: "day",
    publicSitesV326: true, onError: e => errors.push(e),
    fetch: (async (input: RequestInfo | URL) => {
      const name = new URL(String(input)).pathname.split("/").at(-1)!;
      if (name === "manifest.json") return new Response(JSON.stringify(manifest));
      const bytes = files.get(name);
      if (!bytes) throw Error(`Unexpected garden request ${name}`);
      return new Response(bytes);
    }) as typeof fetch,
  });
  try {
    await city.ready;
    for (const family of ["drawn", "minecraft"] as const) {
      if (family === "minecraft") city.setMode("minecraft");
      const deadline = performance.now() + 5000;
      while (!errors.length && (city.pending || city.residentChunkCount !== chunks.length) && performance.now() < deadline) {
        await Bun.sleep(2);
      }
      expect(errors).toEqual([]);
      expect(city.residentChunkCount).toBe(chunks.length);
      city.root.updateMatrixWorld(true);
      for (const chunk of chunks) {
        const published = chunk[family];
        const { after, placements } = receipt.packets[`${family}:${chunk.id}`];
        expect(published).toEqual(after);
        expect(city.hasResidentChunk(chunk.id, after.sha256)).toBeTrue();
        expect(placements).toBeGreaterThan(10);
        const wire = files.get(after.url)!;
        expect(digest(wire)).toBe(after.sha256);
        const bytes = gunzipSync(wire);
        expect(bytes.length).toBe(after.decodedBytes);
        const data: SurroundingCityChunk = JSON.parse(bytes.toString());
        expect(data.meshes.at(-1)?.kind).toBe("mitte-garden-details");
        if (chunk.id.startsWith("mitte-garden-details-")) {
          expect(data.nav).toEqual({ ground: [], water: [], buildings: [], groundY: 5.2 });
        }
        const { origin } = data;
        const resident = city.root.children.find(child =>
          child.position.x === origin[0] && child.position.z === origin[2]);
        expect(resident?.visible).toBeTrue();
        const [xmin, zmin, xmax, zmax] = chunk.bounds;
        const plants = source.features.flatMap(f => f.points.filter(([x, z]) =>
          x >= xmin && x < xmax && z >= zmin && z < zmax));
        expect(plants).toHaveLength(placements);
        // Understated reed blades are intentionally little clusters, never
        // giant filled crowns. Sample the area around several real anchors.
        const offsets = [-.21, -.11, 0, .11, .21];
        let hits = 0;
        for (const [x, z, dy, ny] of plants.slice(0, 5)) {
          const y = family === "minecraft" ? ny : dy + .08;
          if (offsets.some(dx => offsets.some(dz =>
            new Raycaster(new Vector3(x + dx, y + 2, z + dz), new Vector3(0, -1, 0), 0, 1.94)
              .intersectObject(resident!).length > 0))) hits++;
        }
        expect(hits).toBeGreaterThan(0);
      }
    }
  } finally { city.dispose(); }
}, 15_000);
