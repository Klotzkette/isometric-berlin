import { expect, test } from "bun:test";
import { packBinaryRoads } from "../losslessRestoredRoadSurfacesV346";
import { binaryRoadBatches } from "../src/binaryRoadBatchesV376";

const bits = Uint32Array.from([0x80000000, 0x7fc04321, 0xffffffff, 0, 0xff800000, 0x00000001]);
const xz = Buffer.from(bits.buffer).toString("base64");
const indices = Buffer.from(Uint32Array.from([1, 0, 2]).buffer).toString("base64");
const records = ["Straße-1", "Straße-2"].map(id => ({ id, kind: "paving", xz, indices }));
const header = { format: "bounded-source-road-surfaces", version: 1, batch_count: 2, encoding: "ndjson-base64-float32" };
const { bytes } = await packBinaryRoads([header, ...records].map(row => JSON.stringify(row)).join("\n"));

function stream(data: Uint8Array, chunkSize = data.length) {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= data.length) controller.close();
      else { controller.enqueue(data.subarray(offset, offset + chunkSize)); offset += chunkSize; }
    },
  }, { highWaterMark: 0 });
}

async function collect(body: ReadableStream<Uint8Array>, completed = new Set<string>()) {
  const result = [];
  for await (const row of binaryRoadBatches(body, completed)) result.push(row);
  return result;
}

test("whole and fragmented road responses restore every original coordinate and index bit", async () => {
  for (const chunk of [1, 3, 32, bytes.length]) {
    const body = stream(bytes, chunk);
    const rows = await collect(body);
    expect(rows.map(row => row.id)).toEqual(records.map(row => row.id));
    for (const row of rows) {
      expect(Buffer.from(row.xz).toString("base64")).toBe(xz);
      expect(Buffer.from(row.indices!).toString("base64")).toBe(indices);
    }
    expect(body.locked).toBeFalse();
  }
});

test("completed road batches can be skipped without inflating their payload, and cancellation unlocks the stream", async () => {
  const damaged = Buffer.from(bytes);
  const first = 4 + damaged.readUInt32LE();
  damaged.fill(0, first, first + 18);
  await expect(collect(stream(damaged))).rejects.toThrow();
  const body = stream(damaged, 3);
  const iterator = binaryRoadBatches(body, new Set([records[0].id]));
  expect((await iterator.next()).value!.id).toBe(records[1].id);
  await iterator.return(undefined);
  expect(body.locked).toBeFalse();
});

test("rejects incomplete, oversized, duplicate, dimensionally invalid and trailing road data", async () => {
  const length = bytes.readUInt32LE();
  const directory = JSON.parse(bytes.subarray(4, length + 4).toString());
  const withEntries = (entries: unknown[]) => {
    const table = Buffer.from(JSON.stringify({ ...directory, entries }));
    const size = Buffer.alloc(4); size.writeUInt32LE(table.length);
    return Buffer.concat([size, table, bytes.subarray(length + 4)]);
  };
  const [first, second] = directory.entries;
  const oversized = Buffer.alloc(4, 255);
  for (const bad of [bytes.subarray(0, 3), oversized, bytes.subarray(0, bytes.length - 1),
    withEntries([first, first]), withEntries([[...first.slice(0, 2), 1, first[3], first[4]], second]),
    withEntries([first]), Buffer.concat([bytes, Buffer.alloc(1)])]) {
    const body = stream(bad);
    await expect(collect(body)).rejects.toThrow();
    expect(body.locked).toBeFalse();
  }
});

test("both inflaters enforce gzip integrity and return identical road words", async () => {
  const native = globalThis.DecompressionStream;
  const damaged = Buffer.from(bytes);
  damaged[damaged.length - 8] ^= 1;
  try {
    for (const engine of [native, undefined]) {
      Object.defineProperty(globalThis, "DecompressionStream", { configurable: true, writable: true, value: engine });
      const rows = await collect(stream(bytes));
      expect(Buffer.from(rows[1].xz).toString("base64")).toBe(xz);
      await expect(collect(stream(damaged))).rejects.toThrow();
    }
  } finally {
    Object.defineProperty(globalThis, "DecompressionStream", { configurable: true, writable: true, value: native });
  }
});

test("camera-near streets at either side of a district boundary use the exact binary frame", async () => {
  const { arrivalRoadIdsV376, fetchArrivalRoadsV376 } = await import("../src/arrivalRoadRangesV376");
  const keys = arrivalRoadIdsV376(-2646, 1554);
  expect(keys.slice(0, 2)).toEqual(["restored-asphalt--6-3", "restored-paving--6-3"]);
  expect(arrivalRoadIdsV376(0, 0).slice(0, 2)).toEqual(["restored-asphalt-0-0", "restored-paving-0-0"]);
  expect(arrivalRoadIdsV376(-220, -780)).toContain("restored-paving--1--2");
  expect(keys).toContain("restored-asphalt--6-2");
  expect(arrivalRoadIdsV376(-3306, 726)).toContain("restored-asphalt--7-1");
  expect(arrivalRoadIdsV376(Infinity, 20)).toEqual([]);
  for (const point of [[250, -2051], [0, 0], [-512, -512]]) {
    expect(arrivalRoadIdsV376(point[0], point[1]).length).toBeLessThanOrEqual(8);
  }
  const rows = records.map((row, i) => ({ ...row, kind: i ? "paving" : "asphalt", id: keys[i] }));
  const packed = (await packBinaryRoads([header, ...rows].map(row => JSON.stringify(row)).join("\n"))).bytes;
  for (const ranges of [true, false]) {
    const requests: string[] = [];
    let active = 0, peak = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      const range = new Headers(init?.headers).get("Range");
      requests.push(range ?? "full");
      peak = Math.max(peak, ++active);
      await Promise.resolve();
      active--;
      if (!range || !ranges) return new Response(packed);
      const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(range)!;
      const start = Number(a), end = Math.min(packed.length - 1, Number(b));
      return new Response(packed.subarray(start, end + 1), {
        status: 206, headers: { "Content-Range": `bytes ${start}-${end}/${packed.length}` },
      });
    };
    const received = [];
    const url = `https://example.com/${ranges}.bin`;
    const signal = new AbortController().signal;
    for await (const row of fetchArrivalRoadsV376(url, keys, new Set([keys[1]]), signal, fetcher)) received.push(row);
    expect(received.map(row => row.id)).toEqual([keys[0]]);
    expect(Buffer.from(received[0].xz).toString("base64")).toBe(xz);
    expect(requests).toHaveLength(2);
    expect(requests[1] === "full").toBe(!ranges);
    for await (const _ of fetchArrivalRoadsV376(url, keys, new Set(keys), signal, fetcher)) throw Error("Duplicate road");
    expect(requests).toHaveLength(2);
    const centre = [];
    for await (const row of fetchArrivalRoadsV376(url, keys, new Set(), signal, fetcher)) centre.push([row.id, row.kind]);
    expect(centre).toEqual([[keys[0], "asphalt"], [keys[1], "paving"]]);
    expect(peak).toBe(ranges ? 2 : 1);
  }
});

test("a misdirected partial HTTP response is rejected before its bytes reach the road scene", async () => {
  const { fetchArrivalRoadsV376 } = await import("../src/arrivalRoadRangesV376");
  const fetcher: typeof fetch = async () => new Response(bytes, { status: 206, headers: { "Content-Range": "bytes 8-11/20" } });
  const iterator = fetchArrivalRoadsV376("https://example.com/bad.bin", ["restored-asphalt-0-0"], new Set(), new AbortController().signal, fetcher);
  await expect(iterator.next()).rejects.toThrow("Content-Range");
});
