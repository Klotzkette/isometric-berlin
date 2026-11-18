import { ShapeUtils, Vector2 } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { allotmentNavigationGuardStepsV264 } from "./AllotmentsV264";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { fetchSurroundingTransport } from "./surroundingTransport";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";
import index from "./data/allotmentDetailsV360Index.json";
import exteriorIndex from "./data/allotmentDetailsV360ExteriorIndex.json";

const KIND = "allotment-details-v360";
const MAX_COMPRESSED_BYTES = 128 * 1024;
const MAX_DECODED_BYTES = 512 * 1024;
const MAX_RECENT_GROUP_BYTES = 192 * 1024;
const MAX_VERTICES = 40_000;
const MAX_INDICES = 90_000;
const MAX_EXTERIOR_VERTICES = 80_000;
const MAX_EXTERIOR_INDICES = 120_000;
const MAX_RUNS = 5_000;
const MAX_EXTERIOR_RUNS = 10_000;

type PacketLocator = { file: string; ids: string[]; decodedBytes: number; compressedBytes: number };
type Sheet = [baseY: number, height: number, style: number, rings: number[][]];
type NativeRun = [x: number, z: number, width: number, depth: number, baseY: number, height: number, style: number];
type NativeStyle = [baseY: number, height: number, style: number, columns: string];
export type AllotmentDetailPlanV360 = {
  origin: [number, number, number];
  guard: number;
  sheets?: Sheet[];
  runs?: number[];
  byStyle?: NativeStyle[];
  foundation?: number[][][];
};
type Families = { drawn?: AllotmentDetailPlanV360; minecraft?: AllotmentDetailPlanV360; foundation?: number[][][] };
type PacketSource = { schemaVersion: 1; packets: Record<string, Families> };

const OUTER_TILE_METRES = 512;
const EXTERIOR_GROUND_Y = 3;
const FOUNDATION_STYLE = 4;
const exteriorTileCoordinates: readonly number[][] = exteriorIndex.tiles;
export const allotmentExteriorTilesV360 = exteriorTileCoordinates.map(([i, j]) => {
  const x = i * OUTER_TILE_METRES, z = j * OUTER_TILE_METRES;
  return { id: `allotment360-${i}_${j}`, bounds: [x, z, x + OUTER_TILE_METRES, z + OUTER_TILE_METRES] as [number, number, number, number] };
});

const locatorById = new Map<string, PacketLocator>();
for (const locator of index.sources as PacketLocator[]) {
  for (const id of locator.ids) locatorById.set(id, locator);
}
const decodedFiles = new WeakMap<PacketLocator, WeakRef<PacketSource>>();
let recentGroup: { locator: PacketLocator; source: PacketSource } | undefined;
let assetUrls: Record<string, string> = {};
try {
  assetUrls = import.meta.glob<string>("./data/allotmentDetailsV360Packets*.json.gz", {
    eager: true, query: "?url&no-inline", import: "default",
  });
} catch { /* Non-Vite tools use the original gzip files directly. */ }

export function hasAllotmentDetailPlanV360(id: string): boolean {
  return locatorById.has(id);
}

/** Keep the last small validated group available for adjacent tiles. Older
 * groups can be collected whenever the browser needs the memory. */
export async function loadAllotmentDetailPlanV360(
  id: string, native: boolean, signal: AbortSignal, fetcher: typeof fetch,
  idleMs: number,
): Promise<AllotmentDetailPlanV360 | undefined> {
  const locator = locatorById.get(id);
  if (!locator) return undefined;
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  let source = recentGroup?.locator === locator ? recentGroup.source : decodedFiles.get(locator)?.deref();
  if (!source) {
    if (!Number.isSafeInteger(locator.compressedBytes) || locator.compressedBytes < 18 ||
        locator.compressedBytes > MAX_COMPRESSED_BYTES || !Number.isSafeInteger(locator.decodedBytes) ||
        locator.decodedBytes < 1 || locator.decodedBytes > MAX_DECODED_BYTES ||
        !locator.ids.length || locator.ids.length > 32) throw Error("Invalid allotment group size");
    const path = `./data/${locator.file}`;
    const asset = assetUrls[path];
    const url = asset ? new URL(asset, globalThis.location.href) : new URL(path, import.meta.url);
    const { body } = await fetchSurroundingTransport(fetcher, url, signal, {}, idleMs);
    const bytes = new Uint8Array(locator.compressedBytes);
    let length = 0;
    const reader = body.getReader();
    let complete = false;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) { complete = true; break; }
        if (value.byteLength > bytes.length - length) throw Error("Allotment transfer exceeds its index");
        bytes.set(value, length);
        length += value.byteLength;
      }
    } finally {
      if (!complete) void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    if (length !== bytes.length || bytes[0] !== 31 || bytes[1] !== 139 ||
        new DataView(bytes.buffer).getUint32(bytes.length - 4, true) !== locator.decodedBytes) {
      throw Error("Invalid allotment transfer length");
    }
    const scratch = new Uint8Array(locator.decodedBytes + 1);
    try {
      const inflated = gunzipSync(bytes, { out: scratch });
      if (inflated.length !== locator.decodedBytes) throw Error("Invalid decoded allotment length");
      source = JSON.parse(new TextDecoder().decode(inflated)) as PacketSource;
    } finally {
      releaseScratchBuffer(scratch.buffer);
    }
    if (source?.schemaVersion !== 1 || !source.packets || Object.keys(source.packets).length !== locator.ids.length ||
        locator.ids.some(key => !Object.hasOwn(source!.packets, key))) throw Error("Incomplete allotment packet group");
    if (typeof WeakRef === "function") decodedFiles.set(locator, new WeakRef(source));
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  recentGroup = locator.decodedBytes <= MAX_RECENT_GROUP_BYTES ? { locator, source } : undefined;
  const families = source.packets[id];
  const plan = families?.[native ? "minecraft" : "drawn"];
  return plan && families.foundation ? { ...plan, foundation: families.foundation } : plan;
}

// Palettes use sRGB values here and are converted to the packed tile's linear colours.
export const ALLOTMENT_TOP_COLORS_V360 = [0xb19979, 0x987857, 0x79954e, 0x718c54] as const;
const FOUNDATION_COLOR = 0x829a6c;
const SIDE_COLORS = [0xb19979, 0x987857, 0x4d6938, 0x526a40, FOUNDATION_COLOR] as const;
const linear = (v: number) => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255);
const rgb = (hex: number) => [linear(hex >> 16), linear(hex >> 8 & 255), linear(hex & 255)];
const topColors = [...ALLOTMENT_TOP_COLORS_V360, FOUNDATION_COLOR].map(rgb);
const sideColors = SIDE_COLORS.map(rgb);
const cm = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 65535;

/** First point is local centimetres; subsequent pairs are signed deltas. */
export function decodeAllotmentRingV360(deltas: readonly number[]): Vector2[] {
  if (!Array.isArray(deltas) || deltas.length < 6 || deltas.length % 2 || deltas.length > 8192) {
    throw Error("Invalid allotment ring length");
  }
  const ring: Vector2[] = [];
  let x = 0, z = 0;
  for (let i = 0; i < deltas.length; i += 2) {
    x += deltas[i]; z += deltas[i + 1];
    if (!cm(x) || !cm(z)) throw Error("Allotment ring escapes its packet");
    ring.push(new Vector2(x, z));
  }
  return ring;
}

/** Four length-prefixed ZigZag columns encode cardinal rectangles at 50 cm. */
export function* unpackAllotmentNativeRunsV360(
  plan: AllotmentDetailPlanV360, exterior = false,
): Generator<NativeRun> {
  const limit = exterior ? MAX_EXTERIOR_RUNS : MAX_RUNS;
  if (plan.byStyle === undefined) {
    const runs = plan.runs;
    if (!Array.isArray(runs) || runs.length % 7 || runs.length > limit * 7) throw Error("Invalid allotment runs");
    for (let i = 0; i < runs.length; i += 7) yield runs.slice(i, i + 7) as NativeRun;
    return;
  }
  if (!Array.isArray(plan.byStyle) || plan.byStyle.length > limit) throw Error("Invalid allotment run groups");
  let count = 0;
  for (const [y, height, style, encodedColumns] of plan.byStyle) {
    // A signed step in a tile fits two varint bytes. Reject excess length before
    // allocating a string, then make every column prove the same row count.
    if (typeof encodedColumns !== "string" || encodedColumns.length > Math.ceil((8 + (limit - count) * 8) / 3) * 4) {
      throw Error("Allotment runs exceed their allocation");
    }
    const bytes = atob(encodedColumns);
    if (bytes.length < 12) throw Error("Incomplete allotment run columns");
    const offsets: number[] = [], ends: number[] = [];
    let last = 8;
    for (let col = 0; col < 4; col++) {
      offsets.push(last);
      const length = bytes.charCodeAt(col * 2) | (bytes.charCodeAt(col * 2 + 1) << 8);
      if (!length) throw Error("Empty allotment run column");
      last += length;
      ends.push(last);
    }
    if (last !== bytes.length) throw Error("Invalid allotment run column length");
    const readStep = (col: number) => {
      if (offsets[col] >= ends[col]) throw Error("Incomplete allotment run");
      const first = bytes.charCodeAt(offsets[col]++);
      let step = first;
      if (first >= 128) {
        if (offsets[col] >= ends[col]) throw Error("Incomplete allotment run step");
        const second = bytes.charCodeAt(offsets[col]++);
        if (second < 1 || second >= 128) throw Error("Invalid allotment run step");
        step = (first & 127) | (second << 7);
      }
      return step & 1 ? -(step + 1) / 2 : step / 2;
    };
    let x = 0, z = 0;
    while (offsets[0] < ends[0]) {
      if (++count > limit) throw Error("Allotment runs exceed their allocation");
      const dx = readStep(0), dz = readStep(1);
      x = dz === 0 ? x + dx : dx;
      z += dz;
      yield [x * 50, z * 50, (readStep(2) + 1) * 50, (readStep(3) + 1) * 50, y, height, style];
    }
    if (offsets.some((offset, col) => offset !== ends[col])) throw Error("Mismatched allotment run column lengths");
  }
}

const encodedBytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
function encoded(values: ArrayBufferView): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let result = "";
  for (let at = 0; at < bytes.length; at += 8192) result += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(result);
}

/** Check against the raw ground/obstacle predecessor, before older adapters. */
export function* admitAllotmentDetailsV360(
  chunk: SurroundingCityChunk, plan: AllotmentDetailPlanV360 | undefined,
): Generator<void, AllotmentDetailPlanV360 | undefined> {
  if (!plan || !Array.isArray(plan.origin) || plan.origin.length !== 3 ||
      plan.origin.some((n, i) => n !== chunk.origin[i]) || !Number.isSafeInteger(plan.guard)) return undefined;
  return (yield* allotmentNavigationGuardStepsV264(chunk.nav)) === plan.guard ? plan : undefined;
}

/** Pack the detail for the tile's existing GPU buffers and eviction lifetime. */
export function* packAllotmentDetailsV360(
  chunk: SurroundingCityChunk, plan: AllotmentDetailPlanV360 | undefined, native: boolean, exterior = false,
): Generator<void, SurroundingPackedMesh | undefined> {
  if (!plan || chunk.meshes.length >= 16 || chunk.meshes.some(part => part.kind === KIND)) return undefined;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const vertexLimit = exterior ? MAX_EXTERIOR_VERTICES : MAX_VERTICES;
  const indexLimit = exterior ? MAX_EXTERIOR_INDICES : MAX_INDICES;
  const vertex = (point: Vector2, y: number, color: number[]) => {
    if (positions.length / 3 >= vertexLimit) throw Error("Allotment geometry exceeds the tile allowance");
    const n = positions.length / 3;
    positions.push(point.x, y, point.y);
    colors.push(...color);
    return n;
  };
  const sideWalls = (ring: Vector2[], ground: number, top: number, style: number) => {
    if (ground === top) return;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const first = vertex(a, ground, sideColors[style]);
      vertex(a, top, topColors[style]);
      vertex(b, top, topColors[style]);
      vertex(b, ground, sideColors[style]);
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  };
  const validStyle = (y: number, height: number, style: number) => cm(y) && cm(height) && cm(y + height) &&
    Number.isSafeInteger(style) && style >= 0 && style < (exterior ? topColors.length : FOUNDATION_STYLE) &&
    (style < 2 || style === FOUNDATION_STYLE ? height === 0 : height > 0);
  try {
    if (native) {
      let runCount = 0;
      for (const [x, z, w, d, y, h, style] of unpackAllotmentNativeRunsV360(plan, exterior)) {
        if (!validStyle(y, h, style) || ![x, z, w, d, x + w, z + d].every(cm) || w === 0 || d === 0) return undefined;
        const ring = [new Vector2(x, z), new Vector2(x, z + d), new Vector2(x + w, z + d), new Vector2(x + w, z)];
        const first = vertex(ring[0], y + h, topColors[style]);
        for (const point of ring.slice(1)) vertex(point, y + h, topColors[style]);
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
        sideWalls(ring, y, y + h, style);
        if (++runCount % 64 === 0) yield;
      }
    } else {
      const sheets = plan.sheets;
      if (!Array.isArray(sheets) || sheets.length > 1024) return undefined;
      for (const [i, sheet] of sheets.entries()) {
        const [y, h, style, encodedRings] = sheet;
        if (!validStyle(y, h, style) || !Array.isArray(encodedRings) || !encodedRings.length || encodedRings.length > 64 ||
            encodedRings.reduce((n, ring) => n + ring.length, 0) > 8192) return undefined;
        const rings = encodedRings.map(decodeAllotmentRingV360);
        const faces = ShapeUtils.triangulateShape(rings[0], rings.slice(1));
        const vertices = rings.flat().map(point => vertex(point, y + h, topColors[style]));
        for (const [a, b, c] of faces) indices.push(vertices[c], vertices[b], vertices[a]);
        for (const ring of rings) sideWalls(ring, y, y + h, style);
        if (i % 16 === 15) yield;
      }
    }
  } catch { return undefined; }
  if (!indices.length || indices.length > indexLimit ||
      chunk.meshes.reduce((n, p) => n + encodedBytes(p.positions) / 6, positions.length / 3) > 400_000 ||
      chunk.meshes.reduce((n, p) => n + encodedBytes(p.indices) / 4, indices.length) > 2_400_000) return undefined;
  return {
    kind: KIND, positionType: "u16cm",
    positions: encoded(new Uint16Array(positions)), colors: encoded(new Uint8Array(colors)), indices: encoded(new Uint32Array(indices)),
  };
}

/** Synthesize a tile only from a compiled garden foundation and its fittings. */
export function* createAllotmentExteriorChunkV360(
  plan: AllotmentDetailPlanV360 | undefined, bounds: readonly number[], native: boolean,
): Generator<void, SurroundingCityChunk | undefined> {
  if (!plan || !Array.isArray(plan.origin) || plan.origin.length !== 3 || plan.origin[0] !== bounds[0] ||
      plan.origin[1] !== -10 || plan.origin[2] !== bounds[1] || plan.guard !== 0 ||
      !Array.isArray(plan.foundation) || plan.foundation.length < 1 || plan.foundation.length > 256) return undefined;
  const ground: SurroundingCityChunk["nav"]["ground"] = [];
  try {
    for (const ringDeltas of plan.foundation) {
      if (!Array.isArray(ringDeltas) || !ringDeltas.length || ringDeltas.length > 64 ||
          ringDeltas.reduce((n, ring) => n + ring.length, 0) > 8192) return undefined;
      const [ring, ...holes] = ringDeltas.map(deltas => decodeAllotmentRingV360(deltas).map(
        p => {
          if (p.x > OUTER_TILE_METRES * 100 || p.y > OUTER_TILE_METRES * 100) throw Error("Allotment boundary escapes its tile");
          return [p.x / 100, p.y / 100];
        },
      ));
      ground.push({ ring, holes });
      if (ground.length % 16 === 0) yield;
    }
  } catch { return undefined; }
  const chunk: SurroundingCityChunk = {
    schemaVersion: 1, origin: plan.origin, meshes: [],
    nav: { groundY: EXTERIOR_GROUND_Y, ground, buildings: [], water: [] },
  };
  const baseY = Math.round((EXTERIOR_GROUND_Y - plan.origin[1]) * 100);
  if (native && !plan.runs?.some((value, i) => i % 7 === 6 && value === FOUNDATION_STYLE) &&
      !plan.byStyle?.some(group => group[2] === FOUNDATION_STYLE)) return undefined;
  const detail = native ? plan : {
    ...plan,
    sheets: [...plan.foundation.map((rings): Sheet => [baseY, 0, FOUNDATION_STYLE, rings]), ...(plan.sheets ?? [])],
  };
  const mesh = yield* packAllotmentDetailsV360(chunk, detail, native, true);
  return mesh ? { ...chunk, meshes: [mesh] } : undefined;
}
