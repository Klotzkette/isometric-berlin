import { expect, spyOn, test } from "bun:test";
import { BufferGeometry, Material, InterleavedBufferAttribute, LineSegments, Mesh, OrthographicCamera, Scene, Vector3 } from "three";
import {
  createSurroundingCityChunk, createSurroundingCityChunkCooperatively, surroundingBuildingSolidAt,
  type SurroundingCityChunk, type SurroundingNavigation,
} from "../src/SurroundingCityGeometry";
import {
  createSurroundingCity, disposeSurroundingCityRoot, validateSurroundingManifest,
  type SurroundingCityManifest,
} from "../src/SurroundingCity";

const encode = (array: Uint8Array | Uint16Array | Uint32Array): string =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
const rectangle = (x0: number, z0: number, x1: number, z1: number) => ({
  ring: [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], holes: [] as number[][][],
});
function sample(x = 0): SurroundingCityChunk {
  return {
    schemaVersion: 1, origin: [x, -10, 0],
    meshes: [{ kind: "ground", positionType: "u16cm",
      positions: encode(new Uint16Array([0, 1300, 0, 51200, 1300, 0, 0, 1300, 51200])),
      colors: encode(new Uint8Array([128, 64, 32, 128, 64, 32, 128, 64, 32])),
      indices: encode(new Uint32Array([0, 1, 2])) }],
    lines: { positions: encode(new Uint16Array([0, 1300, 0, 51200, 1300, 0])) },
    nav: { groundY: 3, ground: [rectangle(0, 0, 512, 512)],
      buildings: [{ ...rectangle(50, 50, 100, 100), height: 20, minHeight: 0, sourceId: "way/1" }],
      water: [rectangle(300, 300, 400, 400)], roads: [rectangle(100, 0, 115, 512)] },
  };
}
function manifest(): SurroundingCityManifest {
  return {
    schemaVersion: 1, groundY: 3,
    footprint: [rectangle(0, 0, 512, 512), rectangle(2048, 0, 2560, 512)],
    chunks: [0, 2048].map(x => ({
      id: `tile-${x}`, bounds: [x, 0, x + 512, 512] as [number, number, number, number],
      drawn: { url: `drawn/${x}.json`, bytes: JSON.stringify(sample(x)).length },
      minecraft: { url: `minecraft/${x}.json`, bytes: JSON.stringify(sample(x)).length },
    })),
  };
}
function camera(x = 256, width = 550) {
  const value = new OrthographicCamera(-width / 2, width / 2, 300, -300, 1, 3000);
  value.position.set(x, 500, 256); value.up.set(0, 0, -1); value.lookAt(x, 0, 256);
  value.updateMatrixWorld(); return value;
}
async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error("Timed out waiting for bounded outline loader");
}
const response = (data: unknown): Response => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
function sourceFetch(calls: string[] = []): typeof fetch {
  return (async (input: URL | RequestInfo) => {
    const path = new URL(String(input)).pathname; calls.push(path);
    return response(path.endsWith("manifest.json") ? manifest() : sample(path.endsWith("2048.json") ? 2048 : 0));
  }) as typeof fetch;
}

test("streamed city leaves unchanged world transforms cached across rendered frames", async () => {
  const city = createSurroundingCity({
    manifestUrl: new URL("https://example.test/manifest.json"),
    camera: camera(), fetch: sourceFetch(),
  });
  try {
    await city.ready;
    await until(() => city.residentChunkCount > 0 && !city.pending);
    const scene = new Scene();
    scene.matrixAutoUpdate = false;
    scene.add(city.root);
    scene.updateMatrixWorld();
    const child = city.root.children[0].children[0];
    const expected = child.matrixWorld.clone();
    const multiply = spyOn(child.matrixWorld, "multiplyMatrices");
    try {
      for (let frame = 0; frame < 120; frame++) scene.updateMatrixWorld();
      expect(multiply).not.toHaveBeenCalled();
      expect(child.matrixWorld.equals(expected)).toBeTrue();
    } finally { multiply.mockRestore(); }
  } finally { city.dispose(); }
});

test("centimetre geometry preserves exact topology, colour, world coordinates and at most three GL buffers", () => {
  const result = createSurroundingCityChunk(sample(2048), "first");
  const mesh = result.root.children[0] as Mesh;
  const position = mesh.geometry.getAttribute("position") as InterleavedBufferAttribute;
  const color = mesh.geometry.getAttribute("color") as InterleavedBufferAttribute;
  expect(position.data).toBe(color.data);
  expect(position.data.array).toBeInstanceOf(Uint16Array);
  expect(position.normalized).toBeFalse(); expect(color.normalized).toBeTrue();
  expect(position.getX(1)).toBe(51200);
  expect(color.getX(0)).toBeCloseTo(128 / 255, 14);
  expect(color.getY(0)).toBeCloseTo(64 / 255, 14);
  expect(Array.from(mesh.geometry.index!.array)).toEqual([0, 1, 2]);
  result.root.updateMatrixWorld(true);
  const world = new Vector3().fromBufferAttribute(position, 1).applyMatrix4(mesh.matrixWorld);
  expect(world.toArray()).toEqual([2560, 3, 0]);
  expect(mesh.geometry.getAttribute("normal")).toBeUndefined();
  expect(mesh.matrixAutoUpdate).toBeFalse();
  expect(result.root.children[1]).toBeInstanceOf(LineSegments);
  expect(result.bufferCount).toBe(3);
  expect(result.geometryBytes).toBe(3 * 12 + 3 * 2 + 2 * 6);
  disposeSurroundingCityRoot(result.root);
});

test("several source kinds merge into one mesh without rewriting any source triangle", () => {
  const chunk = sample(); chunk.meshes.push({ ...chunk.meshes[0], kind: "building" });
  const result = createSurroundingCityChunk(chunk, "merged");
  const mesh = result.root.children[0] as Mesh;
  expect(result.root.children.filter(child => child instanceof Mesh)).toHaveLength(1);
  expect(Array.from(mesh.geometry.index!.array)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(mesh.geometry.getAttribute("position").count).toBe(6);
  expect(result.bufferCount).toBe(3);
  disposeSurroundingCityRoot(result.root);
});

test("WebGL2 primitive-restart index 65535 keeps Uint32 topology instead of losing triangles", () => {
  const chunk = sample();
  const positions = new Uint16Array(65_536 * 3);
  const colors = new Uint8Array(65_536 * 3);
  positions.set([10, 10, 10], positions.length - 3);
  chunk.meshes[0] = { kind: "building", positionType: "u16cm", positions: encode(positions),
    colors: encode(colors), indices: encode(new Uint32Array([0, 1, 65_535])) };
  const result = createSurroundingCityChunk(chunk, "index-boundary");
  const index = (result.root.children[0] as Mesh).geometry.index!;
  expect(index.array).toBeInstanceOf(Uint32Array);
  expect(Array.from(index.array)).toEqual([0, 1, 65_535]);
  disposeSurroundingCityRoot(result.root);
});

test("light kerbs and dark roof contours retain their separate source colours in one ink buffer", () => {
  const chunk = sample();
  chunk.lines!.colors = encode(new Uint8Array([64, 32, 16, 200, 210, 220]));
  const result = createSurroundingCityChunk(chunk, "ink");
  const ink = result.root.children[1] as LineSegments;
  const position = ink.geometry.getAttribute("position") as InterleavedBufferAttribute;
  const color = ink.geometry.getAttribute("color") as InterleavedBufferAttribute;
  expect(position.data).toBe(color.data);
  expect(color.getX(0)).toBeCloseTo(64 / 255, 14);
  expect(color.getZ(1)).toBeCloseTo(220 / 255, 14);
  expect(result.bufferCount).toBe(3);
  expect(result.geometryBytes).toBe(66);
  disposeSurroundingCityRoot(result.root);
});

test("native Minecraft uses its separate payload and no smooth ink duplicate", () => {
  const result = createSurroundingCityChunk(sample(), "native", true);
  expect(result.root.userData.nativeMinecraft).toBeTrue();
  expect(result.root.children).toHaveLength(1);
  expect(result.bufferCount).toBe(2);
  expect(result.root.children.some(child => child instanceof LineSegments)).toBeFalse();
  disposeSurroundingCityRoot(result.root);
});

test("corrupt indices and mismatched attribute counts cannot publish partial geometry", () => {
  const chunk = sample(); chunk.meshes[0].indices = encode(new Uint32Array([0, 1, 50]));
  expect(() => createSurroundingCityChunk(chunk, "invalid")).toThrow("index exceeds");
  chunk.meshes[0].colors = encode(new Uint8Array([1, 2, 3]));
  expect(() => createSurroundingCityChunk(chunk, "invalid")).toThrow("colour count");
  const malformed = manifest(); malformed.chunks[0].drawn.url = "../../another.json";
  expect(() => validateSurroundingManifest(malformed)).toThrow("descriptor");
});

test("building collision preserves courtyard holes, height clearance and a bounded wall radius", () => {
  const nav: SurroundingNavigation = {
    groundY: 3, ground: [], water: [], buildings: [{
      ...rectangle(0, 0, 20, 20), holes: [rectangle(5, 5, 15, 15).ring], height: 20, minHeight: 2, sourceId: "way/2",
    }],
  };
  expect(surroundingBuildingSolidAt(nav, 3, 6, 3)).toBeTrue();
  expect(surroundingBuildingSolidAt(nav, 10, 6, 10, .3)).toBeFalse();
  expect(surroundingBuildingSolidAt(nav, 5.1, 6, 10, .3)).toBeTrue();
  expect(surroundingBuildingSolidAt(nav, 3, 4, 3)).toBeFalse();
  expect(surroundingBuildingSolidAt(nav, 3, 24, 3)).toBeFalse();
});

test("moving to a new district releases old geometry and navigation, then reloads on return", async () => {
  const view = camera(), calls: string[] = [], released: string[] = [];
  let clock = 0;
  const city = createSurroundingCity({ camera: view, manifestUrl: new URL("https://example.test/mesh/manifest.json"),
    fetch: sourceFetch(calls), now: () => clock, retireMs: 0,
    onRelease(root) { released.push(root.name); disposeSurroundingCityRoot(root); } });
  await city.ready; await until(() => !city.pending);
  expect(city.residentChunkCount).toBe(1);
  expect(city.groundAt(5, 5)).toBe(3);
  expect(city.groundAt(1000, 5)).toBeNull();
  expect(city.waterAt(350, 350)).toBeTrue();
  expect(city.solidAt(75, 8, 75)).toBeTrue();
  expect(city.navigationTiles).toHaveLength(1);
  const oldNav = city.navigationTiles[0].nav;
  clock = 1000; view.position.x = 2304; view.lookAt(2304, 0, 256); city.refresh(clock);
  await until(() => !city.pending);
  expect(city.residentChunkCount).toBe(1);
  expect(released).toHaveLength(1);
  expect(city.navigationTiles[0].nav).not.toBe(oldNav);
  expect(city.solidAt(75, 8, 75)).toBeFalse();
  clock = 2000; view.position.x = 256; view.lookAt(256, 0, 256); city.refresh(clock);
  await until(() => !city.pending);
  expect(calls.filter(path => path.endsWith("drawn/0.json"))).toHaveLength(2);
  city.dispose();
  expect(city.residentGeometryBytes).toBe(0); expect(city.residentBufferCount).toBe(0);
  expect(city.residentChunkCount).toBe(0); expect(city.navigationTiles).toHaveLength(0);
});

test("only one fetch/decode is active even with multiple visible chunks and mode changes", async () => {
  const view = camera(1280, 4000);
  let releaseFetch: (() => void) | undefined, active = 0, peak = 0;
  const calls: string[] = [];
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("manifest.json")) return response(manifest());
    calls.push(path); active++; peak = Math.max(peak, active);
    try {
      if (calls.length === 1) await new Promise<void>((resolve, reject) => {
        releaseFetch = resolve;
        init?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
      });
      return response(sample(path.endsWith("2048.json") ? 2048 : 0));
    } finally { active--; }
  }) as typeof fetch;
  const city = createSurroundingCity({ camera: view, manifestUrl: new URL("https://example.test/manifest.json"), fetch: fetcher });
  await city.ready; await until(() => calls.length === 1);
  expect(city.residentChunkCount).toBe(0); expect(peak).toBe(1);
  city.setMode("minecraft"); releaseFetch?.();
  await until(() => !city.pending);
  expect(peak).toBe(1);
  expect(city.residentChunkCount).toBe(2);
  expect(city.root.children.every(child => child.userData.nativeMinecraft === true)).toBeTrue();
  expect(calls.filter(path => path.includes("minecraft"))).toHaveLength(2);
  city.dispose();
});

test("a Day to Schwellenraum change retains the exact same geometry and source request", async () => {
  const calls: string[] = [];
  const city = createSurroundingCity({ camera: camera(), manifestUrl: new URL("https://example.test/manifest.json"), fetch: sourceFetch(calls) });
  await city.ready; await until(() => !city.pending);
  const first = city.root.children[0];
  city.setMode("schwellenraum"); city.setMode("night"); city.setMode("snowstorm");
  expect(city.root.children[0]).toBe(first);
  expect(calls).toHaveLength(2);
  city.dispose();
});

test("an aborted pending load cannot resurrect a disposed viewer", async () => {
  let finish: (() => void) | undefined;
  const city = createSurroundingCity({ camera: camera(), manifestUrl: new URL("https://example.test/manifest.json"),
    fetch: (async () => { await new Promise<void>(resolve => { finish = resolve; }); return response(manifest()); }) as typeof fetch });
  city.dispose(); finish?.(); await city.ready;
  expect(city.manifest).toBeNull(); expect(city.root.children).toHaveLength(0);
  expect(city.residentBufferCount).toBe(0);
});

test("retirement budgets never remove a tile that is still in the wide visible view", async () => {
  const city = createSurroundingCity({ camera: camera(1280, 4000), manifestUrl: new URL("https://example.test/manifest.json"),
    fetch: sourceFetch(), residentBudgetBytes: 1, retireMs: 0 });
  await city.ready; await until(() => !city.pending);
  city.refresh(performance.now() + 1000);
  expect(city.residentChunkCount).toBe(2);
  expect(city.residentBufferCount).toBe(6);
  city.dispose();
});

async function compressedCity(options: { fallback?: boolean; decodedHeader?: boolean; declaredDelta?: number } = {}) {
  const payload = JSON.stringify(sample());
  const packed = Bun.gzipSync(payload);
  const data = manifest();
  data.chunks = [data.chunks[0]];
  data.chunks[0].drawn = { url: "0.drawn.json.gz", bytes: packed.byteLength,
    encoding: "gzip", decodedBytes: new TextEncoder().encode(payload).byteLength + (options.declaredDelta ?? 0) };
  const errors: string[] = [];
  const original = globalThis.DecompressionStream;
  if (options.fallback) Object.defineProperty(globalThis, "DecompressionStream", { value: undefined, configurable: true });
  const city = createSurroundingCity({ camera: camera(), manifestUrl: new URL("https://example.test/manifest.json"),
    onError(message) { errors.push(message); },
    fetch: (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("manifest.json")) return response(data);
      return options.decodedHeader
        ? new Response(payload, { headers: { "Content-Encoding": "gzip" } })
        : new Response(packed);
    }) as typeof fetch });
  try { await city.ready; await until(() => !city.pending); }
  finally { if (options.fallback) Object.defineProperty(globalThis, "DecompressionStream", { value: original, configurable: true }); }
  return { city, errors };
}

test("lossless gzip chunks decode through the browser stream with identical geometry", async () => {
  const { city, errors } = await compressedCity();
  expect(errors).toHaveLength(0);
  expect(city.residentChunkCount).toBe(1);
  expect(city.residentBufferCount).toBe(3);
  expect(city.groundAt(5, 5)).toBe(3);
  city.dispose();
});

test("older browsers use the bounded bundled inflater without retaining compressed source", async () => {
  const { city, errors } = await compressedCity({ fallback: true });
  expect(errors).toHaveLength(0);
  expect(city.residentChunkCount).toBe(1);
  expect(city.residentGeometryBytes).toBe(54);
  city.dispose(); expect(city.residentGeometryBytes).toBe(0);
});

test("HTTP gzip decoded by Fetch is not decoded a second time", async () => {
  const { city, errors } = await compressedCity({ decodedHeader: true });
  expect(errors).toHaveLength(0);
  expect(city.residentChunkCount).toBe(1);
  city.dispose();
});

test("gzip size violations publish no partial geometry in either browser path", async () => {
  for (const fallback of [false, true]) {
    const { city, errors } = await compressedCity({ fallback, declaredDelta: -5 });
    expect(errors).toHaveLength(1);
    expect(city.residentChunkCount).toBe(0);
    expect(city.residentGeometryBytes).toBe(0);
    city.dispose();
  }
});

test("mapped bridge courses remain walkable over water without opening the entire river", async () => {
  const tile = sample();
  tile.nav.bridges = [rectangle(330, 290, 345, 410)];
  const data = manifest(); data.chunks = [data.chunks[0]];
  data.chunks[0].drawn.bytes = JSON.stringify(tile).length;
  const city = createSurroundingCity({ camera: camera(), manifestUrl: new URL("https://example.test/manifest.json"),
    fetch: (async (input: RequestInfo | URL) => response(String(input).endsWith("manifest.json") ? data : tile)) as typeof fetch });
  await city.ready; await until(() => !city.pending);
  expect(city.waterAt(340, 350)).toBeFalse();
  expect(city.waterAt(360, 350)).toBeTrue();
  expect(city.groundAt(110, 100)).toBe(3.09);
  city.dispose();
});

test("a transient manifest error retries before giving up on surrounding coverage", async () => {
  let attempts = 0;
  const errors: string[] = [];
  const normal = sourceFetch();
  const city = createSurroundingCity({ camera: camera(), manifestUrl: new URL("https://example.test/manifest.json"),
    onError: message => errors.push(message), fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("manifest.json") && ++attempts === 1) return new Response("try again", { status: 503 });
      return normal(input, init);
    }) as typeof fetch });
  await city.ready; await until(() => !city.pending);
  expect(attempts).toBe(2); expect(errors).toHaveLength(0);
  expect(city.residentChunkCount).toBe(1); city.dispose();
});

test("disposing during a manifest retry clears the timer and settles ready", async () => {
  let attempts = 0;
  const city = createSurroundingCity({ camera: camera(), manifestUrl: new URL("https://example.test/manifest.json"),
    fetch: (async () => { attempts++; return new Response("busy", { status: 503 }); }) as typeof fetch });
  await until(() => attempts === 1);
  await new Promise(resolve => setTimeout(resolve, 2));
  city.dispose(); await city.ready;
  expect(attempts).toBe(1); expect(city.manifest).toBeNull();
});


test("cooperative chunk loading preserves exact buffers, source navigation and THREE bounds", async () => {
  const chunk = sample();
  const positions = new Uint16Array(24_576 * 3), colors = new Uint8Array(positions.length);
  for (let i = 0; i < positions.length; i++) { positions[i] = i * 37 % 60_001; colors[i] = i % 256; }
  chunk.meshes.push({ kind: "building", positionType: "u16cm", positions: encode(positions),
    colors: encode(colors), indices: encode(Uint32Array.from({ length: 24_576 }, (_, i) => i)) });
  chunk.lines = { positions: encode(positions), colors: encode(colors) };
  for (const minecraft of [false, true]) {
    const synchronous = createSurroundingCityChunk(chunk, "exact", minecraft);
    let yields = 0;
    const cooperative = await createSurroundingCityChunkCooperatively(chunk, "exact", minecraft,
      { budgetMs: 0, yield: async () => { yields++; } });
    expect(yields).toBeGreaterThan(20);
    expect(cooperative.nav).toBe(chunk.nav);
    expect(cooperative.geometryBytes).toBe(synchronous.geometryBytes);
    expect(cooperative.bufferCount).toBe(synchronous.bufferCount);
    expect(cooperative.root.children).toHaveLength(synchronous.root.children.length);
    for (let i = 0; i < cooperative.root.children.length; i++) {
      const mesh = cooperative.root.children[i] as Mesh;
      const expected = synchronous.root.children[i] as Mesh;
      const position = mesh.geometry.getAttribute("position") as InterleavedBufferAttribute;
      const reference = expected.geometry.getAttribute("position") as InterleavedBufferAttribute;
      expect(position.data.array).toEqual(reference.data.array);
      expect(mesh.geometry.index?.array).toEqual(expected.geometry.index?.array);
      expect(mesh.geometry.boundingBox).toEqual(expected.geometry.boundingBox);
      expect(mesh.geometry.boundingSphere).toEqual(expected.geometry.boundingSphere);
      // Independently compare the cooperative bounds to THREE's original full scans.
      expected.geometry.computeBoundingBox(); expected.geometry.computeBoundingSphere();
      expect(mesh.geometry.boundingBox).toEqual(expected.geometry.boundingBox);
      expect(mesh.geometry.boundingSphere).toEqual(expected.geometry.boundingSphere);
      expect(mesh.matrixAutoUpdate).toBeFalse();
      expect(mesh.matrix).toEqual(expected.matrix);
    }
    disposeSurroundingCityRoot(synchronous.root); disposeSurroundingCityRoot(cooperative.root);
  }
});

test("cooperative work yields by elapsed budget instead of a timer for every stream", async () => {
  let yields = 0, clock = 0;
  const result = await createSurroundingCityChunkCooperatively(sample(), "budget", false,
    { budgetMs: 3, now: () => ++clock, yield: async () => { yields++; } });
  expect(yields).toBe(2);
  disposeSurroundingCityRoot(result.root);
  yields = 0;
  const fast = await createSurroundingCityChunkCooperatively(sample(), "fast", false,
    { budgetMs: 3, now: () => 0, yield: async () => { yields++; } });
  expect(yields).toBe(0);
  disposeSurroundingCityRoot(fast.root);
});

test("cancelling during cooperative decode rejects before any chunk can be published", async () => {
  const controller = new AbortController(); let yields = 0;
  await expect(createSurroundingCityChunkCooperatively(sample(), "cancelled", false,
    { signal: controller.signal, budgetMs: 0, yield: async () => { yields++; controller.abort(); } }))
    .rejects.toMatchObject({ name: "AbortError" });
  expect(yields).toBe(1);
  await expect(createSurroundingCityChunkCooperatively(sample(), "already cancelled", false,
    { signal: controller.signal, yield: async () => { throw new Error("must not yield"); } }))
    .rejects.toMatchObject({ name: "AbortError" });
});


test("cancellation disposes meshes and both lighting materials already prepared before publication", async () => {
  for (const stopAt of [5, 7]) {
    const controller = new AbortController(); let yields = 0;
    const geometryDisposal = spyOn(BufferGeometry.prototype, "dispose");
    const materialDisposal = spyOn(Material.prototype, "dispose");
    try {
      await expect(createSurroundingCityChunkCooperatively(sample(), "cancel prepared bounds", false,
        { signal: controller.signal, budgetMs: 0, yield: async () => { if (++yields === stopAt) controller.abort(); } }))
        .rejects.toMatchObject({ name: "AbortError" });
      expect(geometryDisposal).toHaveBeenCalledTimes(stopAt === 5 ? 1 : 2);
      expect(materialDisposal).toHaveBeenCalledTimes(stopAt === 5 ? 2 : 3);
    } finally { geometryDisposal.mockRestore(); materialDisposal.mockRestore(); }
  }
});
