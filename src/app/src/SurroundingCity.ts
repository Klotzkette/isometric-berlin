import { gardenTerrainGroundAtV330 } from "./GardenTerrainV330";
import {hasUbahnGroundApproachSourceV326,ubahnGroundApproachAtV326} from "./UbahnGroundApproachesV326";
import {attachPacketUbahnAccessV326Steps,ubahnCandidatesV326,ubahnGroundMaskBytesV326,type UbahnGroundRuntimeV326} from "./UbahnGroundRuntimeV326";
import {createPublicMonumentsPacketV326Steps,type PublicMonumentsPacketV326} from "./PublicMonumentsPacketV326";
import {northEastPublicSiteGroundAtV326,northEastPublicSiteWaterAtV326,northEastPublicSiteSolidAtV326} from "./NorthEastPublicSitesV326";
import { disposeSurroundingCityRoot } from "./disposeSurroundingCityRootV323";
import { westKiezPacketCandidateV302 } from "./NeighbourhoodFidelityV300";
import { fetchSurroundingTransport, SURROUNDING_TRANSPORT_IDLE_MS } from "./surroundingTransport";
import { restoreSurroundingPacketDelta } from "./SurroundingPacketDelta";
import { prepareTierparkV276 } from "./TierparkV276";
import { createZooAnimalsV282, type ZooAnimalHandleV282 } from './ZooAnimalsV282';
import { transferTierparkAnimalsV282 } from './tierparkAnimalTransferV282';
import { createTierparkHouseV282 } from './ZooHousesV282';
import { mierendorffFloorAtV269 } from "./MierendorffV269";
import { namedElevatedFloorAtV334 } from "./namedSiteReplacementsV238";
import { Box3, Frustum, Group, InstancedMesh, Matrix4, Vector3, type BufferGeometry, type Camera, Mesh } from "three";
import {
  createSurroundingCityChunkCooperatively, groundOverlayKindsV329, surroundingBuildingSolidAt, surroundingPolygonContains, validSurroundingPolygon,
  type SurroundingCityChunk, type SurroundingChunkGeometry, type SurroundingNavigation, type SurroundingPolygon,
  type SurroundingChunkSchedule, type SurroundingOwnershipOptions,
} from "./SurroundingCityGeometry";
import type { VisualMode } from "./visualMode";
import { freezeStaticSceneTransform } from "./staticSceneTransforms";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { spreeBridgeFloorAtV242, spreeBridgeSolidAtV242 } from "./SpreeBridgesV242";
import { prepareTierparkV255 } from "./TierparkV255";
import { annotatePlaygroundPacketV255 } from "./playgroundsV255";
import { littenStadthausPacketCandidateV297 } from "./LittenStadthausV297Packets";
import { wallGalleryHillContainsV298 } from "./wallGalleryV298Profile";
import southFidelityReceiptsV294 from "./data/southFidelityV294Packets.json";
const SOUTH_RECEIPT_TILES_V294:ReadonlySet<string> = new Set(southFidelityReceiptsV294.keys);
const MAUERPARK_TILES_V298:ReadonlySet<string>=new Set(["3_-6","3_-5","4_-6","4_-5"]);
const mauerparkTileV298=(id:string)=>MAUERPARK_TILES_V298.has(id);
const ELEVATED_TILES_V334: ReadonlySet<string> = new Set(["5_-7", "6_-7", "9_4", "-2_4"]);
const KATZENGRABEN_TILES_V334: ReadonlySet<string> = new Set(["outer187-27_15", "outer187-27_16"]);

export const SURROUNDING_CITY_SCAN_MS = 180;
export const SURROUNDING_CITY_RETIRE_MS = 1_800;
export const SURROUNDING_CITY_RESIDENT_BUDGET_BYTES = 24 * 1024 * 1024;
export const SURROUNDING_CITY_MAX_CHUNK_BYTES = 12 * 1024 * 1024;
// Published210 plus the 18 exact Gärten der Welt and Kienberg descriptors.
// Only static metadata grows; resident geometry/transfer/prefetch stay fixed.
export const SURROUNDING_CITY_MAX_DESCRIPTORS = 2_861;
export const SURROUNDING_CITY_MAX_FOOTPRINTS = 2_890;
export const SURROUNDING_CITY_MAX_MANIFEST_BYTES = 3816 * 1024;
// Hosted delta packets add one bounded length to each changed descriptor.
const SURROUNDING_CITY_MAX_HOSTED_MANIFEST_BYTES = SURROUNDING_CITY_MAX_MANIFEST_BYTES + 64 * 1024;
export const SURROUNDING_CITY_MANIFEST_RETRY_MS = [500, 1_500] as const;
// At most two upcoming packets overlap the one foreground fetch/decode. Reserve
// the decoded size too: HTTP Content-Encoding may already inflate a response.
export const SURROUNDING_CITY_PREFETCH_BYTES = 4 * 1024 * 1024;
export const SURROUNDING_CITY_PREFETCH_COUNT = 2;

type Asset = { url: string; bytes: number; encoding?: "gzip"; decodedBytes?: number; deltaDecodedBytes?: number; sha256?: string };
export type SurroundingChunkDescriptor = {
  id: string;
  /** Lossless geometry-only transfer split; navigation belongs to this primary. */
  detailCompanionOf?: string;
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
  gardenFootprintStartV330?: number;
  packetMirrorCommit?: string;
};
type Resident = SurroundingChunkGeometry & { descriptor: SurroundingChunkDescriptor; lastWanted: number; southOwnersReadyV294: boolean; littenReadyV297:boolean; wallReadyV298:boolean;westReadyV302:boolean;neukoellnReadyV305:boolean;northCandidateV309:boolean;northReadyV309:boolean;treptowCandidateV317:boolean;treptowReadyV317:boolean;governmentCandidateV321:boolean;governmentReadyV321:boolean;universitiesCandidateV322:boolean;universitiesReadyV322:boolean;wilhelmCandidateV324:boolean;wilhelmReadyV324:boolean;wilhelmStreetCandidateV325:boolean;wilhelmStreetReadyV325:boolean;southwestCandidateV326:boolean;southwestReadyV326:boolean };
export type SurroundingNavigationTile = {
  origin: readonly [number, number, number];
  bounds: readonly [number, number, number, number];
  nav: SurroundingNavigation;
};
export type SurroundingCityOptions = {
  /** Enable only after required Schlossplatz bodies belong to the active city. */
  schlossplatzV239?: boolean;
  staatsoperV240?: boolean;
  architectureV241?: boolean;
  mitteEnsembleV281?: boolean;
  prenzlbergV264?: boolean;
  chariteBridgesV265?: boolean;
  operaTheatresV274?: boolean;
  northernSitesV266?: boolean;
  golgathaV270?: boolean;
  tachelesFrontsV270?: boolean;
  /** Defaults closed. Verify complete v294 owners of the requested family remain attached. */
  southFidelityV294?: (native: boolean) => boolean;
  littenStadthausV297?: (native:boolean)=>boolean;
  wallGalleryV298?: (native:boolean)=>boolean;
  stralauSisyphosV299?:boolean;
  neighbourhoodV300?:boolean;
  clusterFacadesV320?:SurroundingOwnershipOptions["clusterFacadesV320"];
  berlinSenateV321?:SurroundingOwnershipOptions["berlinSenateV321"];
  governmentOfficesV321?:(native:boolean)=>boolean;
  universitiesV322?:(native:boolean)=>boolean;
  wilhelmHousingV324?:(native:boolean)=>boolean;
  southWestSitesV326?:(native:boolean)=>boolean;
  wilhelmStreetFrontsV325?:(native:boolean)=>boolean;
  publicOfficesAdmissionV322?:(native:boolean)=>{government:boolean;universities:boolean};
  sourceQuartersV303?:boolean;
  sourceQuarterSourcesV303?:SurroundingOwnershipOptions["sourceQuarterSourcesV303"];
  /** Exact lazy recipes may load in parallel with the same tile's transport.
   * The complete result is required before geometry construction/admission. */
  loadSourceQuarterSourcesV309?:(id:string,native:boolean)=>Promise<NonNullable<SurroundingOwnershipOptions["sourceQuarterSourcesV303"]>>;
  neukoellnLandmarksV305?:(native:boolean)=>boolean;
  northFidelityV309?:(native:boolean)=>boolean;
  treptowWaterfrontV317?:(native:boolean)=>boolean;
  onQuarterResidentsV303?:(keys:ReadonlySet<string>)=>void;
  westKiezV302?: (native:boolean)=>boolean;
  manifestUrl: URL;
  camera: Camera;
  mode?: VisualMode;
  signal?: AbortSignal;
  /** Pause requests during a renderer reset, retaining all resident packets. */
  isActive?: () => boolean;
  /** Runs before first publication: register residency and apply current lighting. */
  onAttach?: (root: Group, mode: VisualMode) => void;
  /** Unregister residency and dispose geometry/materials; controller removes it first. */
  onRelease?: (root: Group) => void;
  /** Unregister attached children before their private owners detach them. */
  onBeforeRelease?:(root:Group)=>void;
  /** Optional V326 actual public-site adapters; original callers stay exact. */
  publicSitesV326?:boolean;
  transportDetailsV334?: boolean;
  onChange?: () => void;
  onError?: (message: string) => void;
  fetch?: typeof fetch;
  now?: () => number;
  retireMs?: number;
  /** Network inactivity only; injectable for deterministic liveness tests. */
  transportIdleMs?: number;
  residentBudgetBytes?: number;
};
export type SurroundingCity = {
  root: Group;
  ready: Promise<void>;
  refresh: (now?: number, focus?: { x: number; z: number }) => void;
  /** Changes native/drawn family only; caller applies its normal lighting pass. */
  setMode: (mode: VisualMode) => void;
  interiorGroundAt:(x:number,z:number,currentY?:number)=>number|null;
  groundAt: (x: number, z: number) => number | null;
  hasResidentSurfaceAt: (x: number, z: number) => boolean;
  hasResidentChunk: (id: string, sha256: string) => boolean;
  gardenGroundAtV330: (x: number, z: number) => number | null;
  solidAt: (x: number, y: number, z: number, radius?: number) => boolean;
  waterAt: (x: number, z: number) => boolean;
  dispose: () => void;
  readonly residentGeometryBytes: number;
  readonly residentMaskBytesV326:number;
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
    (asset.sha256 === undefined || /^[0-9a-f]{64}$/.test(asset.sha256)) &&
    (asset.encoding === undefined || (asset.encoding === "gzip" &&
      Number.isSafeInteger(asset.decodedBytes) && asset.decodedBytes! > 0 &&
      asset.decodedBytes! <= SURROUNDING_CITY_MAX_CHUNK_BYTES)) &&
    (asset.deltaDecodedBytes === undefined || (asset.encoding === "gzip" && !!asset.sha256 &&
      Number.isSafeInteger(asset.deltaDecodedBytes) && asset.deltaDecodedBytes > asset.decodedBytes! &&
      asset.deltaDecodedBytes <= SURROUNDING_CITY_MAX_CHUNK_BYTES));
}

export function validateSurroundingManifest(value: unknown): SurroundingCityManifest {
  const manifest = value as SurroundingCityManifest;
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.chunks) ||
      manifest.chunks.length > SURROUNDING_CITY_MAX_DESCRIPTORS || !Array.isArray(manifest.footprint) ||
      !Number.isFinite(manifest.groundY) || manifest.footprint.length > SURROUNDING_CITY_MAX_FOOTPRINTS ||
      (manifest.packetMirrorCommit !== undefined &&
        (typeof manifest.packetMirrorCommit !== "string" || !/^[0-9a-f]{40}$/.test(manifest.packetMirrorCommit))) ||
      (manifest.gardenFootprintStartV330 !== undefined && (
        !Number.isSafeInteger(manifest.gardenFootprintStartV330) || manifest.gardenFootprintStartV330 < 1 ||
        manifest.gardenFootprintStartV330 >= manifest.footprint.length)) ||
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
  for (const chunk of manifest.chunks) {
    if (chunk.detailCompanionOf === undefined) continue;
    const primary = manifest.chunks.find(p => p.id === chunk.detailCompanionOf);
    if (!primary || primary === chunk || primary.detailCompanionOf !== undefined ||
        !primary.bounds.every((value, index) => value === chunk.bounds[index])) {
      throw new Error("Invalid surrounding-city detail companion");
    }
  }
  return manifest;
}

async function fetchJsonBounded(
  fetcher: typeof fetch, url: URL, signal: AbortSignal, limit: number, asset?: Asset,
  idleMs = SURROUNDING_TRANSPORT_IDLE_MS,
): Promise<unknown> {
  // Manifests are mutable; content fingerprints isolate updated terrain packets
  // from an older immutable browser cache without discarding reusable city data.
  const response = await fetchSurroundingTransport(fetcher, url, signal,
    asset ? {} : { cache: "no-cache" }, idleMs);
  return readJsonBounded(response.body, response.headers, signal, limit, asset);
}

async function readJsonBounded(
  input: ReadableStream<Uint8Array>, headers: Headers, signal: AbortSignal, limit: number, asset?: Asset,
): Promise<unknown> {
  let source = input;
  const decodedLimit = asset?.encoding === "gzip" ? asset.decodedBytes! : limit;
  const parsePacket = (text: string): unknown | Promise<unknown> => {
    const packet: unknown = JSON.parse(text);
    return asset?.deltaDecodedBytes === undefined ? packet
      : restoreSurroundingPacketDelta(packet, asset.deltaDecodedBytes - decodedLimit, signal);
  };
  // Fetch already removes an HTTP Content-Encoding. Static hosts normally
  // serve .json.gz as an opaque file, but must not be decompressed twice.
  const transportDecoded = headers.get("content-encoding")?.toLowerCase()
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
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
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
      return parsePacket(new TextDecoder("utf-8", { fatal: true }).decode(decoded));
    }
  }
  const reader = source.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0, text = "";
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > decodedLimit) throw new Error("Surrounding-city response exceeds its declared bounded size");
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (asset?.encoding === "gzip" && length !== decodedLimit) throw new Error("Surrounding-city decoded response is incomplete");
    return parsePacket(text);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

type BufferedPacket = { bytes: Uint8Array; headers: Headers };
type PrefetchResult = { packet: BufferedPacket; error?: never } | { packet?: never; error: unknown };
type Prefetch = { controller: AbortController; reservedBytes: number; result: Promise<PrefetchResult> | null };
/** Pages may mirror distant gzip packets at the exact published source revision.
 * The manifest, core, nearby packets and offline package keep their local URLs. */
export function surroundingPacketUrl(
  descriptor: SurroundingChunkDescriptor, native: boolean, manifestUrl: URL, mirrorCommit?: string,
): URL {
  const asset = native ? descriptor.minecraft : descriptor.drawn;
  const [x0, z0, x1, z1] = descriptor.bounds;
  const useMirror = mirrorCommit && /^[0-9a-f]{40}$/.test(mirrorCommit) && asset.encoding === "gzip" &&
    asset.sha256 && Math.hypot((x0 + x1) / 2, (z0 + z1) / 2) >= 10_000 &&
    /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*\.json\.gz$/i.test(asset.url) &&
    !asset.url.split("/").some(part => part === "." || part === "..");
  const base = useMirror
    ? `https://raw.githubusercontent.com/Klotzkette/isometric-berlin/${mirrorCommit}/src/app/public/mesh/surrounding-berlin-v159/`
    : manifestUrl;
  const url = new URL(asset.url, base);
  if (asset.sha256) url.searchParams.set("v", asset.sha256);
  return url;
}
const prefetchReservation = (asset: Asset): number => Math.max(asset.bytes + 64,
  asset.encoding === "gzip" ? asset.deltaDecodedBytes ?? asset.decodedBytes! : 0);

/** Retain only bounded transport bytes. JSON and geometry are still decoded
 * one at a time, and no visited-city cache survives publication/eviction. */
async function bufferPacket(fetcher: typeof fetch, url: URL, signal: AbortSignal, asset: Asset,
  idleMs = SURROUNDING_TRANSPORT_IDLE_MS): Promise<BufferedPacket> {
  const response = await fetchSurroundingTransport(fetcher, url, signal, {}, idleMs);
  const transportDecoded = response.headers.get("content-encoding")?.toLowerCase()
    .split(",").some(value => value.trim() === "gzip");
  const limit = asset.encoding === "gzip"
    ? transportDecoded ? asset.decodedBytes! : asset.bytes : asset.bytes + 64;
  const bytes = new Uint8Array(limit);
  const reader = response.body.getReader();
  let length = 0;
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const next = await reader.read();
      if (next.done) break;
      if (length + next.value.byteLength > limit) throw new Error("Surrounding-city response exceeds its declared bounded size");
      bytes.set(next.value, length); length += next.value.byteLength;
    }
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (asset.encoding === "gzip" && length !== limit) throw new Error("Surrounding-city compressed response is incomplete");
    return { bytes: bytes.subarray(0, length), headers: response.headers };
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

async function consumePrefetch(job: Prefetch, signal: AbortSignal, asset: Asset): Promise<unknown> {
  const result = await job.result!;
  job.result = null;
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (!result.packet) throw result.error;
  const { bytes, headers } = result.packet;
  // A stream view avoids Response(arrayBuffer)'s extra copy. The existing
  // decompression/validation path consumes these exact source bytes.
  const source = new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(bytes); stream.close(); } });
  return readJsonBounded(source, headers, signal, asset.bytes + 64, asset);
}

function awaitPacketAndRecipesV309(
  loading: Promise<unknown>,
  recipes: Promise<SurroundingOwnershipOptions["sourceQuarterSourcesV303"]>,
  signal: AbortSignal,
): Promise<[unknown, SurroundingOwnershipOptions["sourceQuarterSourcesV303"]]> {
  let acceptPacket!: (value: unknown) => void;
  let acceptSources!: (value: SurroundingOwnershipOptions["sourceQuarterSourcesV303"]) => void;
  let fail!: (error: unknown) => void;
  const result = new Promise<[unknown, SurroundingOwnershipOptions["sourceQuarterSourcesV303"]]>((resolve, reject) => {
    let packet: unknown;
    let sources: SurroundingOwnershipOptions["sourceQuarterSourcesV303"];
    let remaining = 2;
    const clear = (): void => {
      remaining = 0;
      packet = undefined;
      sources = undefined;
      signal.removeEventListener("abort", onAbort);
    };
    fail = (error: unknown): void => {
      if (!remaining) return;
      clear();
      reject(error);
    };
    const onAbort = (): void => fail(new DOMException("Aborted", "AbortError"));
    const ready = (): void => {
      if (--remaining) return;
      const result: [unknown, SurroundingOwnershipOptions["sourceQuarterSourcesV303"]] = [packet, sources];
      clear();
      resolve(result);
    };
    // A canceled view releases its parsed tile immediately, even while the
    // module import continues. Both inputs still observe late rejections.
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    acceptPacket = value => {
      if (!remaining) return;
      packet = value;
      ready();
    };
    acceptSources = value => {
      if (!remaining) return;
      sources = value;
      ready();
    };
  });
  // Keep input promises outside the completion closures. A fulfilled promise
  // can itself own the parsed value after the explicit packet slot is cleared.
  void loading.then(acceptPacket, fail);
  void recipes.then(acceptSources, fail);
  return result;
}

/** Default for unit/standalone use; the viewer supplies its residency-aware disposer. */
export { disposeSurroundingCityRoot };

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
 * One compact outline family, one decode with bounded transport prefetch, no visited-city
 * JSON cache. Visible tiles are never dropped to meet a quota: only offscreen
 * tiles expire, with an expanded frustum and short reversal grace. The small
 * coarse source has no fine LoD work and remains eligible at any zoom distance.
 */
/** Stream-only additions keep the shared resident-core decoder unchanged.
 * Preparation allocates no render objects; normal cooperative decoding owns
 * cancellation/disposal, and metadata is applied before publication. */
export async function createStreamedSurroundingCityChunkV255(
  chunk: SurroundingCityChunk, id: string, minecraft = false,
  schedule: SurroundingChunkSchedule = {},
  ownership: SurroundingOwnershipOptions = {},
): Promise<SurroundingChunkGeometry> {
  const checkAbort = (): void => {
    if (schedule.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  };
  for (const prepare of [prepareTierparkV255, prepareTierparkV276]) {
  const iterator = prepare(chunk, id, minecraft);
  try {
    while (true) {
      checkAbort();
      const next = iterator.next();
      if (next.done) { chunk = next.value; break; }
      // The finite source preparation yields before changing the packet.
      // Respect the same injected scheduler used by the existing decoder.
      if (schedule.yield) await schedule.yield();
      else {
        const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
        if (scheduler?.yield) await scheduler.yield();
        else await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
  } finally { iterator.return(undefined as never); }
  }
  checkAbort();
  const animals = transferTierparkAnimalsV282(chunk, id, minecraft);
  chunk = animals.chunk;
  if (ownership.transportDetailsV334) {
    const load = ELEVATED_TILES_V334.has(id) ? import("./data/namedElevatedStationsV334.json")
      : KATZENGRABEN_TILES_V334.has(id) ? import("./data/katzengrabenV334.json") : null;
    if (load) {
      const data = await load.catch(() => null);
      checkAbort();
      if (data) ownership = { ...ownership, namedTransportSourceV334: data.default as NonNullable<SurroundingOwnershipOptions["namedTransportSourceV334"]> };
    }
  }
  const entry = await createSurroundingCityChunkCooperatively(chunk, id, minecraft, schedule, ownership);
  try {
    checkAbort();
    // Figure construction is bounded by this tile and retained owners. Attach
    // before publication so ordinary cancellation/disposal owns every buffer.
    const figures = createZooAnimalsV282('tierpark', minecraft, animals.animals, id);
    const handle = figures.userData.zooAnimalsV282 as ZooAnimalHandleV282 | undefined;
    if (handle) {
      figures.position.set(-chunk.origin[0], -chunk.origin[1], -chunk.origin[2]);
      entry.root.add(figures);
      entry.geometryBytes += handle.geometryBytes;
      entry.bufferCount += handle.bufferCount;
    }
    const house = createTierparkHouseV282(id, minecraft, chunk);
    if (house) {
      house.position.set(-chunk.origin[0], -chunk.origin[1], -chunk.origin[2]);
      house.updateMatrix();
      entry.root.add(house);
      // The collision callback is published atomically with this packet's
      // guarded roof. Eviction/abort/family switches remove both together.
      if (house.userData.brehmTropicalHallSolidAt)
        entry.root.userData.brehmTropicalHallSolidAt = house.userData.brehmTropicalHallSolidAt;
      house.traverse(object => {
        if (!(object instanceof Mesh)) return;
        const geometry: BufferGeometry = object.geometry;
        const arrays = Object.values(geometry.attributes).map(attribute => attribute.array);
        if (object.geometry.index) arrays.push(object.geometry.index.array);
        if (object instanceof InstancedMesh) {
          arrays.push(object.instanceMatrix.array);
          if (object.instanceColor) arrays.push(object.instanceColor.array);
        }
        for (const array of arrays) { entry.geometryBytes += array.byteLength; entry.bufferCount++; }
      });
    }
    checkAbort();
    annotatePlaygroundPacketV255(entry.root, id);
    return entry;
  } catch (error) {
    disposeSurroundingCityRoot(entry.root);
    throw error;
  }
}

export function createSurroundingCity(options: SurroundingCityOptions): SurroundingCity {
  const root = new Group();
  root.name = "Mapped surrounding Berlin outline districts";
  root.userData.surroundingCity = true;
  // This container never moves. Re-composing its identity each render would
  // force matrixWorld multiplication across every frozen resident district.
  freezeStaticSceneTransform(root);
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? (() => performance.now());
  const retireMs = options.retireMs ?? SURROUNDING_CITY_RETIRE_MS;
  const transportIdleMs = options.transportIdleMs ?? SURROUNDING_TRANSPORT_IDLE_MS;
  const budget = options.residentBudgetBytes ?? SURROUNDING_CITY_RESIDENT_BUDGET_BYTES;
  const publicAccessV326=new WeakMap<Group,UbahnGroundRuntimeV326>(),monumentsV326=new WeakMap<Group,PublicMonumentsPacketV326>();
  const baseRelease=options.onRelease??disposeSurroundingCityRoot;
  const release=(group:Group)=>{options.onBeforeRelease?.(group);baseRelease(group);publicAccessV326.get(group)?.dispose();publicAccessV326.delete(group);monumentsV326.get(group)?.dispose();monumentsV326.delete(group);};
  const finishV326=async<T>(steps:Generator<void,T>,signal:AbortSignal):Promise<T>=>{try{for(;;){if(signal.aborted)throw new DOMException("Aborted","AbortError");const next=steps.next();if(next.done)return next.value;await new Promise<void>(resolve=>setTimeout(resolve,0));}}finally{steps.return(undefined as never);}};
  const controller = new AbortController();
  const residents = new Map<string, Resident>();
  const failedAt = new Map<string, number>();
  const desired = new Set<string>();
  let previousDesired: Set<string> | null = null;
  let hasScanned = false;
  const prefetches = new Map<string, Prefetch>();
  let prefetchedBytes = 0;
  const projection = new Matrix4(), matrix = new Matrix4(), frustum = new Frustum();
  const box = new Box3(), cameraPosition = new Vector3();
  let manifest: SurroundingCityManifest | null = null;
  let mode: VisualMode = options.mode ?? "day";
  let southAdmissionV294 = options.southFidelityV294?.(mode === "minecraft") === true;
  let littenAdmissionV297=options.littenStadthausV297?.(mode==="minecraft")===true;
  let wallAdmissionV298=options.wallGalleryV298?.(mode==="minecraft")===true;
  let westAdmissionV302=options.westKiezV302?.(mode==="minecraft")===true;
  let disposed = false, processing = false, revision = 0;
  let active: { id: string; controller: AbortController } | null = null;
  let queue: SurroundingChunkDescriptor[] = [];
  let geometryBytes = 0, bufferCount = 0, lastScan = -Infinity;
  let focus: { x: number; z: number } | undefined;
  let navigationTiles: SurroundingNavigationTile[] = [];
  let manifestAttempt: AbortController | null = null;
  let pageHidden = false;
  const activityWaiters = new Set<() => void>();
  const activeView = (): boolean => !pageHidden && root.visible && options.isActive?.() !== false &&
    (typeof document === "undefined" || document.visibilityState !== "hidden");
  const notifyActivity = (): void => {
    for (const notify of activityWaiters) notify();
    activityWaiters.clear();
  };
  const awaitActiveView = async (): Promise<boolean> => {
    while (!disposed && !activeView()) await new Promise<void>(resolve => activityWaiters.add(resolve));
    return !disposed;
  };
  const updateNavigation = (): void => {
    options.onQuarterResidentsV303?.(new Set([...residents].filter(([,e])=>e.root.userData.sourceQuarterOwnersV303?.length>0).map(([id,e])=>`${e.root.userData.sourceQuarterNativeV303?"minecraft":"drawn"}:${id}`)));
    navigationTiles = Array.from(residents.values()).filter(entry => !entry.descriptor.detailCompanionOf).map(entry => ({
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
  const takePrefetch = (id: string): Prefetch | undefined => {
    const job = prefetches.get(id);
    if (job) { prefetches.delete(id); prefetchedBytes -= job.reservedBytes; }
    return job;
  };
  const cancelPrefetches = (all = false): void => {
    for (const [id, job] of prefetches) if (all || !desired.has(id)) {
      job.controller.abort(); takePrefetch(id); job.result = null;
    }
  };
  const fillPrefetches = (): void => {
    if (disposed || !activeView()) return;
    const minecraft = mode === "minecraft";
    for (const descriptor of queue) {
      if (prefetches.size >= SURROUNDING_CITY_PREFETCH_COUNT) break;
      if (descriptor.id === active?.id || residents.has(descriptor.id) || prefetches.has(descriptor.id) ||
          (previousDesired && !previousDesired.has(descriptor.id)) ||
          !desired.has(descriptor.id) || now() - (failedAt.get(descriptor.id) ?? -Infinity) < 30_000) continue;
      const asset = minecraft ? descriptor.minecraft : descriptor.drawn;
      const reservedBytes = prefetchReservation(asset);
      if (prefetchedBytes + reservedBytes > SURROUNDING_CITY_PREFETCH_BYTES) continue;
      const task = new AbortController();
      const job: Prefetch = { controller: task, reservedBytes, result: null };
      // Handle rejection immediately, even if a camera turn discards this job
      // before it is promoted to the foreground. Aborted bytes are never cached.
      job.result = bufferPacket(fetcher, surroundingPacketUrl(descriptor, minecraft, options.manifestUrl, manifest?.packetMirrorCommit), task.signal, asset, transportIdleMs)
        .then(packet => ({ packet }), error => ({ error }));
      prefetches.set(descriptor.id, job); prefetchedBytes += reservedBytes;
    }
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
        const prefetched = takePrefetch(descriptor.id);
        const task = prefetched?.controller ?? new AbortController();
        active = { id: descriptor.id, controller: task };
        let unpublished: Group | null = null;
        try {
          const loading = prefetched ? consumePrefetch(prefetched, task.signal, asset)
            : fetchJsonBounded(fetcher, surroundingPacketUrl(descriptor, minecraft, options.manifestUrl, manifest?.packetMirrorCommit), task.signal, asset.bytes + 64, asset, transportIdleMs);
          const recipes=options.sourceQuartersV303===true&&options.loadSourceQuarterSourcesV309
            ?Promise.resolve().then(()=>options.loadSourceQuarterSourcesV309!(descriptor.id,minecraft))
            :Promise.resolve(options.sourceQuarterSourcesV303);
          fillPrefetches();
          const [data,sourceQuarterSourcesV303] = await awaitPacketAndRecipesV309(loading,recipes,task.signal);
          if (disposed || !activeView() || task.signal.aborted || familyRevision !== revision || !desired.has(descriptor.id)) continue;
          const littenReadyV297=options.littenStadthausV297?.(minecraft)===true,wallReadyV298=options.wallGalleryV298?.(minecraft)===true;
          const wilhelmCandidateV324=sourceQuarterSourcesV303?.some(entry=>entry.admission==="wilhelm-v324")===true;
          const wilhelmReadyV324=wilhelmCandidateV324&&options.wilhelmHousingV324?.(minecraft)===true;
          const wilhelmChangedV324=()=>wilhelmCandidateV324&&wilhelmReadyV324!==(options.wilhelmHousingV324?.(minecraft)===true);
          const southwestCandidateV326=sourceQuarterSourcesV303?.some(e=>e.admission==="southwest-sites-v326")===true;
          const southwestReadyV326=southwestCandidateV326&&options.southWestSitesV326?.(minecraft)===true;
          const southwestChangedV326=()=>southwestCandidateV326&&southwestReadyV326!==(options.southWestSitesV326?.(minecraft)===true);
          const wilhelmStreetCandidateV325=sourceQuarterSourcesV303?.some(entry=>entry.admission==="wilhelm-street-v325")===true;
          const wilhelmStreetReadyV325=wilhelmStreetCandidateV325&&options.wilhelmStreetFrontsV325?.(minecraft)===true;
          const wilhelmStreetChangedV325=()=>wilhelmStreetCandidateV325&&wilhelmStreetReadyV325!==(options.wilhelmStreetFrontsV325?.(minecraft)===true);
          const universitiesCandidateV322=sourceQuarterSourcesV303?.some(entry=>entry.admission==="universities-v322")===true;
          const officeAdmissionV322=options.publicOfficesAdmissionV322?.(minecraft);
          const universitiesReadyV322=officeAdmissionV322?officeAdmissionV322.universities===true:options.universitiesV322?.(minecraft)===true;
          const governmentCandidateV321=sourceQuarterSourcesV303?.some(entry=>entry.admission==="government-v321")===true;
          const governmentReadyV321=officeAdmissionV322?officeAdmissionV322.government===true:options.governmentOfficesV321?.(minecraft)===true;
          const officesChangedV322=()=>{if(!governmentCandidateV321&&!universitiesCandidateV322)return false;const now=options.publicOfficesAdmissionV322?.(minecraft);return governmentCandidateV321&&governmentReadyV321!==(now?now.government===true:options.governmentOfficesV321?.(minecraft)===true)||universitiesCandidateV322&&universitiesReadyV322!==(now?now.universities===true:options.universitiesV322?.(minecraft)===true);};
          const neukoellnReadyV305=options.neukoellnLandmarksV305?.(minecraft)===true;
          const northCandidateV309=sourceQuarterSourcesV303?.some(entry=>entry.admission==="north-v309")===true;
          const northReadyV309=options.northFidelityV309?.(minecraft)===true;
          const northChangedV309=()=>northCandidateV309&&northReadyV309!==(options.northFidelityV309?.(minecraft)===true);
          const treptowCandidateV317=sourceQuarterSourcesV303?.some(entry=>entry.admission==="treptow-v317")===true;
          const treptowReadyV317=options.treptowWaterfrontV317?.(minecraft)===true;
          const treptowChangedV317=()=>treptowCandidateV317&&treptowReadyV317!==(options.treptowWaterfrontV317?.(minecraft)===true);
          const neukoellnChangedV305=()=>["ring182-7_8","ring182-8_8"].includes(descriptor.id)&&neukoellnReadyV305!==(options.neukoellnLandmarksV305?.(minecraft)===true);
          const westReadyV302=options.westKiezV302?.(minecraft)===true;
          const westAdmissionChangedV302=()=>westKiezPacketCandidateV302(descriptor.id,minecraft)&&westReadyV302!==(options.westKiezV302?.(minecraft)===true);
          const admissionChangedV298=()=>littenStadthausPacketCandidateV297(descriptor.id,minecraft)&&littenReadyV297!==(options.littenStadthausV297?.(minecraft)===true)||mauerparkTileV298(descriptor.id)&&wallReadyV298!==(options.wallGalleryV298?.(minecraft)===true);
          const southOwnersReady = options.southFidelityV294?.(minecraft) === true;
          const southReceiptTile = SOUTH_RECEIPT_TILES_V294.has(`${minecraft ? "minecraft" : "drawn"}:${descriptor.id}`);
          const southAdmissionChanged = (): boolean => southReceiptTile && southOwnersReady !== (options.southFidelityV294?.(minecraft) === true);
          // Aperture hosts require one authenticated material for their full lifetime.
          const groundOverlaysV329 = options.publicSitesV326 !== true || !!descriptor.detailCompanionOf ||
            !sourceQuarterSourcesV303?.some(({kind}) => groundOverlayKindsV329.has(kind)) ||
            ubahnCandidatesV326(descriptor.bounds).length === 0;
          const entry = await createStreamedSurroundingCityChunkV255(
            data as SurroundingCityChunk, descriptor.id, minecraft, { signal: task.signal },
            { operaTheatresV274: options.operaTheatresV274 === true, schlossplatzV239: options.schlossplatzV239 === true, staatsoperV240: options.staatsoperV240 === true, architectureV241: options.architectureV241 === true, mitteEnsembleV281: options.mitteEnsembleV281 === true, prenzlbergV264: options.prenzlbergV264 === true, chariteBridgesV265: options.chariteBridgesV265 === true, northernSitesV266: options.northernSitesV266 === true, golgathaV270: options.golgathaV270 === true, tachelesFrontsV270: options.tachelesFrontsV270 === true, southFidelityV294: southOwnersReady, littenStadthausV297:littenReadyV297, wallGalleryV298:wallReadyV298,stralauSisyphosV299:options.stralauSisyphosV299===true,neighbourhoodV300:options.neighbourhoodV300===true,clusterFacadesV320:options.clusterFacadesV320,berlinSenateV321:options.berlinSenateV321,governmentOfficesV321:governmentReadyV321,universitiesV322:universitiesReadyV322,wilhelmHousingV324:wilhelmReadyV324,wilhelmStreetFrontsV325:wilhelmStreetReadyV325,southWestSitesV326:southwestReadyV326,westKiezV302:westReadyV302,sourceQuartersV303:options.sourceQuartersV303===true,sourceQuarterSourcesV303,groundOverlaysV329,transportDetailsV334:options.transportDetailsV334,neukoellnLandmarksV305:neukoellnReadyV305,northFidelityV309:northReadyV309,treptowWaterfrontV317:treptowReadyV317 },
          );
          unpublished = entry.root;
          if(options.publicSitesV326===true&&!descriptor.detailCompanionOf&&!entry.gardenTerrainV330){
            const originalHostsV326=entry.root.children.filter((o):o is Mesh=>o instanceof Mesh);
            const access=await finishV326(attachPacketUbahnAccessV326Steps(entry,minecraft,hasUbahnGroundApproachSourceV326(descriptor.id,minecraft,descriptor[minecraft?"minecraft":"drawn"])?(x,z)=>ubahnGroundApproachAtV326(x,z,minecraft):undefined,hasUbahnGroundApproachSourceV326(descriptor.id,minecraft,descriptor[minecraft?"minecraft":"drawn"])),task.signal);
            if(access){publicAccessV326.set(entry.root,access);entry.geometryBytes+=access.geometryBytes;entry.bufferCount+=access.bufferCount;}
            const stones=await finishV326(createPublicMonumentsPacketV326Steps(entry.root,descriptor.id,minecraft,entry.nav,entry.origin,{hosts:originalHostsV326,openings:access?.openings??[]}),task.signal);
            if(stones.root){entry.nav=stones.navigation??entry.nav;monumentsV326.set(entry.root,stones);entry.geometryBytes+=stones.geometryBytes;entry.bufferCount+=stones.bufferCount;}
          }
          if(options.publicSitesV326===true&&entry.geometryBytes>budget){release(entry.root);unpublished=null;throw Error("Complete public detail packet exceeds resident budget");}
          // New resources use the existing measured resident counter. Only
          // no-longer-visible packets retire; visible source detail is retained.
          const retirees=[...residents].filter(([id])=>!desired.has(id));
          for(const [id]of retirees){if(geometryBytes+entry.geometryBytes<=budget)break;evict(id);}
          // onAttach can synchronously dispose this controller during error recovery.
          if (disposed || !activeView() || task.signal.aborted || familyRevision !== revision || !desired.has(descriptor.id) ||
              (southAdmissionChanged()||admissionChangedV298()||westAdmissionChangedV302()||neukoellnChangedV305()||northChangedV309()||treptowChangedV317()||officesChangedV322()||wilhelmChangedV324()||wilhelmStreetChangedV325()||southwestChangedV326())) {
            release(entry.root); unpublished = null; continue;
          }
          options.onAttach?.(entry.root, mode);
          if (disposed || !activeView() || task.signal.aborted || familyRevision !== revision || !desired.has(descriptor.id) || (southAdmissionChanged()||admissionChangedV298()||westAdmissionChangedV302()||neukoellnChangedV305()||northChangedV309()||treptowChangedV317()||officesChangedV322()||wilhelmChangedV324()||wilhelmStreetChangedV325()||southwestChangedV326())) { release(entry.root); unpublished = null; continue; }
          residents.set(descriptor.id, { ...entry, descriptor, lastWanted: now(), southOwnersReadyV294:southOwnersReady,littenReadyV297,wallReadyV298,westReadyV302,neukoellnReadyV305,northCandidateV309,northReadyV309,treptowCandidateV317,treptowReadyV317,governmentCandidateV321,governmentReadyV321,universitiesCandidateV322,universitiesReadyV322,wilhelmCandidateV324,wilhelmReadyV324,wilhelmStreetCandidateV325,wilhelmStreetReadyV325,southwestCandidateV326,southwestReadyV326 });
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
          task.abort();
        } finally {
          if (active?.controller === task) active = null;
        }
      }
    } finally { processing = false; }
  };

  const refresh = (timestamp = now(), nextFocus?: { x: number; z: number }): void => {
    if (nextFocus) focus = nextFocus;
    if (disposed) return;
    if (!activeView()) {
      manifestAttempt?.abort(); active?.controller.abort(); cancelPrefetches(true);
      queue = []; lastScan = -Infinity; return;
    }
    notifyActivity();
    // A native world can finish after this controller has already loaded its
    // closed source tile. Re-admit only the immutable affected receipts on the
    // existing refresh; no timer, global family reset or unbounded retry loop.
    const southReadyNow = options.southFidelityV294?.(mode === "minecraft") === true;
    if (southReadyNow !== southAdmissionV294) {
      southAdmissionV294 = southReadyNow;
      const family = mode === "minecraft" ? "minecraft" : "drawn";
      let changed = false;
      for (const [id, entry] of residents) if (SOUTH_RECEIPT_TILES_V294.has(`${family}:${id}`) && entry.southOwnersReadyV294 !== southReadyNow) {
        evict(id); failedAt.delete(id); changed = true;
      }
      if (active && SOUTH_RECEIPT_TILES_V294.has(`${family}:${active.id}`)) active.controller.abort();
      lastScan = -Infinity;
      if (changed) options.onChange?.();
    }
    const littenNow=options.littenStadthausV297?.(mode==="minecraft")===true,wallNow=options.wallGalleryV298?.(mode==="minecraft")===true;
    if(littenNow!==littenAdmissionV297||wallNow!==wallAdmissionV298){
      littenAdmissionV297=littenNow;wallAdmissionV298=wallNow;
      const native=mode==="minecraft";let changed=false;
      for(const [id,entry] of residents)if(littenStadthausPacketCandidateV297(id,native)&&entry.littenReadyV297!==littenNow||mauerparkTileV298(id)&&entry.wallReadyV298!==wallNow){evict(id);failedAt.delete(id);changed=true;}
      if(active&&(littenStadthausPacketCandidateV297(active.id,native)||mauerparkTileV298(active.id)))active.controller.abort();
      lastScan=-Infinity;if(changed)options.onChange?.();
    }
    const westNowV302=options.westKiezV302?.(mode==="minecraft")===true;
    if(westNowV302!==westAdmissionV302){
      westAdmissionV302=westNowV302;const native=mode==="minecraft";let changed=false;
      for(const [id,entry] of residents)if(westKiezPacketCandidateV302(id,native)&&entry.westReadyV302!==westNowV302){evict(id);failedAt.delete(id);changed=true;}
      if(active&&westKiezPacketCandidateV302(active.id,native))active.controller.abort();
      lastScan=-Infinity;if(changed)options.onChange?.();
    }
    const neukoellnNowV305=options.neukoellnLandmarksV305?.(mode==="minecraft")===true;
    for(const[id,entry]of residents)if(["ring182-7_8","ring182-8_8"].includes(id)&&entry.neukoellnReadyV305!==neukoellnNowV305){evict(id);failedAt.delete(id);lastScan=-Infinity;}
    const northNowV309=options.northFidelityV309?.(mode==="minecraft")===true;
    for(const[id,entry]of residents)if(entry.northCandidateV309&&entry.northReadyV309!==northNowV309){evict(id);failedAt.delete(id);lastScan=-Infinity;}
    const treptowNowV317=options.treptowWaterfrontV317?.(mode==="minecraft")===true;
    for(const[id,entry]of residents)if(entry.treptowCandidateV317&&entry.treptowReadyV317!==treptowNowV317){evict(id);failedAt.delete(id);lastScan=-Infinity;}
    for(const[id,e]of residents)if(e.southwestCandidateV326&&e.southwestReadyV326!==(options.southWestSitesV326?.(mode==="minecraft")===true)){evict(id);failedAt.delete(id);lastScan=-Infinity;}
    // Recheck both relevant Wilhelm families after each real release. A
    // release hook can change either source gate during this synchronous pass.
    const housingCandidateV325=[...residents.values()].some(e=>e.wilhelmCandidateV324);
    const streetCandidateV325=[...residents.values()].some(e=>e.wilhelmStreetCandidateV325);
    if(housingCandidateV325||streetCandidateV325){
      const read=()=>({housing:housingCandidateV325&&options.wilhelmHousingV324?.(mode==="minecraft")===true,
        street:streetCandidateV325&&options.wilhelmStreetFrontsV325?.(mode==="minecraft")===true});
      let ready=read();
      for(;;){let removed=false;
        for(const[id,e]of residents)if(e.wilhelmCandidateV324&&e.wilhelmReadyV324!==ready.housing||
          e.wilhelmStreetCandidateV325&&e.wilhelmStreetReadyV325!==ready.street){
          evict(id);failedAt.delete(id);lastScan=-Infinity;removed=true;
          if(disposed)return;ready=read();break;
        }
        if(!removed)break;
      }
    }
    if(options.publicOfficesAdmissionV322){
      let affected=false;for(const entry of residents.values())if(entry.governmentCandidateV321||entry.universitiesCandidateV322){affected=true;break;}
      if(affected){
        let status=options.publicOfficesAdmissionV322(mode==="minecraft");
        // Every actual release may synchronously change source ownership. A
        // restart always removes one resident, so this loop remains finite.
        for(;;){let removed=false;
          for(const[id,entry]of residents)if(entry.governmentCandidateV321&&entry.governmentReadyV321!==(status.government===true)||entry.universitiesCandidateV322&&entry.universitiesReadyV322!==(status.universities===true)){
            evict(id);failedAt.delete(id);lastScan=-Infinity;removed=true;
            if(disposed)return;
            status=options.publicOfficesAdmissionV322(mode==="minecraft");break;
          }
          if(!removed)break;
        }
      }
    }else{
      const governmentNowV321=options.governmentOfficesV321?.(mode==="minecraft")===true;
      for(const[id,entry]of residents)if(entry.governmentCandidateV321&&entry.governmentReadyV321!==governmentNowV321){evict(id);failedAt.delete(id);lastScan=-Infinity;}
      const universitiesNowV322=options.universitiesV322?.(mode==="minecraft")===true;
      for(const[id,entry]of residents)if(entry.universitiesCandidateV322&&entry.universitiesReadyV322!==universitiesNowV322){evict(id);failedAt.delete(id);lastScan=-Infinity;}
    }
    if (!manifest) return;
    if (timestamp - lastScan < SURROUNDING_CITY_SCAN_MS) return;
    lastScan = timestamp;
    options.camera.updateMatrixWorld();
    options.camera.getWorldPosition(cameraPosition);
    projection.copy(options.camera.projectionMatrix);
    projection.elements[0] /= 1.18;
    projection.elements[5] /= 1.18;
    matrix.multiplyMatrices(projection, options.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    // The foreground follows new views immediately. Speculation after a camera
    // move waits one scan for continuing visibility, avoiding packets glimpsed
    // only during a fast turn. The initial view can prefetch immediately.
    if (hasScanned) previousDesired = new Set(desired);
    hasScanned = true;
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
    cancelPrefetches();
    if (processing) fillPrefetches();
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
    manifestAttempt?.abort();
    notifyActivity();
    active?.controller.abort();
    cancelPrefetches(true);
    queue = [];
    desired.clear(); previousDesired = null; failedAt.clear();
    for (const id of residents.keys()) evict(id);
    manifest = null;
    options.signal?.removeEventListener("abort", dispose);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    }
  };
  const onVisibilityChange = (): void => refresh();
  const onPageHide = (): void => { pageHidden = true; refresh(); };
  const onPageShow = (): void => { pageHidden = false; refresh(); };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
  }
  options.signal?.addEventListener("abort", dispose, { once: true });
  if (options.signal?.aborted) dispose();
  const loadManifest = async (): Promise<void> => {
    for (let attempt = 0; attempt <= SURROUNDING_CITY_MANIFEST_RETRY_MS.length;) {
      if (!await awaitActiveView() || disposed) return;
      const task = new AbortController();
      manifestAttempt = task;
      try {
        const value = await fetchJsonBounded(fetcher, options.manifestUrl, task.signal, SURROUNDING_CITY_MAX_HOSTED_MANIFEST_BYTES, undefined, transportIdleMs);
        if (!disposed) { manifest = validateSurroundingManifest(value); refresh(); }
        return;
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        if (task.signal.aborted) continue;
        if (attempt === SURROUNDING_CITY_MANIFEST_RETRY_MS.length) { report(error); return; }
        if (!await retryDelay(SURROUNDING_CITY_MANIFEST_RETRY_MS[attempt], controller.signal)) return;
        attempt++;
      } finally { if (manifestAttempt === task) manifestAttempt = null; }
    }
  };
  const ready = disposed ? Promise.resolve() : loadManifest();

  const at = (x: number, z: number): Resident | undefined => {
    for (const entry of residents.values()) {
      // A detail companion can finish before a failed primary retries. Its
      // intentionally empty navigation must never mask the later ground/water.
      if (entry.descriptor.detailCompanionOf) continue;
      const b = entry.descriptor.bounds;
      if (x < b[0] || z < b[1] || x >= b[2] || z >= b[3]) continue;
      // Additive scopes can share a tile rectangle while owning disjoint land.
      // A retained partial tile must not mask the new tile's ground or water.
      const lx = x - entry.origin[0], lz = z - entry.origin[2];
      if (entry.nav.ground.some(p => surroundingPolygonContains(p, lx, lz)) || entry.nav.water.some(p=>surroundingPolygonContains(p,lx,lz))) return entry;
    }
    return undefined;
  };
  return {
    root, ready, refresh, dispose,
    hasResidentSurfaceAt: (x, z) => at(x, z) !== undefined,
    hasResidentChunk: (id, sha256) =>
      residents.get(id)?.descriptor[mode === "minecraft" ? "minecraft" : "drawn"].sha256 === sha256,
    setMode(nextMode) {
      if (disposed || nextMode === mode) return;
      const changedFamily = (nextMode === "minecraft") !== (mode === "minecraft");
      mode = nextMode;
      if (!changedFamily) return;
      revision++;
      active?.controller.abort();
      cancelPrefetches(true);
      for (const id of residents.keys()) evict(id);
      failedAt.clear();
      lastScan = -Infinity;
      refresh();
      options.onChange?.();
    },
    interiorGroundAt(x, z, currentY) {
      const entry = at(x, z);
      if (!entry) return null;
      const underground = publicAccessV326.get(entry.root)?.groundAt(x, z, currentY);
      if (underground != null) return underground;
      return entry.descriptor.id === "5_-7"
        ? namedElevatedFloorAtV334(entry.nav, x - entry.origin[0], z - entry.origin[2], currentY)
        : null;
    },
    gardenGroundAtV330(x, z) {
      const entry = at(x, z);
      if (!entry?.gardenTerrainV330) return null;
      const lx = x - entry.origin[0], lz = z - entry.origin[2];
      if (!entry.nav.ground.some(p => surroundingPolygonContains(p, lx, lz))) return null;
      return spreeBridgeFloorAtV242(entry.nav, lx, lz) ??
        gardenTerrainGroundAtV330(entry.gardenTerrainV330, lx, lz, mode === "minecraft");
    },
    groundAt(x, z) {
      const entry = at(x, z);
      // A resident tile already verified exact source-ground membership. Avoid
      // walking the full larger city's shoreline inventory for every step.
      if (!entry) {
        if (!manifest || !manifest.footprint.some((p, i) => i < (manifest!.gardenFootprintStartV330 ?? Infinity) && surroundingPolygonContains(p, x, z))) return null;
        return terrainGroundAt(x, z, manifest.groundY, mode === "minecraft");
      }
      const lx = x - entry.origin[0], lz = z - entry.origin[2];
      if (!entry.nav.ground.some(p => surroundingPolygonContains(p, lx, lz))) return null;
      const stairFloor = mierendorffFloorAtV269(entry.nav, lx, lz);
      if (stairFloor !== null) return stairFloor;
      const bridgeFloor = spreeBridgeFloorAtV242(entry.nav, lx, lz);
      if (bridgeFloor !== null) return bridgeFloor;
      if (entry.gardenTerrainV330) return gardenTerrainGroundAtV330(entry.gardenTerrainV330, lx, lz, mode === "minecraft");
      const road = entry.nav.roads?.some(p => surroundingPolygonContains(p, lx, lz));
      if(entry.descriptor.id.startsWith("northEast326-")){const top=northEastPublicSiteGroundAtV326(x,z,mode==="minecraft",road===true);if(top!==null)return top;}
      if(hasUbahnGroundApproachSourceV326(entry.descriptor.id,mode==="minecraft",entry.descriptor[mode==="minecraft"?"minecraft":"drawn"])){const top=ubahnGroundApproachAtV326(x,z,mode==="minecraft");if(top!==null)return top;}
      // A failed or changed source receipt retains its old ground and floor.
      if(wallGalleryHillContainsV298(x,z)&&entry.root.userData.mauerparkTerrainV298!==true)return entry.nav.groundY+(road?.09:0);
      return terrainGroundAt(x, z, entry.nav.groundY, mode === "minecraft") + (road ? 0.09 : 0);
    },
    solidAt(x, y, z, radius = 0) {
      for (const entry of residents.values()) {
        const b = entry.descriptor.bounds;
        if (x + radius < b[0] || z + radius < b[1] || x - radius > b[2] || z - radius > b[3]) continue;
        if(publicAccessV326.get(entry.root)?.solidAt(x,y,z,radius))return true;
        if(entry.descriptor.id.startsWith("northEast326-")&&entry.nav.ground.some(p=>surroundingPolygonContains(p,x-entry.origin[0],z-entry.origin[2]))&&northEastPublicSiteSolidAtV326(x,y,z,radius,mode==="minecraft"))return true;
        if (entry.root.userData.brehmTropicalHallSolidAt?.(x, y, z, radius)) return true;
        if (spreeBridgeSolidAtV242(entry.nav, x - entry.origin[0], y, z - entry.origin[2], radius)) return true;
        if (surroundingBuildingSolidAt(entry.nav, x - entry.origin[0], y, z - entry.origin[2], radius)) return true;
      }
      return false;
    },
    waterAt(x, z) {
      const entry = at(x, z);
      if (!entry) return false;
      const lx = x - entry.origin[0], lz = z - entry.origin[2];
      if(entry.descriptor.id.startsWith("northEast326-")&&northEastPublicSiteWaterAtV326(x,z)!==null)return true;
      return spreeBridgeFloorAtV242(entry.nav, lx, lz) === null &&
        !entry.nav.bridges?.some(p => surroundingPolygonContains(p, lx, lz)) &&
        entry.nav.water.some(p => surroundingPolygonContains(p, lx, lz));
    },
    get residentGeometryBytes() { return geometryBytes; },
    get residentMaskBytesV326(){let bytes=0;for(const entry of residents.values()){const access=publicAccessV326.get(entry.root);if(access)bytes+=ubahnGroundMaskBytesV326(access);}return bytes;},
    get residentBufferCount() { return bufferCount; },
    get residentChunkCount() { return residents.size; },
    get pending() { return processing || queue.length > 0; },
    get manifest() { return manifest; },
    get navigationTiles() { return navigationTiles; },
  };
}
