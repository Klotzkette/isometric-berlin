import { BufferAttribute, BufferGeometry, DoubleSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from "three";
import { trimInvalidenSurfaceV371 } from "./invalidenGroundOwnershipV371";
import { arrivalRoadIdsV376, fetchArrivalRoadsV376 } from "./arrivalRoadRangesV376";
import { admitsSimsonGroundV375 } from "./simsonGroundGuardV375";
import { applySimsonCutsV375 } from "./simsonSurfaceCutsV375";
import { binaryRoadBatches } from "./binaryRoadBatchesV376";
import roadDataUrl from "./data/restoredRoadSurfaces.ndjson.txt?url";
import { markArchitecturalInk } from "./architecturalInk";
import { cutGrosserSternGatehouseGroundSurface, smoothGroundTopSampler, type VoxelPayload } from "./terrainPayload";
import { spreebogenTerrainYAt } from "./spreebogenBankProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { indexGeometryExactly } from "./exactGeometryIndex";
import { cutStelenfeldPavingV385 } from "./stelenfeldPavingV385";
import { decodeLosslessGzipJson } from "./losslessGzipBase85";

import { readRoadWordRecord, readRoadWordBatch, ROAD_PLANES_ENCODING, type RoadWordBatch } from "./roadWordPlanesV362";

export type RestoredRoadBatch = { id: string; kind: "asphalt" | "paving" | "kerbs"; xz: string; indices?: string };
export type RestoredRoadManifest = { format: string; version: number; encoding: string; source_sha256: string; batch_count: number };
/** A corrupt response cannot grow an unbounded partial-line buffer. */
export const RESTORED_ROAD_MAX_LINE_CHARS = 2 * 1024 * 1024;

function bytes(encoded: string | ArrayBuffer): ArrayBuffer {
  if (typeof encoded !== "string") return encoded;
  const text = atob(encoded);
  const result = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) result[i] = text.charCodeAt(i);
  return result.buffer;
}

function writeRoadPoint(target: Float32Array, offset: number, x: number, y: number, z: number): void {
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

/** Write each surveyed point directly to its final attribute. */
export function createRestoredRoadBatch(batch: RestoredRoadBatch | RoadWordBatch, terrainAt: (x: number, z: number) => number, invalidenGroundV371 = false): Group {
  const xz = new Float32Array(bytes(batch.xz));
  const root = new Group();
  root.name = batch.id;
  root.userData.exactSourceRoad = true;
  const geometry = (positions: Float32Array): BufferGeometry => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  };
  const mesh = (g: BufferGeometry, name: string, day: number, night: number): void => {
    const dayMaterial = new MeshBasicMaterial({ color: day, side: DoubleSide });
    const nightMaterial = new MeshBasicMaterial({ color: night, side: DoubleSide });
    const object = new Mesh(g, dayMaterial);
    object.name = name;
    object.userData.dayMaterial = dayMaterial;
    object.userData.nightMaterial = nightMaterial;
    root.add(object);
  };
  if (batch.kind !== "kerbs") {
    const lift = batch.kind === "asphalt" ? 0.14 : 0.1;
    const positions = new Float32Array(xz.length / 2 * 3);
    for (let i = 0; i < xz.length / 2; i++) {
      const x = xz[i*2], z = xz[i*2+1];
      writeRoadPoint(positions, i * 3, x, terrainAt(x, z) + lift, z);
    }
    let g = geometry(positions);
    g.setIndex(new BufferAttribute(new Uint32Array(bytes(batch.indices!)), 1));
    indexGeometryExactly(g);
    // Deferred pretriangulated roads bypass createSmoothSurfaces. Apply the
    // identical four stair apertures here too, without touching other batches.
    const bounds = g.boundingBox!;
    if (bounds.max.x > -1590 && bounds.min.x < -1330 && bounds.max.z > 399 && bounds.min.z < 512) {
      const opened = cutGrosserSternGatehouseGroundSurface(g);
      if (opened !== g) { g.dispose(); g = opened; }
    }
    if (batch.kind === "paving") {
      const opened = cutStelenfeldPavingV385(g);
      if (opened !== g) { g.dispose(); g = opened; }
    }
    mesh(g, batch.kind === "asphalt" ? "smooth carriageways" : "smooth paved paths",
      batch.kind === "asphalt" ? 0xc4c5c0 : 0xdcd8cc,
      batch.kind === "asphalt" ? 0x171c24 : 0x1b222b);
  } else {
    const count = xz.length / 4;
    const positions = new Float32Array(count * 12);
    const indices = new Uint32Array(count * 6);
    const ink = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const ax = xz[i*4], az = xz[i*4+1], bx = xz[i*4+2], bz = xz[i*4+3];
      const ay = terrainAt(ax,az) + 0.14, by = terrainAt(bx,bz) + 0.14;
      const vertex = i * 4;
      const offset = i * 12;
      writeRoadPoint(positions, offset, ax, ay, az);
      writeRoadPoint(positions, offset + 3, bx, by, bz);
      writeRoadPoint(positions, offset + 6, bx, by + 0.14, bz);
      writeRoadPoint(positions, offset + 9, ax, ay + 0.14, az);
      const edge = i * 6;
      indices[edge] = vertex;
      indices[edge + 1] = vertex + 1;
      indices[edge + 2] = vertex + 2;
      indices[edge + 3] = vertex;
      indices[edge + 4] = vertex + 2;
      indices[edge + 5] = vertex + 3;
      writeRoadPoint(ink, edge, ax, ay + 0.15, az);
      writeRoadPoint(ink, edge + 3, bx, by + 0.15, bz);
    }
    const g = geometry(positions); g.setIndex(new BufferAttribute(indices,1));
    indexGeometryExactly(g);
    mesh(g, "smooth kerb upstands", 0xd7d4c8, 0x232a31);
    const inkGeometry = geometry(ink);
    indexGeometryExactly(inkGeometry);
    const edge = new LineSegments(inkGeometry, markArchitecturalInk(new LineBasicMaterial(), "detail"));
    edge.name = "smooth kerb ink"; edge.renderOrder = 2;
    root.add(edge);
  }
  if (invalidenGroundV371) {
    for (const surface of root.children) {
      if (surface instanceof Mesh || surface instanceof LineSegments) trimInvalidenSurfaceV371(surface);
    }
  }
  return freezeStaticSceneTransforms(root);
}

/** Decode one bounded line, including UTF-8 characters split by network chunks. */
async function* roadLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        pending += decoder.decode();
        break;
      }
      // A cache may deliver the entire response in one binary chunk. Keep the
      // decoded JS string bounded even when that browser-owned buffer is large.
      for (let start = 0; start < result.value.byteLength; start += 64 * 1024) {
        pending += decoder.decode(result.value.subarray(start, start + 64 * 1024), { stream: true });
        let end = pending.indexOf("\n");
        while (end >= 0) {
          if (end > RESTORED_ROAD_MAX_LINE_CHARS) throw new Error("Exact street batch exceeds its bounded line size");
          const line = pending.slice(0, end);
          pending = pending.slice(end + 1);
          if (line.trim()) yield line;
          end = pending.indexOf("\n");
        }
        if (pending.length > RESTORED_ROAD_MAX_LINE_CHARS) throw new Error("Exact street batch exceeds its bounded line size");
      }
    }
    if (pending.trim()) yield pending;
  } finally {
    pending = "";
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Vite dev serves the original NDJSON. Build only the selected source rows
 * and stop reading as soon as they have all been received. */
async function* developmentArrivalRoads(ids: readonly string[], signal: AbortSignal): AsyncGenerator<RestoredRoadBatch> {
  const wanted = new Set(ids);
  const response = await fetch(roadDataUrl, { signal });
  if (!response.ok || !response.body) throw new Error(`Exact street data failed with HTTP ${response.status}`);
  for await (const line of roadLines(response.body)) {
    const row = JSON.parse(line);
    if (wanted.delete(row.id)) {
      if ((row.kind !== "asphalt" && row.kind !== "paving") || !row.id.startsWith("restored-" + row.kind + "-") ||
          typeof row.indices !== "string" || typeof row.xz !== "string") throw new Error("Invalid road source");
      yield row;
      if (!wanted.size) return;
    }
  }
}

function roadTerrainAt(ground: VoxelPayload): (x: number, z: number) => number {
  const sample = smoothGroundTopSampler(ground);
  const { cell_m: cell, grid: { min_x_idx: minX, min_z_idx: minZ } } = ground;
  return (x, z) => spreebogenTerrainYAt(x, z, sample(x / cell - minX, z / cell - minZ));
}

export async function* loadArrivalRoadBatchesV376(
  ground: VoxelPayload, targetX: number, targetZ: number, completed: ReadonlySet<string>,
  signal: AbortSignal, invalidenGroundV371: boolean,
): AsyncGenerator<{ id: string; root: Group }> {
  const ids = arrivalRoadIdsV376(targetX, targetZ).filter(id => !completed.has(id));
  if (!ids.length) return;
  const terrainAt = roadTerrainAt(ground);
  const simson = admitsSimsonGroundV375(ground);
  const batches = roadDataUrl.endsWith(".bin")
    ? fetchArrivalRoadsV376(roadDataUrl, ids, completed, signal) : developmentArrivalRoads(ids, signal);
  for await (const batch of batches) {
    if (signal.aborted || completed.has(batch.id)) continue;
    const root = createRestoredRoadBatch(batch, terrainAt, invalidenGroundV371);
    if (simson) applySimsonCutsV375(root, batch.id);
    yield { id: batch.id, root };
  }
}

/** Read the next batch only after the caller acknowledges the previous geometry. */
export async function* createRestoredRoadSurfaceBatches(
  ground: VoxelPayload, completed: ReadonlySet<string> = new Set(), invalidenGroundV371 = false,
): AsyncGenerator<{ id: string; root: Group }> {
  const response = await fetch(roadDataUrl);
  if (!response.ok) throw new Error(`Exact street data failed with HTTP ${response.status}`);
  if (!response.body) throw new Error("Exact street data has no readable body");
  const terrainAt = roadTerrainAt(ground);
  if (roadDataUrl.endsWith(".bin")) {
    for await (const batch of binaryRoadBatches(response.body, completed)) {
      yield { id: batch.id, root: createRestoredRoadBatch(batch, terrainAt, invalidenGroundV371) };
    }
    return;
  }
  let manifest: RestoredRoadManifest | undefined;
  let count = 0;
  const ids = new Set<string>();
  for await (const line of roadLines(response.body)) {
    let value: unknown;
    try { value = manifest?.encoding === "ndjson-gzip-base85-json" ? decodeLosslessGzipJson(line, RESTORED_ROAD_MAX_LINE_CHARS) : JSON.parse(line); }
    catch { throw new Error("Exact street data contains invalid JSON"); }
    if (!manifest) {
      const candidate = value as RestoredRoadManifest;
      if (!candidate || candidate.format !== "bounded-source-road-surfaces" || candidate.version !== 1 ||
        !["ndjson-base64-float32", "ndjson-gzip-base85-json", ROAD_PLANES_ENCODING].includes(candidate.encoding) || !Number.isSafeInteger(candidate.batch_count) || candidate.batch_count < 0) {
        throw new Error("Exact street data is incomplete");
      }
      manifest = candidate;
      continue;
    }
    const packed = manifest.encoding === ROAD_PLANES_ENCODING ? readRoadWordRecord(value, RESTORED_ROAD_MAX_LINE_CHARS) : null;
    const plain = value as RestoredRoadBatch;
    if (!packed && (!plain || typeof plain.id !== "string" || typeof plain.xz !== "string" ||
        !["asphalt", "paving", "kerbs"].includes(plain.kind) || (plain.kind !== "kerbs" && typeof plain.indices !== "string"))) {
      throw new Error("Exact street data contains an invalid batch");
    }
    const id = packed?.id ?? plain.id;
    if (ids.has(id) || ++count > manifest.batch_count) throw new Error("Exact street data contains an invalid batch");
    ids.add(id);
    if (completed.has(id)) continue;
    yield { id, root: createRestoredRoadBatch(packed ? readRoadWordBatch(packed) : plain, terrainAt, invalidenGroundV371) };
  }
  if (!manifest || count !== manifest.batch_count) throw new Error("Exact street data is incomplete");
}
