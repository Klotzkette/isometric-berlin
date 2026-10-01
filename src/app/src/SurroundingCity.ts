import { Box3, Frustum, Group, Matrix4, Vector3, type Camera, Material, Mesh, Line, Points } from "three";
import {
  createSurroundingCityChunk, surroundingBuildingSolidAt, surroundingPolygonContains, validSurroundingPolygon,
  type SurroundingCityChunk, type SurroundingChunkGeometry, type SurroundingNavigation, type SurroundingPolygon,
} from "./SurroundingCityGeometry";
import type { VisualMode } from "./visualMode";

export const SURROUNDING_CITY_SCAN_MS = 180;
export const SURROUNDING_CITY_RETIRE_MS = 1_800;
export const SURROUNDING_CITY_RESIDENT_BUDGET_BYTES = 24 * 1024 * 1024;
export const SURROUNDING_CITY_MAX_CHUNK_BYTES = 12 * 1024 * 1024;
export const SURROUNDING_CITY_MANIFEST_RETRY_MS = [500, 1_500] as const;

type Asset = { url: string; bytes: number; encoding?: "gzip"; decodedBytes?: number };
export type SurroundingChunkDescriptor = {
  id: string;
  bounds: [number, number, number, number];
  drawn: Asset;
  minecraft: Asset;
};
export type SurroundingCityManifest = {
  schemaVersion: 1;
  chunks: SurroundingChunkDescriptor[];
  /** World-metre source-clipped extension footprint; excludes the detailed core. */
  footprint: SurroundingPolygon[];
  groundY: number;
};
type Resident = SurroundingChunkGeometry & { descriptor: SurroundingChunkDescriptor; lastWanted: number };
export type SurroundingNavigationTile = {
  origin: readonly [number, number, number];
  bounds: readonly [number, number, number, number];
  nav: SurroundingNavigation;
};
export type SurroundingCityOptions = {
  manifestUrl: URL;
  camera: Camera;
  mode?: VisualMode;
  signal?: AbortSignal;
  /** Runs before first publication: register residency and apply current lighting. */
  onAttach?: (root: Group, mode: VisualMode) => void;
  /** Unregister residency and dispose geometry/materials; controller removes it first. */
  onRelease?: (root: Group) => void;
  onChange?: () => void;
  onError?: (message: string) => void;
  fetch?: typeof fetch;
  now?: () => number;
  retireMs?: number;
  residentBudgetBytes?: number;
};
export type SurroundingCity = {
  root: Group;
  ready: Promise<void>;
  refresh: (now?: number, focus?: { x: number; z: number }) => void;
  /** Changes native/drawn family only; caller applies its normal lighting pass. */
  setMode: (mode: VisualMode) => void;
  groundAt: (x: number, z: number) => number | null;
  solidAt: (x: number, y: number, z: number, radius?: number) => boolean;
  waterAt: (x: number, z: number) => boolean;
  dispose: () => void;
  readonly residentGeometryBytes: number;
  readonly residentBufferCount: number;
  readonly residentChunkCount: number;
  readonly pending: boolean;
  readonly manifest: SurroundingCityManifest | null;
  /** References to existing decoded navigation only; no extra scene fetch/copy. */
  readonly navigationTiles: readonly SurroundingNavigationTile[];
};

function assetValid(asset: Asset): boolean {
  return !!asset && typeof asset.url === "string" && asset.url.length < 256 &&
    !/^(?:[a-z]+:|\/|\\)|(?:^|\/)\.\.(?:\/|$)/i.test(asset.url) &&
    Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= SURROUNDING_CITY_MAX_CHUNK_BYTES &&
    (asset.encoding === undefined || (asset.encoding === "gzip" &&
      Number.isSafeInteger(asset.decodedBytes) && asset.decodedBytes! > 0 &&
      asset.decodedBytes! <= SURROUNDING_CITY_MAX_CHUNK_BYTES));
}

export function validateSurroundingManifest(value: unknown): SurroundingCityManifest {
  const manifest = value as SurroundingCityManifest;
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.chunks) ||
      manifest.chunks.length > 2_048 || !Array.isArray(manifest.footprint) ||
      !Number.isFinite(manifest.groundY) || manifest.footprint.length > 1_000 ||
      !manifest.footprint.every(validSurroundingPolygon)) throw new Error("Invalid surrounding-city manifest");
  const ids = new Set<string>();
  for (const chunk of manifest.chunks) {
    if (!chunk || typeof chunk.id !== "string" || ids.has(chunk.id) ||
        !Array.isArray(chunk.bounds) || chunk.bounds.length !== 4 ||
        !chunk.bounds.every(Number.isFinite) || chunk.bounds[0] >= chunk.bounds[2] ||
        chunk.bounds[1] >= chunk.bounds[3] ||
        !assetValid(chunk.drawn) || !assetValid(chunk.minecraft)) {
      throw new Error("Invalid surrounding-city tile descriptor");
    }
    ids.add(chunk.id);
  }
  return manifest;
}

async function fetchJsonBounded(
  fetcher: typeof fetch, url: URL, signal: AbortSignal, limit: number, asset?: Asset,
): Promise<unknown> {
  const response = await fetcher(url, { signal });
  if (!response.ok || !response.body) throw new Error(`Surrounding-city data HTTP ${response.status}`);
  let source: ReadableStream<Uint8Array> = response.body;
  const decodedLimit = asset?.encoding === "gzip" ? asset.decodedBytes! : limit;
  // Fetch already removes an HTTP Content-Encoding. Static hosts normally
  // serve .json.gz as an opaque file, but must not be decompressed twice.
  const transportDecoded = response.headers.get("content-encoding")?.toLowerCase()
    .split(",").some(value => value.trim() === "gzip");
  if (asset?.encoding === "gzip" && !transportDecoded) {
    let packedLength = 0;
    source = source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, stream) {
        packedLength += chunk.byteLength;
        if (packedLength > asset.bytes) throw new Error("Surrounding-city compressed response exceeds its declared size");
        stream.enqueue(chunk);
      },
      flush() {
        if (packedLength !== asset.bytes) throw new Error("Surrounding-city compressed response is incomplete");
      },
    }));
    if (typeof DecompressionStream !== "undefined") {
      source = source.pipeThrough(new DecompressionStream("gzip") as ReadableWritablePair<Uint8Array, Uint8Array>);
    } else {
      // Older WebKit gets the same bytes through Three's already bundled
      // inflater. Preallocate only the validated single-tile output size.
      const packed = new Uint8Array(asset.bytes);
      const packedReader = source.getReader();
      let offset = 0;
      try {
        while (true) {
          const next = await packedReader.read();
          if (next.done) break;
          packed.set(next.value, offset); offset += next.value.byteLength;
        }
      } finally { await packedReader.cancel().catch(() => undefined); packedReader.releaseLock(); }
      if (packed.byteLength < 18 || new DataView(packed.buffer).getUint32(packed.byteLength - 4, true) !== decodedLimit) {
        throw new Error("Surrounding-city gzip decoded size differs from its bounded manifest");
      }
      const { gunzipSync } = await import("three/examples/jsm/libs/fflate.module.js");
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const decoded = gunzipSync(packed, { out: new Uint8Array(decodedLimit) });
      if (decoded.byteLength !== decodedLimit) throw new Error("Surrounding-city gzip output is incomplete");
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)) as unknown;
    }
  }
  const reader = source.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0, text = "";
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > decodedLimit) throw new Error("Surrounding-city response exceeds its declared bounded size");
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    if (asset?.encoding === "gzip" && length !== decodedLimit) throw new Error("Surrounding-city decoded response is incomplete");
    return JSON.parse(text) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Default for unit/standalone use; the viewer supplies its residency-aware disposer. */
export function disposeSurroundingCityRoot(root: Group): void {
  const materials = new Set<Material>();
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    for (const value of Object.values(object.userData)) if (value instanceof Material) materials.add(value);
  });
  for (const material of materials) material.dispose();
  root.clear();
}

function distanceSquared(bounds: readonly number[], x: number, z: number): number {
  const dx = Math.max(bounds[0] - x, 0, x - bounds[2]);
  const dz = Math.max(bounds[1] - z, 0, z - bounds[3]);
  return dx * dx + dz * dz;
}

function retryDelay(milliseconds: number, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(false); return; }
    const aborted = (): void => { clearTimeout(timer); resolve(false); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(true); }, milliseconds);
    signal.addEventListener("abort", aborted, { once: true });
  });
}

/**
 * One compact outline family, one in-flight network/decode job, no visited-city
 * JSON cache. Visible tiles are never dropped to meet a quota: only offscreen
 * tiles expire, with an expanded frustum and short reversal grace. The small
 * coarse source has no fine LoD work and remains eligible at any zoom distance.
 */
export function createSurroundingCity(options: SurroundingCityOptions): SurroundingCity {
  const root = new Group();
  root.name = "Mapped surrounding Berlin outline districts";
  root.userData.surroundingCity = true;
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? (() => performance.now());
  const retireMs = options.retireMs ?? SURROUNDING_CITY_RETIRE_MS;
  const budget = options.residentBudgetBytes ?? SURROUNDING_CITY_RESIDENT_BUDGET_BYTES;
  const release = options.onRelease ?? disposeSurroundingCityRoot;
  const controller = new AbortController();
  const residents = new Map<string, Resident>();
  const failedAt = new Map<string, number>();
  const desired = new Set<string>();
  const projection = new Matrix4(), matrix = new Matrix4(), frustum = new Frustum();
  const box = new Box3(), cameraPosition = new Vector3();
  let manifest: SurroundingCityManifest | null = null;
  let mode: VisualMode = options.mode ?? "day";
  let disposed = false, processing = false, revision = 0;
  let active: { id: string; controller: AbortController } | null = null;
  let queue: SurroundingChunkDescriptor[] = [];
  let geometryBytes = 0, bufferCount = 0, lastScan = -Infinity;
  let focus: { x: number; z: number } | undefined;
  let navigationTiles: SurroundingNavigationTile[] = [];
  const activeView = (): boolean => root.visible &&
    (typeof document === "undefined" || document.visibilityState !== "hidden");
  const updateNavigation = (): void => {
    navigationTiles = Array.from(residents.values(), entry => ({
      origin: entry.origin, bounds: entry.descriptor.bounds, nav: entry.nav,
    }));
  };

  const evict = (id: string): void => {
    const entry = residents.get(id);
    if (!entry) return;
    residents.delete(id);
    root.remove(entry.root);
    geometryBytes -= entry.geometryBytes;
    bufferCount -= entry.bufferCount;
    release(entry.root);
    updateNavigation();
  };
  const report = (error: unknown): void => {
    options.onError?.(error instanceof Error ? error.message : String(error));
  };
  const pump = async (): Promise<void> => {
    if (disposed || processing || !manifest || !activeView()) return;
    processing = true;
    try {
      while (!disposed && activeView() && queue.length) {
        const descriptor = queue.shift()!;
        if (residents.has(descriptor.id) || !desired.has(descriptor.id)) continue;
        if (now() - (failedAt.get(descriptor.id) ?? -Infinity) < 30_000) continue;
        const familyRevision = revision;
        const minecraft = mode === "minecraft";
        const asset = minecraft ? descriptor.minecraft : descriptor.drawn;
        const task = new AbortController();
        active = { id: descriptor.id, controller: task };
        let unpublished: Group | null = null;
        try {
          const data = await fetchJsonBounded(fetcher, new URL(asset.url, options.manifestUrl), task.signal, asset.bytes + 64, asset);
          if (disposed || !activeView() || task.signal.aborted || familyRevision !== revision || !desired.has(descriptor.id)) continue;
          const entry = createSurroundingCityChunk(data as SurroundingCityChunk, descriptor.id, minecraft);
          unpublished = entry.root;
          // onAttach can synchronously dispose this controller during error recovery.
          if (disposed || familyRevision !== revision) { release(entry.root); unpublished = null; continue; }
          options.onAttach?.(entry.root, mode);
          if (disposed || familyRevision !== revision) { release(entry.root); unpublished = null; continue; }
          residents.set(descriptor.id, { ...entry, descriptor, lastWanted: now() });
          geometryBytes += entry.geometryBytes;
          bufferCount += entry.bufferCount;
          root.add(entry.root);
          unpublished = null;
          updateNavigation();
          failedAt.delete(descriptor.id);
          options.onChange?.();
          // A single bounded decode/publication per task keeps input paintable.
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        } catch (error) {
          if (unpublished) release(unpublished);
          if (!disposed && !task.signal.aborted && familyRevision === revision) {
            failedAt.set(descriptor.id, now());
            report(error);
          }
        } finally {
          if (active?.controller === task) active = null;
        }
      }
    } finally { processing = false; }
  };

  const refresh = (timestamp = now(), nextFocus?: { x: number; z: number }): void => {
    if (nextFocus) focus = nextFocus;
    if (disposed || !manifest || timestamp - lastScan < SURROUNDING_CITY_SCAN_MS) return;
    if (!activeView()) { active?.controller.abort(); queue = []; lastScan = -Infinity; return; }
    lastScan = timestamp;
    options.camera.updateMatrixWorld();
    options.camera.getWorldPosition(cameraPosition);
    projection.copy(options.camera.projectionMatrix);
    projection.elements[0] /= 1.18;
    projection.elements[5] /= 1.18;
    matrix.multiplyMatrices(projection, options.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    desired.clear();
    queue = [];
    for (const descriptor of manifest.chunks) {
      const b = descriptor.bounds;
      // The source extractor accepts building heights through 400 m. The
      // selection box must include their complete tops as well as ground.
      box.min.set(b[0], -12, b[1]); box.max.set(b[2], 410, b[3]);
      const near = distanceSquared(b, cameraPosition.x, cameraPosition.z) < 180 ** 2;
      if (!near && !frustum.intersectsBox(box)) continue;
      desired.add(descriptor.id);
      const entry = residents.get(descriptor.id);
      if (entry) entry.lastWanted = timestamp;
      else queue.push(descriptor);
    }
    const from = focus ?? cameraPosition;
    queue.sort((a, b) => distanceSquared(a.bounds, from.x, from.z) - distanceSquared(b.bounds, from.x, from.z));
    if (active && !desired.has(active.id)) active.controller.abort();
    let changed = false;
    for (const [id, entry] of residents) {
      if (!desired.has(id) && (timestamp - entry.lastWanted >= retireMs || geometryBytes > budget)) {
        evict(id); changed = true;
      }
    }
    if (changed) options.onChange?.();
    void pump();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    active?.controller.abort();
    queue = [];
    desired.clear(); failedAt.clear();
    for (const id of residents.keys()) evict(id);
    manifest = null;
    options.signal?.removeEventListener("abort", dispose);
  };
  options.signal?.addEventListener("abort", dispose, { once: true });
  if (options.signal?.aborted) dispose();
  const loadManifest = async (): Promise<void> => {
    for (let attempt = 0; attempt <= SURROUNDING_CITY_MANIFEST_RETRY_MS.length; attempt++) {
      try {
        const value = await fetchJsonBounded(fetcher, options.manifestUrl, controller.signal, 2 * 1024 * 1024);
        if (!disposed) { manifest = validateSurroundingManifest(value); refresh(); }
        return;
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        if (attempt === SURROUNDING_CITY_MANIFEST_RETRY_MS.length) { report(error); return; }
        if (!await retryDelay(SURROUNDING_CITY_MANIFEST_RETRY_MS[attempt], controller.signal)) return;
      }
    }
  };
  const ready = disposed ? Promise.resolve() : loadManifest();

  const at = (x: number, z: number): Resident | undefined => {
    for (const entry of residents.values()) {
      const b = entry.descriptor.bounds;
      if (x >= b[0] && z >= b[1] && x < b[2] && z < b[3]) return entry;
    }
    return undefined;
  };
  return {
    root, ready, refresh, dispose,
    setMode(nextMode) {
      if (disposed || nextMode === mode) return;
      const changedFamily = (nextMode === "minecraft") !== (mode === "minecraft");
      mode = nextMode;
      if (!changedFamily) return;
      revision++;
      active?.controller.abort();
      for (const id of residents.keys()) evict(id);
      failedAt.clear();
      lastScan = -Infinity;
      refresh();
      options.onChange?.();
    },
    groundAt(x, z) {
      if (!manifest || !manifest.footprint.some(p => surroundingPolygonContains(p, x, z))) return null;
      const entry = at(x, z);
      if (!entry) return manifest.groundY;
      const lx = x - entry.origin[0], lz = z - entry.origin[2];
      if (!entry.nav.ground.some(p => surroundingPolygonContains(p, lx, lz))) return null;
      const road = entry.nav.roads?.some(p => surroundingPolygonContains(p, lx, lz));
      return entry.nav.groundY + (road ? 0.09 : 0);
    },
    solidAt(x, y, z, radius = 0) {
      for (const entry of residents.values()) {
        const b = entry.descriptor.bounds;
        if (x + radius < b[0] || z + radius < b[1] || x - radius > b[2] || z - radius > b[3]) continue;
        if (surroundingBuildingSolidAt(entry.nav, x - entry.origin[0], y, z - entry.origin[2], radius)) return true;
      }
      return false;
    },
    waterAt(x, z) {
      const entry = at(x, z);
      if (!entry) return false;
      const lx = x - entry.origin[0], lz = z - entry.origin[2];
      return !entry.nav.bridges?.some(p => surroundingPolygonContains(p, lx, lz)) &&
        entry.nav.water.some(p => surroundingPolygonContains(p, lx, lz));
    },
    get residentGeometryBytes() { return geometryBytes; },
    get residentBufferCount() { return bufferCount; },
    get residentChunkCount() { return residents.size; },
    get pending() { return processing || queue.length > 0; },
    get manifest() { return manifest; },
    get navigationTiles() { return navigationTiles; },
  };
}
