import { decodeWordPlaneBytes } from "./losslessWordStreamV309";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { inflateRoadWordPlanes, type RoadWordBatch } from "./roadWordPlanesV362";

export const BINARY_ROAD_ENCODING = "road-delta-planes-gzip-v1";
export const MAX_DIRECTORY_BYTES = 512 * 1024;
const MAX_FRAME_BYTES = 2 * 1024 * 1024;

export type RoadEntry = [string, RoadWordBatch["kind"], number, number, number];

export function readRoadDirectory(bytes: Uint8Array): RoadEntry[] {
  const header = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (header?.format !== "bounded-source-road-surfaces" || header.version !== 1 ||
      header.encoding !== BINARY_ROAD_ENCODING || !Array.isArray(header.entries) ||
      header.entries.length !== header.batch_count) throw new Error("Invalid road directory");
  const seen = new Set<string>();
  for (const row of header.entries) {
    if (!Array.isArray(row) || row.length !== 5) throw new Error("Invalid road entry");
    const [id, kind, coords, indices, size] = row;
    if (typeof id !== "string" || !id || seen.has(id) || !["asphalt", "paving", "kerbs"].includes(kind) ||
        !Number.isSafeInteger(coords) || coords < 0 || coords % (kind === "kerbs" ? 16 : 8) ||
        !Number.isSafeInteger(indices) || indices < 0 || indices % 12 || (kind === "kerbs" && indices !== 0) ||
        coords + indices > MAX_FRAME_BYTES || !Number.isSafeInteger(size) || size < 18 || size > MAX_FRAME_BYTES) {
      throw new Error("Invalid road entry");
    }
    seen.add(id);
  }
  return header.entries;
}

/** Native gzip checks CRC32 and the end-of-stream length. Bound the decoded
 * writes as they arrive, before any road geometry is created. */
async function inflateFrame(frame: Uint8Array, size: number): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === "undefined") return inflateRoadWordPlanes(frame, size);
  const footer = new DataView(frame.buffer, frame.byteOffset + frame.length - 4, 4);
  if (footer.getUint32(0, true) !== size) throw new Error("Invalid packed road gzip size");
  const input = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(frame); controller.close(); },
  });
  const inflater = new DecompressionStream("gzip") as ReadableWritablePair<Uint8Array, Uint8Array>;
  const reader = input.pipeThrough(inflater).getReader();
  const result = new Uint8Array(size);
  let written = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (written + value.length > size) throw new Error("Invalid expanded road size");
      result.set(value, written);
      written += value.length;
    }
    if (written !== size) throw new Error("Truncated expanded road frame");
    return result;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function decodeRoadFrame(row: RoadEntry, frame: Uint8Array): Promise<RoadWordBatch> {
  const [id, kind, coords, indices, size] = row;
  if (frame.byteLength !== size) throw new Error("Truncated road frame");
  const planes = await inflateFrame(frame, coords + indices);
  try {
    const xz = decodeWordPlaneBytes(planes.subarray(0, coords), coords / 4, 2).buffer;
    return kind === "kerbs" ? { id, kind, xz } : {
      id, kind, xz, indices: decodeWordPlaneBytes(planes.subarray(coords), indices / 4, 1).buffer,
    };
  } finally {
    releaseScratchBuffer(planes.buffer);
  }
}

/** A cached response can arrive in one chunk. Borrow whole frames in place and
 * copy only when a network boundary falls inside a frame. */
export async function* binaryRoadBatches(body: ReadableStream<Uint8Array>, completed: ReadonlySet<string>): AsyncGenerator<RoadWordBatch> {
  const reader = body.getReader();
  let pending: Uint8Array = new Uint8Array();
  async function refill(): Promise<boolean> {
    while (!pending.length) {
      const result = await reader.read();
      if (result.done) return false;
      pending = result.value;
    }
    return true;
  }
  async function take(size: number): Promise<Uint8Array> {
    if (!await refill()) throw new Error("Truncated road file");
    if (pending.length >= size) {
      const frame = pending.subarray(0, size);
      pending = pending.subarray(size);
      return frame;
    }
    const frame = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      if (!await refill()) throw new Error("Truncated road frame");
      const n = Math.min(size - offset, pending.length);
      frame.set(pending.subarray(0, n), offset);
      offset += n;
      pending = pending.subarray(n);
    }
    return frame;
  }
  try {
    const prefix = await take(4);
    const length = new DataView(prefix.buffer, prefix.byteOffset, 4).getUint32(0, true);
    if (!length || length > MAX_DIRECTORY_BYTES) throw new Error("Invalid road directory length");
    const entries = readRoadDirectory(await take(length));
    for (const entry of entries) {
      const frame = await take(entry[4]);
      if (!completed.has(entry[0])) yield await decodeRoadFrame(entry, frame);
    }
    if (await refill()) throw new Error("Trailing road data");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
