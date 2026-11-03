import { expect, test } from "bun:test";
import { Mesh, OrthographicCamera } from "three";
import { createSurroundingCity, disposeSurroundingCityRoot, type SurroundingCityManifest } from "../src/SurroundingCity";
import { buildSurroundingCityChunk, type SurroundingCityChunk, type SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303, sourceQuarterOwnersV303, type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";

const finish = <T>(steps: Generator<void, T>): T => { let s = steps.next(); while (!s.done) s = steps.next(); return s.value; };
const b64 = (v: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
const hash = (v: string) => { let h = 2166136261; for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 16777619) >>> 0; return h; };
const words = [1, 258, 65534, 32769, 1000, 12345, 65535, 257, 0];
function fixture() {
  const old: SurroundingPackedMesh = { kind: "ground", positionType: "u16cm", positions: b64(new Uint16Array([0, 1300, 0, 100, 1300, 0, 0, 1300, 100])), colors: b64(new Uint8Array(9).fill(80)), indices: b64(new Uint32Array([0, 1, 2])) };
  const raw: SurroundingCityChunk = { schemaVersion: 1, origin: [0, -10, 0], meshes: [old], nav: { groundY: 3, ground: [], water: [], buildings: [] } };
  const append: SurroundingPackedMesh = { ...old, kind: "linear-complement-v309", colorType: "u16linear", colors: b64(new Uint16Array(words)) };
  const pin = { mesh: 0, kind: old.kind, fingerprint: hash(old.positions + old.colors + old.indices) };
  const source: SourceQuarterSourceV303 = { schemaVersion: 1, keys: ["drawn:linear-probe", "minecraft:linear-probe"], packets: {} };
  for (const key of source.keys) source.packets[key] = { origin: raw.origin, records: [pin], preparedRecords: [pin], navGuard: hash(JSON.stringify(raw.nav)), preparedNavGuard: hash(JSON.stringify(raw.nav)), lineGuard: null, preparedLineGuard: null, append, appendFingerprint: hash(append.positions + append.colors + append.indices), retire: [{ mesh: 0, triangles: [0] }], retireLines: [], retireNav: [], appendNav: [], owners: ["exact-ground-complement"] };
  return { raw, source, append };
}

test("source-owned linear RGB preserves non-byte-aligned decoder colours in both scene families", () => {
  for (const native of [false, true]) {
    const { raw, source } = fixture(), before = JSON.stringify(raw);
    const result = finish(buildSurroundingCityChunk(raw, "linear-probe", native, false, { sourceQuartersV303: true, sourceQuarterSourcesV303: [{ source, kind: "linear-complement-v309" }] }));
    try {
      const geometry = (result.root.children[0] as Mesh).geometry;
      const colors = geometry.getAttribute("color");
      const actual = colors.array as Uint16Array;
      expect(Array.from({ length: 9 }, (_, i) => actual[(3 + Math.floor(i / 3)) * 6 + 3 + i % 3])).toEqual(words);
      expect(Array.from({ length: 9 }, (_, i) => actual[Math.floor(i / 3) * 6 + 3 + i % 3])).toEqual(new Array(9).fill(80 * 257));
      expect([...geometry.index!.array]).toEqual([0, 0, 0, 3, 4, 5]);
      expect(result.root.userData.sourceQuarterOwnersV303).toEqual(["exact-ground-complement"]);
      expect(result.geometryBytes).toBe(6 * 12 + 6 * 2);
      expect(JSON.stringify(raw)).toBe(before);
    } finally { disposeSurroundingCityRoot(result.root); }
  }
});

test("unknown formats and truncated linear words cannot acquire a transfer", () => {
  for (const corrupt of [(p: SurroundingPackedMesh) => { p.colorType = "float" as "u8"; }, (p: SurroundingPackedMesh) => { p.colors = b64(new Uint8Array(9)); }]) {
    const { raw, source, append } = fixture(); corrupt(append);
    source.packets[source.keys[0]].appendFingerprint = hash(append.positions + append.colors + append.indices);
    expect(finish(captureSourceQuarterPacketV303(raw, "linear-probe", false, true, source, append.kind))).toBeUndefined();
    const invalid = { ...raw, meshes: [append] };
    expect(() => finish(buildSurroundingCityChunk(invalid, "linear-probe"))).toThrow();
  }
});

test("linear format is part of the complete predecessor snapshot across yields", () => {
  const { raw, source, append } = fixture();
  const capture = captureSourceQuarterPacketV303(raw, "linear-probe", false, true, source, append.kind);
  expect(capture.next().done).toBeFalse();
  raw.meshes[0].colorType = "u8";
  expect(finish(capture)).toBeUndefined();
  const clean = fixture();
  const ticket = finish(captureSourceQuarterPacketV303(clean.raw, "linear-probe", false, true, clean.source, clean.append.kind));
  const prepared = { ...clean.raw, meshes: clean.raw.meshes.map(p => ({ ...p })) };
  const steps = prepareSourceQuarterPacketV303(prepared, ticket);
  expect(steps.next().done).toBeFalse();
  prepared.meshes[0].colorType = "u8";
  const rejected = finish(steps);
  expect(rejected).toBe(prepared); expect(sourceQuarterOwnersV303(rejected)).toEqual([]);
});

test("final linear colours bypass legacy palette interpretation even for a city part", () => {
  const { raw, append } = fixture(); raw.meshes = [{ ...append, kind: "city" }];
  const result = finish(buildSurroundingCityChunk(raw, "outer187-12_16"));
  try {
    const a = ((result.root.children[0] as Mesh).geometry.getAttribute("color").array) as Uint16Array;
    expect(Array.from({ length: 9 }, (_, i) => a[Math.floor(i / 3) * 6 + 3 + i % 3])).toEqual(words);
  } finally { disposeSurroundingCityRoot(result.root); }
});

test("northern complete admission is independent of the earlier Neukölln owner", () => {
  const { raw, source, append } = fixture();
  const sources = [{ source, kind: append.kind, requiredReplacement: true, admission: "north-v309" as const }];
  for (const ready of [false, true]) {
    const result = finish(buildSurroundingCityChunk(raw, "linear-probe", false, false, { sourceQuartersV303: true, sourceQuarterSourcesV303: sources, northFidelityV309: ready, neukoellnLandmarksV305: !ready }));
    try { expect(result.root.userData.sourceQuarterOwnersV303).toEqual(ready ? ["exact-ground-complement"] : []); expect((result.root.children[0] as Mesh).geometry.index!.count).toBe(ready ? 6 : 3); }
    finally { disposeSurroundingCityRoot(result.root); }
  }
});

async function until(check: () => boolean) { for (let i = 0; i < 300; i++) { if (check()) return; await new Promise(done => setTimeout(done, 2)); } throw Error("Finite northern controller did not settle"); }
function controllerFixture() {
  const f = fixture(), camera = new OrthographicCamera(-10, 10, 10, -10, .1, 100);
  camera.position.set(.5, 20, .5); camera.up.set(0, 0, -1); camera.lookAt(.5, 0, .5); camera.updateMatrixWorld();
  const polygon = { ring: [[0, 0], [1, 0], [1, 1], [0, 1]], holes: [] };
  const manifest: SurroundingCityManifest = { schemaVersion: 1, groundY: 3, footprint: [polygon], chunks: [{ id: "linear-probe", bounds: [0, 0, 1, 1], drawn: { url: "drawn.json", bytes: JSON.stringify(f.raw).length }, minecraft: { url: "native.json", bytes: JSON.stringify(f.raw).length } }] };
  const fetcher = (async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith("manifest.json") ? manifest : f.raw))) as typeof fetch;
  return { ...f, camera, fetcher, sources: [{ source: f.source, kind: f.append.kind, requiredReplacement: true, admission: "north-v309" as const }] };
}

test("northern admission and revocation reload only the exact bounded resident transaction", async () => {
  const f = controllerFixture(); let ready = false, clock = 0;
  const city = createSurroundingCity({ camera: f.camera, fetch: f.fetcher, manifestUrl: new URL("https://example.test/manifest.json"), now: () => clock, sourceQuartersV303: true, sourceQuarterSourcesV303: f.sources, neukoellnLandmarksV305: () => true, northFidelityV309: () => ready });
  try {
    await city.ready; await until(() => !city.pending && city.residentChunkCount === 1);
    expect(city.root.children[0].userData.sourceQuarterOwnersV303).toEqual([]);
    ready = true; clock = 1000; city.refresh(clock); await until(() => !city.pending && city.residentChunkCount === 1);
    expect(city.root.children[0].userData.sourceQuarterOwnersV303).toEqual(["exact-ground-complement"]);
    ready = false; clock = 2000; city.refresh(clock); await until(() => !city.pending && city.residentChunkCount === 1);
    expect(city.root.children[0].userData.sourceQuarterOwnersV303).toEqual([]);
    expect([...(city.root.children[0].children[0] as Mesh).geometry.index!.array]).toEqual([0, 1, 2]);
  } finally { city.dispose(); }
});

test("revocation during northern onAttach never announces a partial source owner", async () => {
  const f = controllerFixture(); let ready = true, attached = 0; const announcements: string[] = [];
  const city = createSurroundingCity({ camera: f.camera, fetch: f.fetcher, manifestUrl: new URL("https://example.test/manifest.json"), sourceQuartersV303: true, sourceQuarterSourcesV303: f.sources, northFidelityV309: () => ready, onAttach: () => { attached++; ready = false; }, onQuarterResidentsV303: keys => { announcements.push(...keys); } });
  try { await city.ready; await until(() => !city.pending); expect(attached).toBe(1); expect(city.residentChunkCount).toBe(0); expect(announcements).toEqual([]); }
  finally { city.dispose(); }
});
