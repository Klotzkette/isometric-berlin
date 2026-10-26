import { expect, test } from "bun:test";
import { BufferGeometry, Mesh, OrthographicCamera } from "three";
import { createSurroundingCity, disposeSurroundingCityRoot, type SurroundingCityManifest } from "../src/SurroundingCity";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { fetchSurroundingTransport, SurroundingTransportTimeout } from "../src/surroundingTransport";

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, ms = 1500): Promise<void> {
  const deadline = performance.now() + ms;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error("Streaming did not make bounded progress");
    await pause(2);
  }
}
const url = new URL("https://example.test/manifest.json");
const enc = new TextEncoder();
const encode = (array: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(array.buffer).toString("base64");
function packet(x = 0): SurroundingCityChunk {
  return { schemaVersion: 1, origin: [x, 0, 0],
    meshes: [{ kind: "ground", positionType: "u16cm",
      positions: encode(new Uint16Array([0, 300, 0, 10000, 300, 0, 0, 300, 10000])),
      colors: encode(new Uint8Array([120, 140, 90, 120, 140, 90, 120, 140, 90])),
      indices: encode(new Uint32Array([0, 1, 2])) }],
    nav: { groundY: 3, ground: [], buildings: [], water: [] } };
}
function manifest(count = 4): SurroundingCityManifest {
  return { schemaVersion: 1, groundY: 3, footprint: [],
    chunks: Array.from({ length: count }, (_, id) => ({ id: `tile-${id}`, bounds: [id * 100, 0, id * 100 + 100, 100],
      drawn: { url: `${id}.json`, bytes: JSON.stringify(packet(id * 100)).length },
      minecraft: { url: `${id}.native.json`, bytes: JSON.stringify(packet(id * 100)).length } })) };
}
function view(): OrthographicCamera {
  const camera = new OrthographicCamera(-1000, 1000, 1000, -1000, 1, 3000);
  camera.position.set(50, 500, 50); camera.up.set(0, 0, -1); camera.lookAt(50, 0, 50); camera.updateMatrixWorld();
  return camera;
}
const response = (data: unknown) => new Response(JSON.stringify(data));
const never = <T>(): Promise<T> => new Promise(() => undefined);
const fetcher = (fn: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>): typeof fetch => fn as typeof fetch;

function exactGeometry(root: import("three").Group, id: number): void {
  const expected = createSurroundingCityChunk(packet(id * 100), `tile-${id}`);
  try {
    const actual = root.children.map(child => (child as Mesh).geometry).filter(Boolean) as BufferGeometry[];
    const reference = expected.root.children.map(child => (child as Mesh).geometry).filter(Boolean) as BufferGeometry[];
    expect(actual.length).toBe(reference.length);
    for (let i = 0; i < actual.length; i++) {
      expect(actual[i].getAttribute("position").array).toEqual(reference[i].getAttribute("position").array);
      expect(actual[i].getAttribute("color").array).toEqual(reference[i].getAttribute("color").array);
      expect(actual[i].index?.array).toEqual(reference[i].index?.array);
    }
  } finally { disposeSurroundingCityRoot(expected.root); }
}

test("a stalled fetch times out, aborts transport, and cancels a late response", async () => {
  const owner = new AbortController(); let network: AbortSignal | undefined;
  let finish: (response: Response) => void = () => undefined; let cancelled = false;
  const request = fetchSurroundingTransport(fetcher(async (_input, init) => {
    network = init!.signal!;
    return new Promise<Response>(resolve => { finish = resolve; });
  }), url, owner.signal, {}, 25);
  await expect(request).rejects.toBeInstanceOf(SurroundingTransportTimeout);
  expect(network!.aborted).toBeTrue(); expect(owner.signal.aborted).toBeFalse();
  finish(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await until(() => cancelled);
});

test("a stalled body releases even when underlying cancellation never settles", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode("first")); },
    cancel() { cancelled = true; return never(); } });
  const transport = await fetchSurroundingTransport(fetcher(async () => new Response(stream)), url, new AbortController().signal, {}, 25);
  const reader = transport.body.getReader();
  expect((await reader.read()).value).toEqual(enc.encode("first"));
  await expect(reader.read()).rejects.toBeInstanceOf(SurroundingTransportTimeout);
  expect(cancelled).toBeTrue();
  reader.releaseLock();
});

test("continued nonempty transport progress may exceed the inactivity duration", async () => {
  let part = 0;
  const transport = await fetchSurroundingTransport(fetcher(async () => new Response(new ReadableStream<Uint8Array>({
    async pull(c) { await pause(12); if (part < 8) c.enqueue(enc.encode(String(part++))); else c.close(); },
  }, { highWaterMark: 0 }))), url, new AbortController().signal, {}, 45);
  const started = performance.now();
  expect(await new Response(transport.body).text()).toBe("01234567");
  expect(performance.now() - started).toBeGreaterThan(80);
});

test("empty chunks do not extend a stalled transport deadline", async () => {
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(c) { timer = setInterval(() => c.enqueue(new Uint8Array()), 3); },
    cancel() { clearInterval(timer); },
  });
  const transport = await fetchSurroundingTransport(fetcher(async () => new Response(stream)), url, new AbortController().signal, {}, 25);
  try { await expect(new Response(transport.body).text()).rejects.toBeInstanceOf(SurroundingTransportTimeout); }
  finally { clearInterval(timer); }
});

test("consumer work between transport reads has no wall-clock deadline", async () => {
  let sent = false;
  const transport = await fetchSurroundingTransport(fetcher(async () => new Response(new ReadableStream<Uint8Array>({
    pull(c) { if (!sent) { sent = true; c.enqueue(enc.encode("bytes")); } else c.close(); },
  }, { highWaterMark: 0 }))), url, new AbortController().signal, {}, 20);
  const reader = transport.body.getReader();
  expect((await reader.read()).value).toEqual(enc.encode("bytes"));
  await pause(65);
  expect((await reader.read()).done).toBeTrue(); reader.releaseLock();
});

test("parent cancellation interrupts a noncooperating fetch and body read immediately", async () => {
  for (const stage of ["fetch", "body"] as const) {
    const owner = new AbortController();
    const transport = fetchSurroundingTransport(fetcher(async () => stage === "fetch" ? never() :
      new Response(new ReadableStream({ cancel() { return never(); } }))), url, owner.signal, {}, 1000);
    const pending = stage === "fetch" ? transport : new Response((await transport).body).text();
    owner.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  }
});

test("stalled foreground releases the serial queue, preserves exact geometry and retries after cooldown", async () => {
  let clock = 0; const calls: string[] = [], errors: string[] = [];
  const city = createSurroundingCity({ camera: view(), manifestUrl: url, now: () => clock, transportIdleMs: 30,
    onError: message => errors.push(message), fetch: fetcher(async input => {
      const path = new URL(String(input)).pathname; calls.push(path);
      if (path.endsWith("manifest.json")) return response(manifest());
      if (path === "/0.json" && calls.filter(p => p === path).length === 1) return new Response(new ReadableStream({ cancel() { return never(); } }));
      return response(packet(Number(path.slice(1).split(".")[0]) * 100));
    }) });
  try {
    await city.ready;
    await until(() => !city.pending);
    expect(city.residentChunkCount).toBe(3); expect(errors).toHaveLength(1);
    expect(calls.filter(path => path === "/0.json")).toHaveLength(1);
    for (let i = 1; i <= 3; i++) exactGeometry(city.root.children[i - 1] as import("three").Group, i);
    clock = 29_000; city.refresh(clock); await pause(15);
    expect(calls.filter(path => path === "/0.json")).toHaveLength(1);
    clock = 31_000; city.refresh(clock); await until(() => !city.pending);
    expect(city.residentChunkCount).toBe(4); expect(calls.filter(path => path === "/0.json")).toHaveLength(2);
    exactGeometry(city.root.children[3] as import("three").Group, 0);
  } finally { city.dispose(); }
});

test("a prefetched stalled response cannot block the promoted queue", async () => {
  const calls: string[] = [], errors: string[] = [];
  const city = createSurroundingCity({ camera: view(), manifestUrl: url, transportIdleMs: 35,
    onError: message => errors.push(message), fetch: fetcher(async input => {
      const path = new URL(String(input)).pathname; calls.push(path);
      if (path.endsWith("manifest.json")) return response(manifest());
      if (path === "/1.json") return never();
      if (path === "/0.json") await pause(10);
      return response(packet(Number(path.slice(1).split(".")[0]) * 100));
    }) });
  try {
    await city.ready; await until(() => !city.pending);
    expect(city.residentChunkCount).toBe(3); expect(errors).toHaveLength(1);
    expect(calls.filter(p => p === "/1.json")).toHaveLength(1);
    exactGeometry(city.root.children[0] as import("three").Group, 0);
    exactGeometry(city.root.children[1] as import("three").Group, 2);
    exactGeometry(city.root.children[2] as import("three").Group, 3);
  } finally { city.dispose(); }
});

test("manifest inactivity uses the existing bounded retry lane", async () => {
  let attempts = 0;
  const errors: string[] = [];
  const city = createSurroundingCity({ camera: view(), manifestUrl: url, transportIdleMs: 20,
    onError: message => errors.push(message), fetch: fetcher(async input => {
      if (String(input).endsWith("manifest.json")) { attempts++; if (attempts === 1) return never(); return response(manifest(1)); }
      return response(packet());
    }) });
  try {
    await city.ready; await until(() => !city.pending);
    expect(attempts).toBe(2); expect(city.residentChunkCount).toBe(1); expect(errors).toEqual([]);
  } finally { city.dispose(); }
});

async function withVisibility(action: (doc: EventTarget & { visibilityState: string }, win: EventTarget) => Promise<void>) {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document"), oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" }), win = new EventTarget();
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  try { await action(doc, win); }
  finally {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
  }
}

test("hidden and pagehide cancellation resume without failure cooldown or resident loss", async () => {
  await withVisibility(async (doc, win) => {
    for (const event of ["visibilitychange", "pagehide"]) {
      let blocked = true; const errors: string[] = [], signals: AbortSignal[] = [];
      const city = createSurroundingCity({ camera: view(), manifestUrl: url, transportIdleMs: 35,
        onError: message => errors.push(message), fetch: fetcher(async (input, init) => {
          if (String(input).endsWith("manifest.json")) return response(manifest(2));
          signals.push(init!.signal!);
          if (String(input).endsWith("1.json") && blocked) return never();
          return response(packet());
        }) });
      try {
        await city.ready; await until(() => city.residentChunkCount === 1);
        const retained = city.root.children[0];
        if (event === "visibilitychange") { doc.visibilityState = "hidden"; doc.dispatchEvent(new Event(event)); }
        else win.dispatchEvent(new Event(event));
        await until(() => !city.pending);
        await pause(60); expect(errors).toEqual([]); expect(city.root.children[0]).toBe(retained);
        expect(signals.some(signal => signal.aborted)).toBeTrue(); blocked = false;
        if (event === "visibilitychange") { doc.visibilityState = "visible"; doc.dispatchEvent(new Event(event)); }
        else win.dispatchEvent(new Event("pageshow"));
        await until(() => city.residentChunkCount === 2 && !city.pending);
        expect(city.root.children[0]).toBe(retained); expect(errors).toEqual([]);
      } finally { city.dispose(); }
    }
  });
});

test("a hidden manifest attempt resumes without consuming its retry or waiting 500ms", async () => {
  await withVisibility(async doc => {
    let calls = 0;
    const city = createSurroundingCity({ camera: view(), manifestUrl: url, transportIdleMs: 30,
      fetch: fetcher(async input => {
        if (String(input).endsWith("manifest.json")) { calls++; return calls === 1 ? never() : response(manifest(1)); }
        return response(packet());
      }) });
    try {
      await until(() => calls === 1);
      doc.visibilityState = "hidden"; doc.dispatchEvent(new Event("visibilitychange"));
      await pause(50); expect(calls).toBe(1);
      doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange"));
      await until(() => city.residentChunkCount === 1 && !city.pending, 200);
      expect(calls).toBe(2); await city.ready;
    } finally { city.dispose(); }
  });
});

test("disposing an initially hidden viewer settles ready without a fetch", async () => {
  await withVisibility(async doc => {
    doc.visibilityState = "hidden"; let calls = 0;
    const city = createSurroundingCity({ camera: view(), manifestUrl: url,
      fetch: fetcher(async () => { calls++; return never(); }) });
    city.dispose(); await city.ready;
    expect(calls).toBe(0); expect(city.pending).toBeFalse();
  });
});
