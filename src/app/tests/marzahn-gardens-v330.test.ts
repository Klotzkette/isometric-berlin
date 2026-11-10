import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { Mesh, OrthographicCamera, Raycaster, Vector3 } from "three";
import { decodeGardenTerrainV330, gardenTerrainGroundAtV330 } from "../src/GardenTerrainV330";
import { createSurroundingCity, validateSurroundingManifest, type SurroundingChunkDescriptor } from "../src/SurroundingCity";
import { surroundingPolygonContains, type SurroundingCityChunk, type SurroundingPolygon } from "../src/SurroundingCityGeometry";

const directory = Bun.env.MARZAHN_GARDENS_TEST_PACKETS ?? resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
const read = (name: string) => readFileSync(resolve(directory, name));
const summit = [14278, -1457] as const;
const pond = [14400, -915] as const;
const summitId = "gardens330-27_-3";
const pondId = "gardens330-28_-2";
const family = (native: boolean) => native ? "minecraft" : "drawn";
const byName = (id: string, native: boolean) => `Surrounding Berlin outline ${id}${native ? " native Minecraft" : ""}`;

function packet(descriptor: SurroundingChunkDescriptor, native: boolean) {
  const asset = descriptor[family(native)];
  const bytes = read(asset.url);
  const decoded = gunzipSync(bytes);
  expect(bytes.length).toBe(asset.bytes);
  expect(decoded.length).toBe(asset.decodedBytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256!);
  return JSON.parse(decoded.toString()) as SurroundingCityChunk;
}

function interior(polygon: SurroundingPolygon, filter = (_x: number, _z: number) => true): [number, number] | undefined {
  const x = polygon.ring.map(p => p[0]), z = polygon.ring.map(p => p[1]);
  for (let pz = Math.min(...z) + .125; pz < Math.max(...z); pz += .25) {
    for (let px = Math.min(...x) + .125; px < Math.max(...x); px += .25) {
      if (surroundingPolygonContains(polygon, px, pz) && filter(px, pz)) return [px, pz];
    }
  }
}

test("V330 manifest retains every prior tile and its coverage order", () => {
  const previous = JSON.parse(gunzipSync(readFileSync(new URL(
    "../../../geo_data/regierungsviertel/marzahn-v330-published210-manifest.json.gz", import.meta.url,
  ))).toString());
  const full = validateSurroundingManifest(JSON.parse(read("manifest.json").toString()));
  expect(full.chunks.slice(0, previous.chunks.length)).toEqual(previous.chunks);
  expect(full.footprint.slice(0, previous.footprint.length)).toEqual(previous.footprint);
  expect(full.gardenFootprintStartV330).toBe(previous.footprint.length);
});

test("production park controller streams exact Drawn and Native terrain, decks and detail companions", async () => {
  const full = validateSurroundingManifest(JSON.parse(read("manifest.json").toString()));
  const get = (id: string) => {
    const descriptor = full.chunks.find(entry => entry.id === id);
    if (!descriptor) throw Error(`Missing real garden descriptor ${id}`);
    return descriptor;
  };
  const primary = get(summitId), lake = get(pondId);
  const companion = full.chunks.find(entry => entry.detailCompanionOf?.startsWith("gardens330-")
    && (entry.drawn.decodedBytes ?? 0) > 500 && (entry.minecraft.decodedBytes ?? 0) > 500);
  if (!companion?.detailCompanionOf) throw Error("Missing actual garden detail companion");
  const companionPrimary = get(companion.detailCompanionOf);
  // Same distance for the two original descriptors, so this finite manifest
  // deliberately publishes the real companion before its ground owner.
  const chunks = [...new Set([companion, companionPrimary, primary, lake])];
  const files = new Map(chunks.flatMap(entry => [entry.drawn.url, entry.minecraft.url].map(url => [url, read(url)])));
  const manifest = { ...full, chunks };
  const camera = new OrthographicCamera(-1_150, 1_150, 1_150, -1_150, 1, 2_000);
  camera.position.set(summit[0], 500, summit[1]);
  camera.up.set(0, 0, -1);
  camera.lookAt(summit[0], 0, summit[1]);
  camera.updateMatrixWorld();
  const errors: string[] = [];
  const requested: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const name = new URL(String(input)).pathname.split("/").at(-1)!;
    requested.push(name);
    if (name === "manifest.json") return new Response(JSON.stringify(manifest));
    const bytes = files.get(name);
    if (!bytes) throw Error(`Unexpected garden transport ${name}`);
    return new Response(bytes);
  }) as typeof fetch;
  const city = createSurroundingCity({
    camera, manifestUrl: new URL("https://garden.test/manifest.json"), fetch: fetcher,
    mode: "day", publicSitesV326: true, onError: e => errors.push(e),
  });
  try {
    await city.ready;
    for (const native of [false, true]) {
      const previousRoots = city.root.children.slice();
      if (native) city.setMode("minecraft");
      const deadline = performance.now() + 20_000;
      while (!errors.length && (city.pending || city.residentChunkCount !== chunks.length) && performance.now() < deadline) {
        await new Promise<void>(resolve => setTimeout(resolve, 2));
      }
      expect(errors).toEqual([]);
      expect(city.residentChunkCount).toBe(chunks.length);
      expect(city.root.children.findIndex(child => child.name === byName(companion.id, native)))
        .toBeLessThan(city.root.children.findIndex(child => child.name === byName(companionPrimary.id, native)));
      if (native) expect(previousRoots.every(root => root.parent === null)).toBe(true);
      for (const entry of chunks) expect(requested).toContain(entry[family(native)].url);

      const raw = packet(primary, native), wet = packet(lake, native);
      const decoration = packet(companion, native);
      expect(decoration.meshes.length).toBeGreaterThan(0);
      expect(decoration.gardenTerrainV330).toBeUndefined();
      expect(decoration.nav.ground).toEqual([]);
      expect(city.navigationTiles).toHaveLength(chunks.length - 1);
      for (const expected of [raw, wet]) {
        const tile = city.navigationTiles.find(t => t.origin[0] === expected.origin[0] && t.origin[2] === expected.origin[2]);
        expect(tile?.nav).toEqual(expected.nav);
      }
      const grid = decodeGardenTerrainV330(raw.gardenTerrainV330!, native);
      const measured = native ? 72 : 71.9875;
      expect(gardenTerrainGroundAtV330(grid, summit[0] - raw.origin[0], summit[1] - raw.origin[2], native)).toBeCloseTo(measured, 7);
      expect(city.groundAt(...summit)).toBeCloseTo(measured, 7);
      expect(city.gardenGroundAtV330(...summit)).toBeCloseTo(measured, 7);
      expect(city.gardenGroundAtV330(14278, -1456.5)).toBeCloseTo(native ? 72 : 71.98375, 7);
      city.root.updateMatrixWorld(true);
      const terrainMeshes = city.root.children.filter(root => root.name === byName(primary.id, native))
        .flatMap(root => root.children.filter((child): child is Mesh => child instanceof Mesh));
      const ray = new Raycaster(new Vector3(summit[0], 150, summit[1]), new Vector3(0, -1, 0));
      expect(ray.intersectObjects(terrainMeshes).some(hit => Math.abs(hit.point.y - measured) < .011)).toBe(true);

      expect(city.waterAt(...pond)).toBe(true);
      expect(city.groundAt(...pond)).toBeNull();
      expect(city.gardenGroundAtV330(...pond)).toBeNull();
      const floor = wet.nav.spreeBridgesV242?.floors.find(r => interior(r, (x, z) =>
        wet.nav.water.some(w => surroundingPolygonContains(w, x, z))));
      if (!floor) throw Error("Missing actual bridge floor over the Wuhleteich");
      const [x, z] = interior(floor, (x, z) => wet.nav.water.some(w => surroundingPolygonContains(w, x, z)))!;
      expect(city.groundAt(wet.origin[0] + x, wet.origin[2] + z)).toBeCloseTo(floor.y, 7);
      expect(city.gardenGroundAtV330(wet.origin[0] + x, wet.origin[2] + z)).toBeCloseTo(floor.y, 7);
      expect(city.waterAt(wet.origin[0] + x, wet.origin[2] + z)).toBe(false);

      const body = raw.nav.buildings.find(record => record.height - record.minHeight > .5 && interior(record));
      if (!body) throw Error("Missing actual model collision owner on summit tile");
      const [bx, bz] = interior(body)!;
      const insideY = raw.nav.groundY + (body.groundOffset ?? 0) + (body.height + body.minHeight) / 2;
      expect(city.solidAt(raw.origin[0] + bx, insideY, raw.origin[2] + bz)).toBe(true);
      expect(city.solidAt(0, 3, 0)).toBe(false);
      const parentPacket = packet(companionPrimary, native);
      const ownLand = parentPacket.nav.ground.map(p => interior(p)).find(p => p);
      if (!ownLand) throw Error("Companion primary lost its mapped land");
      expect(city.groundAt(parentPacket.origin[0] + ownLand[0], parentPacket.origin[2] + ownLand[1])).not.toBeNull();
    }
  } finally {
    city.dispose();
  }
  expect(city.root.children).toHaveLength(0);
  expect(city.residentChunkCount).toBe(0);
}, 45_000);
