import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { InterleavedBufferAttribute, LineSegments, Mesh } from "three";
import { berlinSenateSourceV321 } from "../src/BerlinSenateV321";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, loadSourceQuarterRecipesV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { captureSourceQuarterPacketV303, type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import {
  buildSurroundingCityChunk, prepareSurroundingQuarterPredecessorV303,
  type SurroundingChunkGeometry, type SurroundingCityChunk, type SurroundingOwnershipOptions,
} from "../src/SurroundingCityGeometry";

const id = "ring182--7_13";
const kind = "albrechtstrasse-v328";
const heese = "heesestrasse-v328";
const repo = resolve(import.meta.dir, "../../..");
const path = resolve(repo, "src/app/src/data/albrechtstrasseV328Packets.json");
const pub = resolve(repo, "src/app/public/mesh/surrounding-berlin-v159");
const order = SOURCE_QUARTER_CATALOGUE_V309.findIndex(entry => entry.kind === kind);
const preceding = new Set(SOURCE_QUARTER_CATALOGUE_V309.slice(0, order).map(entry => entry.kind));
const load = createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(entry => entry.kind !== kind));
const opts: SurroundingOwnershipOptions = {
  schlossplatzV239: true, staatsoperV240: true, architectureV241: true, mitteEnsembleV281: true,
  prenzlbergV264: true, chariteBridgesV265: true, operaTheatresV274: true, northernSitesV266: true,
  golgathaV270: true, tachelesFrontsV270: true, southFidelityV294: true, littenStadthausV297: true,
  wallGalleryV298: true, stralauSisyphosV299: true, neighbourhoodV300: true, westKiezV302: true,
  sourceQuartersV303: true, neukoellnLandmarksV305: true, northFidelityV309: true,
  treptowWaterfrontV317: true, governmentOfficesV321: true, universitiesV322: true,
  wilhelmHousingV324: true, wilhelmStreetFrontsV325: true, southWestSitesV326: true,
  clusterFacadesV320: clusterFacadesSourceV320, berlinSenateV321: berlinSenateSourceV321,
};

function drain<T>(work: Generator<void, T>): T {
  for (;;) {
    const n = work.next();
    if (n.done) return n.value;
  }
}

function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value;
}

function lineGuard(chunk: SurroundingCityChunk) {
  return chunk.lines ? hash(chunk.lines.positions + (chunk.lines.colors ?? "")) : null;
}

function geometryWords(result: SurroundingChunkGeometry) {
  const body = result.root.children.find(c => (c as Mesh).isMesh) as Mesh;
  const ink = result.root.children.find(c => (c as LineSegments).isLineSegments) as LineSegments | undefined;
  assert(body.geometry.index);
  const pos = body.geometry.attributes.position as InterleavedBufferAttribute;
  const inkPosition = ink?.geometry.attributes.position;
  return {
    vertex: pos.data.array as Uint16Array,
    index: body.geometry.index.array as Uint16Array | Uint32Array,
    ink: inkPosition && ("data" in inkPosition ? (inkPosition as InterleavedBufferAttribute).data.array : inkPosition.array),
  };
}

const provisional = Bun.argv[2];
const check = provisional === "--check";
if (!provisional) throw Error("Supply the provisional Python output path or --check");
const source = JSON.parse(readFileSync(check ? path : provisional, "utf8")) as NeighbourhoodSourceV300;
if (check) assert(order >= 0, "The production catalogue must contain Albrechtstraße");
const wireHashes = {
  drawn: "9c557b4f8247ce5a5c058585d1e4f4779e5060498b98af0364b6ff1d40e84860",
  minecraft: "e2ca22348a6a74e1d9212ae6375420ef4c2eb43d8ab7faf380c6ab29ba5d5792",
};
const results = [];
for (const mode of ["drawn", "minecraft"] as const) {
  const native = mode === "minecraft", key = `${mode}:${id}`;
  const wire = readFileSync(resolve(pub, `${id}.${mode}.json.gz`));
  assert.equal(createHash("sha256").update(wire).digest("hex"), wireHashes[mode]);
  const raw = JSON.parse(gunzipSync(wire).toString()) as SurroundingCityChunk;
  const rawSnapshot = JSON.stringify(raw);
  const actualRecipes = check ? await loadSourceQuarterRecipesV309(id, native) : undefined;
  const older = actualRecipes?.filter(entry => entry.kind !== kind) ?? await load(id, native);
  const before = order < 0 ? older : older.filter(entry => preceding.has(entry.kind));
  const after = order < 0 ? [] : older.filter(entry => !preceding.has(entry.kind));
  const plan = source.packets[key], appendSnapshot = JSON.stringify(plan.append);
  if (check) assert(older.some(entry => entry.kind === heese), "The actual predecessor catalogue must include Heesestraße");
  let prepared = drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw), id, native, opts));
  for (const entry of before) {
    const ticket = entry.source.packets[key]?.preparedRecords
      ? drain(captureSourceQuarterPacketV303(raw, id, native, true, entry.source, entry.kind, entry.requiredReplacement))
      : drain(captureNeighbourhoodPacketV300(raw, id, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind));
    assert(ticket, `Exact source receipt failed for ${entry.kind}`);
    const next = drain(ticket(prepared));
    assert.notEqual(next, prepared, `Prepared source receipt failed for ${entry.kind}`);
    prepared = next;
  }
  const guards = {
    navGuard: hash(JSON.stringify(raw.nav)), lineGuard: lineGuard(raw),
    preparedNavGuard: hash(JSON.stringify(prepared.nav)), preparedLineGuard: lineGuard(prepared),
  };
  if (check) for (const name of Object.keys(guards) as (keyof typeof guards)[]) assert.equal(plan[name], guards[name]);
  else Object.assign(plan, guards);
  const baseline = drain(buildSurroundingCityChunk(raw, id, native, false, { ...opts, sourceQuarterSourcesV303: older }));
  const actual = drain(buildSurroundingCityChunk(raw, id, native, false, {
    ...opts, sourceQuarterSourcesV303: actualRecipes ?? [...before, { source: source as unknown as SourceQuarterSourceV303, kind }, ...after],
  }));
  try {
    const kinds = actual.root.userData.sourceKinds as string[];
    assert.deepEqual(kinds.filter(k => k !== kind), baseline.root.userData.sourceKinds);
    assert(kinds.includes(kind));
    assert(kinds.includes("cluster-facades-v320"));
    if (check) {
      const i = kinds.indexOf("steglitz-post-v328");
      assert(i >= 0 && i < kinds.indexOf(heese) && kinds.indexOf(heese) < kinds.indexOf(kind));
      assert(kinds.indexOf(kind) < kinds.indexOf("steglitz-streets-v328"));
    }
    assert(kinds.indexOf(kind) < kinds.indexOf("cluster-facades-v320"));
    assert.deepEqual(actual.nav, baseline.nav);
    assert.equal(actual.bufferCount, baseline.bufferCount);
    const a = geometryWords(actual), b = geometryWords(baseline);
    assert.deepEqual(a.ink, b.ink);
    const atVertex = prepared.meshes.reduce((sum, mesh) => sum + Buffer.from(mesh.positions, "base64").length / 6, 0);
    const atIndex = prepared.meshes.reduce((sum, mesh) => sum + Buffer.from(mesh.indices, "base64").length / 4, 0);
    const newVertices = Buffer.from(plan.append.positions, "base64");
    const newColors = Buffer.from(plan.append.colors, "base64");
    const newIndices = Buffer.from(plan.append.indices, "base64");
    const insertedVertexCount = newVertices.length / 6, insertedIndexCount = newIndices.length / 4;
    assert.equal(a.vertex.length, b.vertex.length + insertedVertexCount * 6);
    assert.equal(a.index.length, b.index.length + insertedIndexCount);
    assert.deepEqual(a.vertex.subarray(0, atVertex * 6), b.vertex.subarray(0, atVertex * 6));
    assert.deepEqual(a.vertex.subarray((atVertex + insertedVertexCount) * 6), b.vertex.subarray(atVertex * 6));
    for (let i = 0; i < insertedVertexCount; i++) {
      for (let axis = 0; axis < 3; axis++) {
        assert.equal(a.vertex[(atVertex + i) * 6 + axis], newVertices.readUInt16LE(i * 6 + axis * 2));
        assert.equal(a.vertex[(atVertex + i) * 6 + axis + 3], newColors[i * 3 + axis] * 257);
      }
    }
    for (let i = 0; i < b.index.length; i++) {
      const old = b.index[i];
      assert.equal(a.index[i + (i < atIndex ? 0 : insertedIndexCount)], old + (old < atVertex ? 0 : insertedVertexCount));
    }
    for (let i = 0; i < insertedIndexCount; i++) assert.equal(a.index[atIndex + i], atVertex + newIndices.readUInt32LE(i * 4));
    const changed = structuredClone(raw);
    changed.meshes[0].colors = (changed.meshes[0].colors[0] === "A" ? "B" : "A") + changed.meshes[0].colors.slice(1);
    assert.equal(drain(captureNeighbourhoodPacketV300(changed, id, native, true, source, kind)), undefined);
    assert.equal(JSON.stringify(raw), rawSnapshot);
    assert.equal(JSON.stringify(plan.append), appendSnapshot);
    results.push({ mode, kinds, triangles: insertedIndexCount / 3, vertices: insertedVertexCount,
      geometryBytes: actual.geometryBytes, addedGeometryBytes: actual.geometryBytes - baseline.geometryBytes,
      originalVertexWords: b.vertex.length, originalIndexWords: b.index.length, inkWords: b.ink?.length ?? 0, guards });
  } finally {
    disposeSurroundingCityRoot(baseline.root);
    disposeSurroundingCityRoot(actual.root);
  }
}
if (!check) writeFileSync(path, JSON.stringify(source) + "\n");
console.log(JSON.stringify(results));
