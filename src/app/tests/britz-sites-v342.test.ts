import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { Mesh, OrthographicCamera, Raycaster, Vector3 } from "three";
import { createSurroundingCity, validateSurroundingManifest, type SurroundingChunkDescriptor } from "../src/SurroundingCity";
import { surroundingPolygonContains, type SurroundingCityChunk, type SurroundingPolygon } from "../src/SurroundingCityGeometry";

const published = resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
const staged = Bun.env.BRITZ_V342_STAGE ?? published;
const read = (name: string) => readFileSync(resolve(existsSync(resolve(staged, name)) ? staged : published, name));
const ids = ["britz342-8_15", "britz342-8_16", "britz342-9_15", "britz342-10_15"];
const family = (native: boolean) => native ? "minecraft" : "drawn";

function packet(entry: SurroundingChunkDescriptor, native: boolean): SurroundingCityChunk {
  const asset = entry[family(native)], bytes = read(asset.url), decoded = gunzipSync(bytes);
  expect(bytes.length).toBe(asset.bytes);
  expect(decoded.length).toBe(asset.decodedBytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256!);
  return JSON.parse(decoded.toString());
}

function interior(polygon: SurroundingPolygon, test = (_x: number, _z: number) => true): [number, number] | undefined {
  const x = polygon.ring.map(p => p[0]), z = polygon.ring.map(p => p[1]);
  for (let pz = Math.min(...z) + .2; pz < Math.max(...z); pz += .5) {
    for (let px = Math.min(...x) + .2; px < Math.max(...x); px += .5) {
      if (surroundingPolygonContains(polygon, px, pz) && test(px, pz)) return [px, pz];
    }
  }
}

test("Britz production controller retains full Drawn/Native land, ponds, castle and Museum connection", async () => {
  let full = JSON.parse(readFileSync(resolve(published, "manifest.json")).toString());
  if (!full.chunks.some((r: SurroundingChunkDescriptor) => r.id === ids[0])) {
    const delta = JSON.parse(read("britz342-manifest-delta.json").toString());
    full = { ...full, chunks: [...full.chunks, ...delta.chunks], footprint: [...full.footprint, ...delta.footprint] };
  }

  const chunks = full.chunks.filter((r: SurroundingChunkDescriptor) => ids.includes(r.id) || r.id === "publicInstitutions326-8_16-p0") as SurroundingChunkDescriptor[];
  expect(chunks).toHaveLength(5);
  // The isolated production test admits only these actual terrain owners;
  // it does not broaden manifest counts or any live decoder allowance.
  const deltaPath = resolve(staged, "britz342-manifest-delta.json");
  const ownFootprint = existsSync(deltaPath)
    ? JSON.parse(readFileSync(deltaPath).toString()).footprint
    : full.footprint.slice(-4);
  const previousFootprint = full.footprint.slice(0, full.gardenFootprintStartV330)
    .filter((p: SurroundingPolygon) => surroundingPolygonContains(p,4325,8210));
  expect(previousFootprint.length).toBeGreaterThan(0);
  const manifest = validateSurroundingManifest({ ...full, chunks,
    footprint: [...previousFootprint, ...ownFootprint], gardenFootprintStartV330: previousFootprint.length });
  const camera = new OrthographicCamera(-900, 900, 700, -700, 1, 1800);
  camera.position.set(4700, 550, 8080); camera.up.set(0, 0, -1);
  camera.lookAt(4700, 0, 8080); camera.updateMatrixWorld();
  const requests: string[] = [], errors: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const name = new URL(String(input)).pathname.split("/").at(-1)!;
    requests.push(name);
    if (name === "manifest.json") return new Response(JSON.stringify(manifest));
    if (!chunks.some(r => r.drawn.url === name || r.minecraft.url === name)) throw Error(`Unexpected fetch ${name}`);
    return new Response(read(name));
  }) as typeof fetch;
  const city = createSurroundingCity({ camera, manifestUrl: new URL("https://britz.test/manifest.json"), fetch: fetcher,
    mode: "day", publicSitesV326: true, onError: e => errors.push(e) });
  try {
    await city.ready;
    for (const native of [false, true]) {
      if (native) city.setMode("minecraft");
      const deadline = performance.now() + 20_000;
      while (!errors.length && (city.pending || city.residentChunkCount !== chunks.length) && performance.now() < deadline) {
        await new Promise<void>(done => setTimeout(done, 2));
      }
      expect(errors).toEqual([]); expect(city.residentChunkCount).toBe(5);
      city.root.updateMatrixWorld(true);
      for (const entry of chunks) {
        expect(requests).toContain(entry[family(native)].url);
        const raw = packet(entry, native);
        if (!ids.includes(entry.id)) continue;
        const land = raw.nav.ground.map(p => interior(p, (x,z) => !raw.nav.buildings.some(b => surroundingPolygonContains(b,x,z))
          && !raw.nav.water.some(w => surroundingPolygonContains(w,x,z)))).find(p => p);
        if (!land) throw Error(`No real Britz land in ${entry.id}`);
        const x = raw.origin[0] + land[0], z = raw.origin[2] + land[1];
        expect(city.groundAt(x,z)).toBeCloseTo(3,7);
        expect(city.gardenGroundAtV330(x,z)).toBeCloseTo(3,7);
        const root = city.root.children.find(r => r.name === `Surrounding Berlin outline ${entry.id}${native ? " native Minecraft" : ""}`)!;
        const meshes = root.children.filter((child): child is Mesh => child instanceof Mesh);
        const ray = new Raycaster(new Vector3(x,90,z),new Vector3(0,-1,0));
        expect(ray.intersectObjects(meshes).some(h => Math.abs(h.point.y-3)<.011)).toBe(true);
      }
      const west = packet(chunks.find(r => r.id === "britz342-8_15")!,native);
      const castle = west.nav.buildings.find(r => (r as typeof r & {parentId?: string}).parentId === "DEBE08YYF0001Us4" && r.height>5 && interior(r));
      if (!castle) throw Error("Missing complete Schloss Britz body");
      const cp=interior(castle)!;
      expect(city.solidAt(west.origin[0]+cp[0],3+(castle.groundOffset??0)+castle.height/2,west.origin[2]+cp[1])).toBe(true);
      const wet = packet(chunks.find(r=>r.id==="britz342-9_15")!,native);
      const water=wet.nav.water.map(p=>interior(p)).find(p=>p);
      if (!water) throw Error("Missing Hufeisenteich water");
      const wx=wet.origin[0]+water[0],wz=wet.origin[2]+water[1];
      expect(city.waterAt(wx,wz)).toBe(true);
      expect(city.groundAt(wx,wz)).toBeNull(); expect(city.gardenGroundAtV330(wx,wz)).toBeNull();
      const museum=packet(chunks.find(r=>r.id==="publicInstitutions326-8_16-p0")!,native);
      const old=museum.nav.buildings.find(r=>(r as typeof r & {parentId?: string}).parentId==="DEBE08YYF0001cxC" && r.height>5 && interior(r));
      if (!old) throw Error("Lost existing Museum Neukölln");
      const mp=interior(old)!;
      expect(city.solidAt(museum.origin[0]+mp[0],3+(old.groundOffset??0)+old.height/2,museum.origin[2]+mp[1])).toBe(true);
      expect(city.groundAt(museum.origin[0]+mp[0],museum.origin[2]+mp[1])).toBeCloseTo(3,7);
      expect(city.solidAt(0,3,0)).toBe(false);
    }
  } finally { city.dispose(); }
  expect(city.residentChunkCount).toBe(0); expect(city.root.children).toHaveLength(0);
},45_000);
