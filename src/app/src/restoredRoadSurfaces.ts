import { BufferAttribute, BufferGeometry, DoubleSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from "three";
import roadDataUrl from "./data/restoredRoadSurfaces.ndjson.txt?url";
import { markArchitecturalInk } from "./architecturalInk";
import { smoothGroundTopSampler, type VoxelPayload } from "./MinecraftVoxelWorld";
import { spreebogenTerrainYAt } from "./spreebogenBankProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { indexGeometryExactly } from "./exactGeometryIndex";

export type RestoredRoadBatch = { id: string; kind: "asphalt" | "paving" | "kerbs"; xz: string; indices?: string };
export type RestoredRoadManifest = { format: string; version: number; encoding: string; source_sha256: string; batch_count: number };
/** A corrupt response cannot grow an unbounded partial-line buffer. */
export const RESTORED_ROAD_MAX_LINE_CHARS = 2 * 1024 * 1024;

function bytes(encoded: string): ArrayBuffer {
  const text = atob(encoded);
  const result = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) result[i] = text.charCodeAt(i);
  return result.buffer;
}

/** No triangulation, smoothing or giant temporary number arrays at startup. */
export function createRestoredRoadBatch(batch: RestoredRoadBatch, terrainAt: (x: number, z: number) => number): Group {
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
      positions.set([x, terrainAt(x,z) + lift, z], i*3);
    }
    const g = geometry(positions);
    g.setIndex(new BufferAttribute(new Uint32Array(bytes(batch.indices!)), 1));
    indexGeometryExactly(g);
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
      positions.set([ax,ay,az, bx,by,bz, bx,by+0.14,bz, ax,ay+0.14,az], i*12);
      indices.set([i*4,i*4+1,i*4+2, i*4,i*4+2,i*4+3], i*6);
      ink.set([ax,ay+0.15,az, bx,by+0.15,bz], i*6);
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

/** Read the next batch only after the caller acknowledges the previous geometry. */
export async function* createRestoredRoadSurfaceBatches(
  ground: VoxelPayload, completed: ReadonlySet<string> = new Set(),
): AsyncGenerator<{ id: string; root: Group }> {
  const response = await fetch(roadDataUrl);
  if (!response.ok) throw new Error(`Exact street data failed with HTTP ${response.status}`);
  if (!response.body) throw new Error("Exact street data has no readable body");
  const sample = smoothGroundTopSampler(ground);
  const {cell_m: cell, grid: {min_x_idx: minX, min_z_idx: minZ}} = ground;
  const terrainAt = (x: number, z: number): number => spreebogenTerrainYAt(x,z,sample(x/cell-minX,z/cell-minZ));
  let manifest: RestoredRoadManifest | undefined;
  let count = 0;
  const ids = new Set<string>();
  for await (const line of roadLines(response.body)) {
    let value: unknown;
    try { value = JSON.parse(line); }
    catch { throw new Error("Exact street data contains invalid JSON"); }
    if (!manifest) {
      const candidate = value as RestoredRoadManifest;
      if (!candidate || candidate.format !== "bounded-source-road-surfaces" || candidate.version !== 1 ||
        candidate.encoding !== "ndjson-base64-float32" || !Number.isSafeInteger(candidate.batch_count) || candidate.batch_count < 0) {
        throw new Error("Exact street data is incomplete");
      }
      manifest = candidate;
      continue;
    }
    const batch = value as RestoredRoadBatch;
    if (!batch || typeof batch.id !== "string" || typeof batch.xz !== "string" ||
      !["asphalt", "paving", "kerbs"].includes(batch.kind) ||
      (batch.kind !== "kerbs" && typeof batch.indices !== "string") || ids.has(batch.id) || ++count > manifest.batch_count) {
      throw new Error("Exact street data contains an invalid batch");
    }
    ids.add(batch.id);
    if (!completed.has(batch.id)) yield { id: batch.id, root: createRestoredRoadBatch(batch, terrainAt) };
    // Do not retain the encoded source while later transferred geometry is built.
    batch.xz = ""; batch.indices = undefined;
  }
  if (!manifest || count !== manifest.batch_count) throw new Error("Exact street data is incomplete");
}
