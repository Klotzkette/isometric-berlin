import { BufferAttribute, BufferGeometry, InstancedMesh, InterleavedBuffer, Line, Mesh, Points, StaticDrawUsage, type Object3D } from "three";
import { deflateSync, inflateSync } from "three/examples/jsm/libs/fflate.module.js";
import { releaseScratchBuffer } from "./releaseScratchBuffer";

type Storage = BufferAttribute | InterleavedBuffer;
type Values = BufferAttribute["array"];
const parked = new WeakSet<Storage>();
const BLOCK_BYTES = 256 * 1024;
const MIN_BYTES = 64 * 1024;
type StorageInfo = { arrayIdentity: object; bufferIdentity: object; byteLength: number; bufferBytes: number };
const arrayIds = new WeakMap<object, object>(), bufferIds = new WeakMap<object, object>();
const storageInfo = new WeakMap<Storage, StorageInfo>();
function identity(ids: WeakMap<object, object>, value: object): object {
  let id = ids.get(value); if (!id) ids.set(value, id = {}); return id;
}

/** Metadata observers must not decode or retain a full CPU backing array. */
export function staticStorageInfo(storage: Storage): StorageInfo {
  const parkedInfo = storageInfo.get(storage);
  if (parkedInfo) return parkedInfo;
  const array = storage.array;
  return { arrayIdentity: identity(arrayIds, array), bufferIdentity: identity(bufferIds, array.buffer),
    byteLength: array.byteLength, bufferBytes: array.buffer.byteLength };
}

/**
 * Construction-only opt-in for immutable geometry. GPU buffers keep their
 * original precision. CPU reads reconstruct identical bytes synchronously;
 * WeakRef retains a decoded view for the complete current JS job, so getX/Y/Z
 * loops and uploads inflate once, not once per component. No source is fetched.
 * A Three update or explicit array replacement permanently returns this storage
 * to its ordinary writable representation. Animated/unfinalized data is excluded.
 */
export function* parkStaticAttribute(storage: Storage, ownsBuffer = false): Generator<void, number> {
  if (parked.has(storage) || typeof WeakRef !== "function" ||
      storage.usage !== StaticDrawUsage || storage.updateRanges.length ||
      storage.onUploadCallback !== (storage instanceof BufferAttribute
        ? BufferAttribute.prototype.onUploadCallback : InterleavedBuffer.prototype.onUploadCallback) ||
      Object.getOwnPropertyDescriptor(storage, "array")?.get) return 0;
  const original = storage.array;
  const version = storage.version;
  if (original.byteLength < MIN_BYTES || original.byteOffset !== 0 ||
      original.byteLength !== original.buffer.byteLength) return 0;
  const bytes = new Uint8Array(original.buffer, original.byteOffset, original.byteLength);
  const chunks: Uint8Array[] = [];
  let packedBytes = 0;
  for (let offset = 0; offset < bytes.length; offset += BLOCK_BYTES) {
    const chunk = deflateSync(bytes.subarray(offset, offset + BLOCK_BYTES), { level: 1 });
    chunks.push(chunk); packedBytes += chunk.length;
    yield;
  }
  if (packedBytes >= bytes.length * 0.8) return 0;
  if (storage.array !== original || storage.version !== version) return 0;
  // Capture only scalar metadata and a weak view, never original/bytes in the
  // accessor's environment. The construction generator ends immediately after.
  installStorage(storage, chunks, new WeakRef(original), original.constructor as
    { new(buffer: ArrayBuffer): Values }, original.byteLength, ownsBuffer);
  parked.add(storage);
  const saved = bytes.length - packedBytes;
  if (ownsBuffer) releaseScratchBuffer(original.buffer as ArrayBuffer);
  return saved;
}

function installStorage(storage: Storage, chunks: Uint8Array[], weak: WeakRef<Values>,
  ArrayType: { new(buffer: ArrayBuffer): Values }, byteLength: number, ownsBuffer: boolean): void {
  storageInfo.set(storage, staticStorageInfo(storage));
  let retirement: ReturnType<typeof setTimeout> | undefined;
  const read = (): Values => {
    let values = weak.deref();
    if (!values || values.byteLength !== byteLength) {
      const raw = new Uint8Array(byteLength);
      for (let i = 0; i < chunks.length; i++) {
        inflateSync(chunks[i], { out: raw.subarray(i * BLOCK_BYTES, (i + 1) * BLOCK_BYTES) });
      }
      values = new ArrayType(raw.buffer);
      weak = new WeakRef(values);
    }
    if (ownsBuffer && retirement === undefined) retirement = setTimeout(() => {
      retirement = undefined;
      // Only explicit exclusive owners opt in. All synchronous readers/upload
      // calls have returned; future reads rehydrate from the unchanged bytes.
      const decoded = weak.deref();
      if (decoded) releaseScratchBuffer(decoded.buffer as ArrayBuffer);
    }, 0);
    return values;
  };
  const writable = (values: Values): void => {
    if (retirement !== undefined) clearTimeout(retirement);
    storageInfo.delete(storage);
    Object.defineProperty(storage, "array", { value: values, writable: true, configurable: true, enumerable: true });
    delete (storage as unknown as { needsUpdate?: boolean }).needsUpdate;
    chunks.length = 0;
    // Do not re-park a storage that has subsequently opted into mutation.
  };
  Object.defineProperty(storage, "array", { configurable: true, enumerable: true,
    get: read, set: writable });
  Object.defineProperty(storage, "needsUpdate", { configurable: true,
    set(value: boolean) {
      if (value) { writable(read()); storage.version++; }
    },
  });
}

/** Call after indexing, terrain draping, colours and optional interleaving. */
export function* parkStaticGeometrySteps(root: Object3D, ownsBuffers = false): Generator<void, number> {
  const storages = new Set<Storage>();
  const owners = new Map<ArrayBufferLike, Set<Storage>>();
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    const geometry: BufferGeometry = object.geometry;
    const fields = [...Object.values(geometry.attributes), geometry.index,
      ...Object.values(geometry.morphAttributes).flat(),
      ...(object instanceof InstancedMesh ? [object.instanceMatrix, object.instanceColor] : [])];
    if (ownsBuffers) for (const attribute of fields) {
      if (!attribute) continue;
      const storage = "data" in attribute ? attribute.data : attribute;
      const buffer = storage.array.buffer;
      let aliases = owners.get(buffer); if (!aliases) owners.set(buffer, aliases = new Set());
      aliases.add(storage);
    }
    if ((geometry.userData.exactIndexPending !== false && geometry.userData.losslessStaticBacking !== true) || object.userData.modeColours ||
        geometry.userData.flatColorsBuilt || Object.values(geometry.morphAttributes).some(a => a.length)) return;
    for (const attribute of [...Object.values(geometry.attributes), geometry.index]) {
      if (!attribute) continue;
      storages.add("data" in attribute ? attribute.data : attribute);
    }
  });
  let saved = 0;
  for (const storage of storages) {
    const array = storage.array;
    // Do not detach subviews or storage shared with any other attribute.
    const exclusive = ownsBuffers && array.byteOffset === 0 && array.byteLength === array.buffer.byteLength &&
      owners.get(array.buffer)?.size === 1;
    saved += yield* parkStaticAttribute(storage, exclusive);
  }
  return saved;
}

/** Caller owns these complete constructor-created matrices (no borrowed views).
 * Opt-in only for finished architectural/park roots, never mobs/effects. */
export function* parkStaticInstancesSteps(root: Object3D): Generator<void, number> {
  const matrices = new Set<BufferAttribute>();
  root.traverse(object => { if (object instanceof InstancedMesh) matrices.add(object.instanceMatrix); });
  let saved = 0;
  for (const matrix of matrices) saved += yield* parkStaticAttribute(matrix, true);
  return saved;
}
