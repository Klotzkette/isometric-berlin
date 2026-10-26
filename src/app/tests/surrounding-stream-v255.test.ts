import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { BufferGeometry, type Group, type Mesh } from "three";
import data from "../src/data/tierparkV255.json";
import playgrounds from "../src/data/playgroundsV255.json";
import { prepareTierparkV255, tierparkGroundGuardV255, type TierparkSourceV255 } from "../src/TierparkV255";
import { prepareTierparkV276 } from "../src/TierparkV276";
import { houseCurbGroundGuardV233 } from "../src/houseCurbsV233";
import { createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";

const source = data as TierparkSourceV255;
const dir = path.resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
function fixture(key: string): SurroundingCityChunk {
  const [family, id] = key.split(":");
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${id}.${family}.json.gz`))).toString());
}
function digest(root: Group): string {
  const hash = new Bun.CryptoHasher("sha256");
  root.traverse(object => {
    const mesh = object as Mesh;
    hash.update(JSON.stringify([object.name, object.position.toArray(), object.scale.toArray()]));
    if (!mesh.geometry) return;
    for (const [name, attr] of Object.entries(mesh.geometry.attributes)) {
      const values = "data" in attr ? attr.data.array : attr.array;
      hash.update(name);
      hash.update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
    }
    const index = mesh.geometry.index?.array;
    if (index) hash.update(new Uint8Array(index.buffer, index.byteOffset, index.byteLength));
  });
  return hash.digest("hex");
}

test("streamed Tierpark additions exactly match explicit preparation for all ten existing packets", async () => {
  for (const key of source.ids) {
    const [family, id] = key.split(":"), native = family === "minecraft";
    const raw = fixture(key), unchanged = JSON.stringify(raw);
    const steps = prepareTierparkV255(raw, id, native);
    let next = steps.next(); while (!next.done) next = steps.next();
    const v255 = next.value;
    // V255's original source and addition remain a complete prefix when the
    // separately guarded v276 companion is present on these existing tiles.
    expect(v255.meshes.slice(0, raw.meshes.length)).toEqual(raw.meshes);
    expect(v255.meshes.at(-1)).toBe(source.packets[key].mesh);
    const v276Steps = prepareTierparkV276(v255, id, native);
    let v276 = v276Steps.next(); while (!v276.done) v276 = v276Steps.next();
    expect(v276.value.meshes.slice(0, v255.meshes.length)).toEqual(v255.meshes);
    const explicit = await createSurroundingCityChunkCooperatively(v276.value, id, native);
    const streamed = await createStreamedSurroundingCityChunkV255(raw, id, native);
    try {
      expect(streamed.root.userData.sourceKinds).toContain("tierpark-v255");
      expect(streamed.geometryBytes).toBe(explicit.geometryBytes);
      expect(streamed.bufferCount).toBe(explicit.bufferCount);
      expect(streamed.nav).toEqual(explicit.nav);
      expect(digest(streamed.root)).toBe(digest(explicit.root));
      expect(JSON.stringify(raw)).toBe(unchanged);
    } finally {
      disposeSurroundingCityRoot(explicit.root);
      disposeSurroundingCityRoot(streamed.root);
    }
  }
}, 60_000);

test("the local Tierpark receipt hash equals the existing shared guard exactly", () => {
  for (const key of source.ids) {
    const ground = fixture(key).nav.ground;
    expect(tierparkGroundGuardV255(ground)).toBe(houseCurbGroundGuardV233(ground));
    expect(tierparkGroundGuardV255(ground)).toBe(source.packets[key].guard);
  }
  for (const ground of [[], [{
    ring: [[-1.0005, -0.0005], [0.0005, 1.9995], [3.1415926535, -2.718281828], [-1.0005, -0.0005]],
    holes: [[[0, 0], [.0005, -.0005], [-.0005, .0005], [0, 0]]],
  }]]) expect(tierparkGroundGuardV255(ground)).toBe(houseCurbGroundGuardV233(ground));
});

test("streamed playground metadata is attached without changing its actual geometry or navigation", async () => {
  const id = Object.keys(playgrounds.packetSites)[0], raw = fixture(`drawn:${id}`);
  const base = await createSurroundingCityChunkCooperatively(raw, id);
  const streamed = await createStreamedSurroundingCityChunkV255(raw, id);
  try {
    expect(streamed.root.userData.playgroundV255.fullStaticDetailOnTouch).toBe(true);
    expect(base.root.userData.playgroundV255).toBeUndefined();
    expect(digest(streamed.root)).toBe(digest(base.root));
    expect(streamed.nav).toEqual(base.nav);
  } finally { disposeSurroundingCityRoot(base.root); disposeSurroundingCityRoot(streamed.root); }
});

test("abort during Tierpark preparation leaves the source untouched and publishes no root", async () => {
  const key = source.ids[0], [family, id] = key.split(":"), raw = fixture(key);
  const unchanged = JSON.stringify(raw), controller = new AbortController();
  let yields = 0;
  await expect(createStreamedSurroundingCityChunkV255(raw, id, family === "minecraft", {
    signal: controller.signal, yield: async () => { yields++; controller.abort(); },
  })).rejects.toMatchObject({ name: "AbortError" });
  expect(yields).toBe(1);
  expect(JSON.stringify(raw)).toBe(unchanged);
});

test("abort after decoder allocation disposes the unpublished geometry", async () => {
  const key = source.ids[0], [family, id] = key.split(":"), raw = fixture(key);
  const controller = new AbortController();
  const setAttribute = BufferGeometry.prototype.setAttribute, dispose = BufferGeometry.prototype.dispose;
  const allocated = new Set<BufferGeometry>(), disposed = new Set<BufferGeometry>();
  BufferGeometry.prototype.setAttribute = function (...args) {
    allocated.add(this); return setAttribute.apply(this, args);
  };
  BufferGeometry.prototype.dispose = function () { disposed.add(this); dispose.call(this); };
  try {
    await expect(createStreamedSurroundingCityChunkV255(raw, id, family === "minecraft", {
      signal: controller.signal, budgetMs: 0,
      yield: async () => { if (allocated.size) controller.abort(); },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(allocated.size).toBeGreaterThan(0);
    expect([...allocated].every(geometry => disposed.has(geometry))).toBe(true);
  } finally {
    BufferGeometry.prototype.setAttribute = setAttribute;
    BufferGeometry.prototype.dispose = dispose;
  }
});
