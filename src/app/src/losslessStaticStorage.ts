import { BufferAttribute, BufferGeometry, InstancedMesh, InterleavedBuffer, Line, Mesh, Points, StaticDrawUsage, type Object3D } from "three";
import { deflateSync, inflateSync } from "three/examples/jsm/libs/fflate.module.js";
import { releaseScratchBuffer } from "./releaseScratchBuffer";

type Storage = BufferAttribute | InterleavedBuffer;
type Values = BufferAttribute["array"];
const parked = new WeakSet<Storage>();
const BLOCK_BYTES = 256 * 1024;
const MIN_BYTES = 64 * 1024;
const MATRIX_WORDS = 16;
type MatrixStorageBlock = {
  compressed: Uint8Array;
  firstRow: Uint32Array;
  varyingColumns: number;
};
type StorageBlock = Uint8Array | MatrixStorageBlock;
type StorageInfo = { arrayIdentity: object; bufferIdentity: object; byteLength: number; bufferBytes: number };
const arrayIds = new WeakMap<object, object>(), bufferIds = new WeakMap<object, object>();
const storageInfo = new WeakMap<Storage, StorageInfo>();
const parkedAccessorsV321=new WeakMap<Storage,{get:()=>Values;set:(values:Values)=>void;
  needsUpdate:(value:boolean)=>void;version:number;canonicalOnly:()=>boolean}>();
/** True only for this module's unchanged private compressed backing when no
 * live mutable decoded view remains. It never invokes the array getter. */
export function isParkedStaticStorageV321(storage:Storage):boolean{
  const proof=parkedAccessorsV321.get(storage);if(!proof||storage.usage!==StaticDrawUsage||storage.version!==proof.version||!storageInfo.has(storage))return false;
  const array=Object.getOwnPropertyDescriptor(storage,"array"),update=Object.getOwnPropertyDescriptor(storage,"needsUpdate");
  return array?.get===proof.get&&array.set===proof.set&&update?.set===proof.needsUpdate&&proof.canonicalOnly();
}

/** Private compressed backing, including a still-live decoded WeakRef. Alias
 * bookkeeping must not invoke its getter. This does not promise canonical-only CPU residency. */
export function hasParkedStaticStorageBackingV323(storage: Storage): boolean {
  const proof = parkedAccessorsV321.get(storage);
  if (!proof || storage.usage !== StaticDrawUsage || storage.version !== proof.version || !storageInfo.has(storage)) return false;
  const array = Object.getOwnPropertyDescriptor(storage, "array"), update = Object.getOwnPropertyDescriptor(storage, "needsUpdate");
  return array?.get === proof.get && array.set === proof.set && update?.set === proof.needsUpdate;
}

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

/** Store instance transforms by column to remove common rotation and scale
 * words before compression. Use uint32 throughout so signed zeros and NaN
 * payloads are reproduced exactly. */
type BlockLayout = { bytes: Uint8Array; header?: Pick<MatrixStorageBlock, "firstRow" | "varyingColumns"> };

function matrixBlockLayout(bytes: Uint8Array): BlockLayout {
  const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const rowCount = words.length / MATRIX_WORDS;
  const firstRow = words.subarray(0, MATRIX_WORDS);
  let varyingColumns = 0;
  for (let i = MATRIX_WORDS; i < words.length; i += MATRIX_WORDS) {
    for (let column = 0; column < MATRIX_WORDS; column++) {
      if (words[i + column] !== firstRow[column]) varyingColumns |= 1 << column;
    }
    if (varyingColumns === 0xffff) return { bytes };
  }
  const columns: number[] = [];
  for (let column = 0; column < MATRIX_WORDS; column++) {
    if (varyingColumns & (1 << column)) columns.push(column);
  }
  // Keep the row layout when almost every word varies.
  if (columns.length > 12) return { bytes };
  const compact = new Uint32Array(columns.length * rowCount);
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    const start = i * rowCount;
    for (let row = 0; row < rowCount; row++) {
      compact[start + row] = words[row * MATRIX_WORDS + column];
    }
  }
  return {
    bytes: new Uint8Array(compact.buffer),
    header: { firstRow: firstRow.slice(), varyingColumns },
  };
}

function unpackStaticBlock(block: StorageBlock, output: Uint8Array): void {
  if (block instanceof Uint8Array) {
    inflateSync(block, { out: output });
    return;
  }
  const { compressed, firstRow, varyingColumns } = block;
  const words = new Uint32Array(output.buffer, output.byteOffset, output.byteLength / 4);
  const rowCount = words.length / MATRIX_WORDS;
  let columnCount = 0;
  for (let bits = varyingColumns; bits; bits &= bits - 1) columnCount++;
  const compact = new Uint32Array(rowCount * columnCount);
  inflateSync(compressed, { out: new Uint8Array(compact.buffer) });
  let start = 0;
  for (let column = 0; column < MATRIX_WORDS; column++) {
    if (varyingColumns & (1 << column)) {
      for (let row = 0; row < rowCount; row++) {
        words[row * MATRIX_WORDS + column] = compact[start + row];
      }
      start += rowCount;
    } else {
      const word = firstRow[column];
      for (let row = 0; row < rowCount; row++) words[row * MATRIX_WORDS + column] = word;
    }
  }
}

/**
 * Construction-only opt-in for immutable geometry. GPU buffers keep their
 * original precision. CPU reads reconstruct identical bytes synchronously;
 * WeakRef retains a decoded view for the complete current JS job, so getX/Y/Z
 * loops and uploads inflate once, not once per component. No source is fetched.
 * A Three update or explicit array replacement permanently returns this storage
 * to its ordinary writable representation. Animated/unfinalized data is excluded.
 */
function* prepareStaticBacking(storage: Storage, ownsBuffer: boolean,
  instanceMatrix: boolean): Generator<BlockLayout, number, Uint8Array> {
  if (parked.has(storage) || typeof WeakRef !== "function" ||
      storage.usage !== StaticDrawUsage || storage.updateRanges.length ||
      storage.onUploadCallback !== (storage instanceof BufferAttribute
        ? BufferAttribute.prototype.onUploadCallback : InterleavedBuffer.prototype.onUploadCallback) ||
      Object.getOwnPropertyDescriptor(storage, "array")?.get) return 0;
  const original = storage.array;
  const version = storage.version;
  const upload = storage.onUploadCallback;
  if (original.byteLength < MIN_BYTES || original.byteOffset !== 0 ||
      original.byteLength !== original.buffer.byteLength) return 0;
  const bytes = new Uint8Array(original.buffer, original.byteOffset, original.byteLength);
  const packMatrix = instanceMatrix && original instanceof Float32Array && original.length % MATRIX_WORDS === 0;
  const chunks: StorageBlock[] = [];
  let packedBytes = 0;
  for (let offset = 0; offset < bytes.length; offset += BLOCK_BYTES) {
    const block = bytes.subarray(offset, offset + BLOCK_BYTES);
    const layout = packMatrix ? matrixBlockLayout(block) : { bytes: block };
    const compressed = yield layout;
    const chunk = layout.header ? { ...layout.header, compressed } : compressed;
    chunks.push(chunk);
    packedBytes += chunk instanceof Uint8Array
      ? chunk.byteLength
      : chunk.compressed.byteLength + chunk.firstRow.byteLength + 4;
  }
  if (packedBytes >= bytes.length * 0.8) return 0;
  if (storage.version !== version || storage.onUploadCallback !== upload || parked.has(storage) ||
      Object.getOwnPropertyDescriptor(storage, "array")?.value !== original ||
      storage.usage !== StaticDrawUsage || storage.updateRanges.length) return 0;
  // Capture only scalar metadata and a weak view, never original/bytes in the
  // accessor's environment. The construction generator ends immediately after.
  installStorage(storage, chunks, new WeakRef(original), original.constructor as
    { new(buffer: ArrayBuffer): Values }, original.byteLength, ownsBuffer);
  parked.add(storage);
  const saved = bytes.length - packedBytes;
  if (ownsBuffer) releaseScratchBuffer(original.buffer as ArrayBuffer);
  return saved;
}

export function* parkStaticAttribute(storage: Storage, ownsBuffer = false,
  instanceMatrix = false): Generator<void, number> {
  const steps = prepareStaticBacking(storage, ownsBuffer, instanceMatrix);
  try {
    let next = steps.next();
    while (!next.done) {
      const packed = deflateSync(next.value.bytes, { level: 1 });
      yield;
      next = steps.next(packed);
    }
    return next.value;
  } finally { steps.return(0); }
}

function installStorage(storage: Storage, chunks: StorageBlock[], weak: WeakRef<Values>,
  ArrayType: { new(buffer: ArrayBuffer): Values }, byteLength: number, ownsBuffer: boolean): void {
  storageInfo.set(storage, staticStorageInfo(storage));
  let retirement: ReturnType<typeof setTimeout> | undefined;
  const retire = (): void => {
    if (retirement !== undefined) clearTimeout(retirement);
    retirement = undefined;
    const decoded = weak.deref();
    if (decoded) releaseScratchBuffer(decoded.buffer as ArrayBuffer);
  };
  const originalUpload = storage.onUploadCallback;
  const uploaded = (): void => {
    originalUpload.call(storage);
    // Three has synchronously copied this exclusive backing to WebGL. Retire
    // it before another upload restores its backing in the same render job.
    // CPU-only readers retain the ordinary end-of-job retirement below.
    retire();
  };
  if (ownsBuffer) storage.onUploadCallback = uploaded;
  const read = (): Values => {
    let values = weak.deref();
    if (!values || values.byteLength !== byteLength) {
      const raw = new Uint8Array(byteLength);
      for (let i = 0; i < chunks.length; i++) {
        unpackStaticBlock(chunks[i], raw.subarray(i * BLOCK_BYTES, (i + 1) * BLOCK_BYTES));
      }
      values = new ArrayType(raw.buffer);
      weak = new WeakRef(values);
    }
    if (ownsBuffer && retirement === undefined) retirement = setTimeout(retire, 0);
    return values;
  };
  const writable = (values: Values): void => {
    if (retirement !== undefined) clearTimeout(retirement);
    if (storage.onUploadCallback === uploaded) storage.onUploadCallback = originalUpload;
    storageInfo.delete(storage);
    parkedAccessorsV321.delete(storage);
    Object.defineProperty(storage, "array", { value: values, writable: true, configurable: true, enumerable: true });
    delete (storage as unknown as { needsUpdate?: boolean }).needsUpdate;
    chunks.length = 0;
    // Do not re-park a storage that has subsequently opted into mutation.
  };
  Object.defineProperty(storage, "array", { configurable: true, enumerable: true,
    get: read, set: writable });
  const needsUpdate=(value:boolean)=>{if(value){writable(read());storage.version++;}};
  Object.defineProperty(storage, "needsUpdate", { configurable: true, set:needsUpdate });
  parkedAccessorsV321.set(storage,{get:read,set:writable,needsUpdate,version:storage.version,
    canonicalOnly:()=>{const view=weak.deref();return !view||view.byteLength!==byteLength;}});
}

/** Call after indexing, terrain draping, colours and optional interleaving. */
function* staticGeometryInputs(root: Object3D, ownsBuffers: boolean,
  shouldPark?: (storage: Storage) => boolean): Generator<[Storage, boolean]> {
  const storages = new Set<Storage>();
  const owners = new Map<object, Storage | null>();
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    const geometry: BufferGeometry = object.geometry;
    if (ownsBuffers) for (const attribute of [...Object.values(geometry.attributes), geometry.index,
      ...Object.values(geometry.morphAttributes).flat(),
      ...(object instanceof InstancedMesh ? [object.instanceMatrix, object.instanceColor] : [])]) {
      if (!attribute) continue;
      const storage = "data" in attribute ? attribute.data : attribute;
      // Already parked fields still participate in alias protection, without
      // restoring all their invisible CPU backing merely to identify owners.
      const buffer = staticStorageInfo(storage).bufferIdentity;
      const previous = owners.get(buffer);
      if (previous === undefined) owners.set(buffer, storage);
      else if (previous !== storage) owners.set(buffer, null);
    }
    if ((geometry.userData.exactIndexPending !== false && geometry.userData.losslessStaticBacking !== true) || object.userData.modeColours ||
        geometry.userData.flatColorsBuilt || Object.values(geometry.morphAttributes).some(a => a.length)) return;
    for (const attribute of [...Object.values(geometry.attributes), geometry.index]) {
      if (!attribute) continue;
      storages.add("data" in attribute ? attribute.data : attribute);
    }
  });
  for (const storage of storages) {
    if (shouldPark && !shouldPark(storage)) continue;
    if (parked.has(storage)) continue;
    const info = ownsBuffers ? staticStorageInfo(storage) : undefined;
    yield [storage, !!info && info.byteLength === info.bufferBytes && owners.get(info.bufferIdentity) === storage];
  }
}

export function* parkStaticGeometrySteps(root: Object3D, ownsBuffers = false,
  shouldPark?: (storage: Storage) => boolean): Generator<void, number> {
  let saved = 0;
  for (const [storage, exclusive] of staticGeometryInputs(root, ownsBuffers, shouldPark)) {
    saved += yield* parkStaticAttribute(storage, exclusive);
  }
  return saved;
}

/** Caller owns these complete constructor-created matrices (no borrowed views).
 * Opt-in only for finished architectural/park roots, never mobs/effects. */
export function* parkStaticInstancesSteps(root: Object3D,
  shouldPark?: (storage: Storage) => boolean): Generator<void, number> {
  const matrices = new Set<BufferAttribute>();
  root.traverse(object => { if (object instanceof InstancedMesh) matrices.add(object.instanceMatrix); });
  let saved = 0;
  for (const matrix of matrices) {
    if (shouldPark && !shouldPark(matrix)) continue;
    saved += yield* parkStaticAttribute(matrix, true, true);
  }
  return saved;
}

function* staticMatrixInputs(
  matrixRoot: Object3D, roots: readonly Object3D[], shouldPark?: (storage: Storage) => boolean,
): Generator<[Storage, boolean, boolean]> {
  const matrices = new Set<BufferAttribute>();
  matrixRoot.traverse(object => {
    if (object instanceof InstancedMesh && !parked.has(object.instanceMatrix) &&
        object.instanceMatrix.count * 64 >= MIN_BYTES && (!shouldPark || shouldPark(object.instanceMatrix))) {
      matrices.add(object.instanceMatrix);
    }
  });
  if (!matrices.size) return;
  // An instance matrix normally owns its constructor allocation. A custom
  // geometry or a sibling can still have a distinct view of the same buffer.
  const exclusive = new Map<object, Storage | null>();
  for (const matrix of matrices) {
    const key = staticStorageInfo(matrix).bufferIdentity;
    exclusive.set(key, exclusive.has(key) ? null : matrix);
  }
  const seen = new Set<Storage>();
  for (const root of roots) root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    for (const attribute of [...Object.values(object.geometry.attributes), object.geometry.index,
      ...Object.values(object.geometry.morphAttributes).flat(),
      ...(object instanceof InstancedMesh ? [object.instanceMatrix, object.instanceColor] : [])]) {
      if (!attribute) continue;
      const storage = "data" in attribute ? attribute.data : attribute;
      if (seen.has(storage)) continue;
      seen.add(storage);
      const key = staticStorageInfo(storage).bufferIdentity;
      if (exclusive.has(key) && exclusive.get(key) !== storage) exclusive.set(key, null);
    }
  });
  for (const matrix of matrices) yield [matrix, exclusive.get(staticStorageInfo(matrix).bufferIdentity) === matrix, true];
}

/** Compress the unpublished city with the browser's background codec. Each of
 * the two lanes owns at most one 256 KiB input copy. The sync generator and
 * native path install exactly the same backing and restore the same words. */
export function parkOpeningWorldBuffers(
  world: Object3D, addons: Object3D, shouldPark: ((storage: Storage) => boolean) | undefined,
  cancelled: () => boolean, yieldTask: () => Promise<void>,
): Promise<void> {
  function* inputs(): Generator<[Storage, boolean, boolean]> {
    for (const root of [world, addons]) {
      for (const [storage] of staticGeometryInputs(root, false, shouldPark)) yield [storage, false, false];
    }
    yield* staticMatrixInputs(world, [world, addons], shouldPark);
  }
  return parkBufferInputs(inputs(), 2, 5, cancelled, yieldTask);
}

/** The serial viewer queue retains the Worker ACK until this single codec lane
 * has finished the batch. Limit live codec input to one 256 KiB block during
 * camera movement, even when both building and road packets have arrived. */
export function parkAttachedWorldBuffers(
  root: Object3D, ownsGeometry: boolean, includeInstances: boolean,
  cancelled: () => boolean, yieldTask: () => Promise<void>,
): Promise<void> {
  function* inputs(): Generator<[Storage, boolean, boolean]> {
    for (const [storage, exclusive] of staticGeometryInputs(root, ownsGeometry)) {
      yield [storage, exclusive, false];
    }
    if (includeInstances) yield* staticMatrixInputs(root, [root]);
  }
  return parkBufferInputs(inputs(), 1, 4, cancelled, yieldTask);
}

async function parkBufferInputs(
  pending: Generator<[Storage, boolean, boolean]>, lanes: number, budgetMs: number,
  cancelled: () => boolean, yieldTask: () => Promise<void>,
): Promise<void> {
  let native = typeof CompressionStream === "function";
  const claimed = new WeakSet<Storage>();
  let failed = false;
  function check() {
    if (failed || cancelled()) throw new DOMException("World construction cancelled", "AbortError");
  }
  async function compress(bytes: Uint8Array) {
    if (native) {
      try {
        const stream = new CompressionStream("deflate-raw");
        const response = new Response(bytes as Uint8Array<ArrayBuffer>);
        return new Uint8Array(await new Response(response.body!.pipeThrough(stream)).arrayBuffer());
      } catch { native = false; }
    }
    return deflateSync(bytes, { level: 1 });
  }
  async function lane() {
    let deadline = performance.now() + budgetMs;
    for (;;) {
      check();
      const item = pending.next();
      if (item.done) return;
      const [storage, exclusive, matrix] = item.value;
      if (claimed.has(storage)) continue;
      claimed.add(storage);
      const steps = prepareStaticBacking(storage, exclusive, matrix);
      try {
        let next = steps.next();
        while (!next.done) {
          const packed = await compress(next.value.bytes);
          check();
          next = steps.next(packed);
          if (performance.now() >= deadline) {
            await yieldTask();
            deadline = performance.now() + budgetMs;
          }
        }
      } finally { steps.return(0); }
    }
  }
  const run = () => lane().catch(error => { failed = true; throw error; });
  const results = await Promise.allSettled(Array.from({ length: lanes }, run));
  pending.return(undefined);
  for (const result of results) if (result.status === "rejected") throw result.reason;
}
