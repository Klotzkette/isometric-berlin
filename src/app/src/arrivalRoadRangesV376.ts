import { binaryRoadBatches, decodeRoadFrame, MAX_DIRECTORY_BYTES, readRoadDirectory, type RoadEntry } from "./binaryRoadBatchesV376";
import type { RoadWordBatch } from "./roadWordPlanesV362";

const CELL_METRES = 512;
const REACH_METRES = 180;

/** District batches are physically clipped to the 512 m grid used by the road
 * generator. Include the neighbouring cell as the camera approaches its edge. */
export function arrivalRoadIdsV376(x: number, z: number): string[] {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 10_000 || Math.abs(z) > 10_000) return [];
  const nearby: { id: string; distance: number }[] = [];
  for (let ix = Math.floor((x - REACH_METRES) / CELL_METRES); ix <= Math.floor((x + REACH_METRES) / CELL_METRES); ix++) {
    for (let iz = Math.floor((z - REACH_METRES) / CELL_METRES); iz <= Math.floor((z + REACH_METRES) / CELL_METRES); iz++) {
      const dx = Math.max(ix * CELL_METRES - x, x - (ix + 1) * CELL_METRES, 0);
      const dz = Math.max(iz * CELL_METRES - z, z - (iz + 1) * CELL_METRES, 0);
      const distance = dx * dx + dz * dz;
      if (distance <= REACH_METRES * REACH_METRES) nearby.push({ id: `restored-asphalt-${ix}-${iz}`, distance });
    }
  }
  return nearby.sort((a, b) => a.distance - b.distance).map(item => item.id);
}

type Frame = { entry: RoadEntry; offset: number };
type Directory = { frames: ReadonlyMap<string, Frame>; supportsRanges: boolean };
let cached: { url: string; directory: Directory } | undefined;

async function readRange(url: string, start: number, size: number, signal: AbortSignal, fetcher: typeof fetch, allowShort = false) {
  const end = start + size - 1;
  const response = await fetcher(url, { signal, headers: { Range: `bytes=${start}-${end}` } });
  const partial = response.status === 206;
  if ((!partial && response.status !== 200) || !response.body) throw new Error(`Road range HTTP ${response.status}`);
  const reader = response.body.getReader();
  const bytes = new Uint8Array(size);
  let length = 0;
  try {
    if (partial) {
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("Content-Range") ?? "");
      if (!match || Number(match[1]) !== start || Number(match[2]) !== Math.min(end, Number(match[3]) - 1)) {
        throw new Error("Invalid road Content-Range");
      }
    }
    let skip = partial ? 0 : start;
    while (length < size) {
      const { done, value } = await reader.read();
      if (done) break;
      const offset = Math.min(value.length, skip);
      skip -= offset;
      const count = Math.min(value.length - offset, size - length);
      bytes.set(value.subarray(offset, offset + count), length);
      length += count;
    }
    if (!allowShort && length !== size) throw new Error("Truncated road range");
    return { bytes: bytes.subarray(0, length), partial };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function directoryFor(url: string, signal: AbortSignal, fetcher: typeof fetch): Promise<Directory> {
  if (cached?.url === url) return cached.directory;
  const first = await readRange(url, 0, 32 * 1024, signal, fetcher, true);
  if (first.bytes.length < 4) throw new Error("Missing road directory");
  const length = new DataView(first.bytes.buffer).getUint32(0, true);
  if (!length || length > MAX_DIRECTORY_BYTES) throw new Error("Invalid road directory length");
  const table = length + 4 <= first.bytes.length
    ? first.bytes.subarray(4, 4 + length) : (await readRange(url, 4, length, signal, fetcher)).bytes;
  const frames = new Map<string, Frame>();
  let offset = 4 + length;
  for (const entry of readRoadDirectory(table)) {
    frames.set(entry[0], { entry, offset });
    offset += entry[4];
  }
  const directory = { frames, supportsRanges: first.partial };
  cached = { url, directory };
  return directory;
}

/** On Pages and in the offline packages each request reads just one gzip frame.
 * A plain HTTP server may return 200: use one stream for the selected interval. */
export async function* fetchArrivalRoadsV376(url: string, ids: readonly string[], completed: ReadonlySet<string>, signal: AbortSignal, fetcher: typeof fetch = fetch): AsyncGenerator<RoadWordBatch> {
  const dir = await directoryFor(url, signal, fetcher);
  const frames = ids.flatMap(id => {
    const frame = dir.frames.get(id);
    return frame && !completed.has(id) ? [frame] : [];
  });
  if (frames.length === 0) return;
  if (!dir.supportsRanges) {
    const response = await fetcher(url, { signal });
    if (!response.ok || !response.body) throw new Error(`Road file HTTP ${response.status}`);
    const skipped = new Set(dir.frames.keys());
    for (const { entry } of frames) skipped.delete(entry[0]);
    let remaining = frames.length;
    for await (const batch of binaryRoadBatches(response.body, skipped)) {
      if (!completed.has(batch.id)) yield batch;
      if (--remaining === 0) return;
    }
    return;
  }
  for (const { entry, offset } of frames) {
    if (signal.aborted) throw new DOMException("Road request cancelled", "AbortError");
    if (completed.has(entry[0])) continue;
    const frame = (await readRange(url, offset, entry[4], signal, fetcher)).bytes;
    yield await decodeRoadFrame(entry, frame);
  }
}
