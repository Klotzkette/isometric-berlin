import { describe, expect, test } from "bun:test";
import ts from "typescript";
import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial,
} from "three";
import { markArchitecturalInk } from "../src/architecturalInk";
import { smoothGroundTopSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { spreebogenTerrainYAt } from "../src/spreebogenBankProfile";
import { freezeStaticSceneTransforms } from "../src/staticSceneTransforms";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { indexGeometryExactly } from "../src/exactGeometryIndex";
import type { RestoredRoadBatch, RestoredRoadManifest } from "../src/restoredRoadSurfaces";

// Execute the real production functions while isolating the bundler's ?url
// import. Network is injected, so this does not install process-wide mocks.
const source = await Bun.file(new URL("../src/restoredRoadSurfaces.ts", import.meta.url)).text();
const parsed = ts.createSourceFile("restoredRoadSurfaces.ts", source, ts.ScriptTarget.Latest, true);
const functions = parsed.statements.filter(ts.isFunctionDeclaration).map(node => node.getText(parsed));
const compiled = ts.transpileModule(functions.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function host(fetcher: (url: string) => Promise<unknown> = async () => { throw new Error("Unexpected fetch"); }, indexer: (geometry: BufferGeometry) => unknown = indexGeometryExactly) {
  const decodeSizes: number[] = [];
  const bindings = {
    TextDecoder: class extends TextDecoder {
      decode(input?: AllowSharedBufferSource, options?: TextDecodeOptions): string {
        decodeSizes.push(input?.byteLength ?? 0);
        return super.decode(input, options);
      }
    },
    exports: {}, BufferAttribute, BufferGeometry, DoubleSide, Group,
    LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, markArchitecturalInk,
    smoothGroundTopSampler, spreebogenTerrainYAt, freezeStaticSceneTransforms,
    roadDataUrl: "./assets/restored-road-fixture.ndjson.txt", fetch: fetcher,
    RESTORED_ROAD_MAX_LINE_CHARS: 2 * 1024 * 1024, indexGeometryExactly: indexer, decodeSizes,
  };
  return new Function(...Object.keys(bindings), `${compiled}\nreturn { createRestoredRoadBatch, createRestoredRoadSurfaceBatches, roadLines, decodeSizes };`)(...Object.values(bindings)) as {
    decodeSizes: number[];
    roadLines: (body: ReadableStream<Uint8Array>) => AsyncGenerator<string>;
    createRestoredRoadBatch: typeof import("../src/restoredRoadSurfaces").createRestoredRoadBatch;
    createRestoredRoadSurfaceBatches: typeof import("../src/restoredRoadSurfaces").createRestoredRoadSurfaceBatches;
  };
}

function encoded(values: Float32Array | Uint32Array): string {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString("base64");
}
const asphalt = (): RestoredRoadBatch => ({
  id: "restored-asphalt-0-0", kind: "asphalt",
  xz: encoded(new Float32Array([1, 2, 1, 7, 9, 2])),
  indices: encoded(new Uint32Array([0, 1, 2])),
});
const ground = {
  cell_m: 4, grid: { min_x_idx: 0, min_z_idx: 0, cols: 8, rows: 8 },
  ground_height: { stride_cells: 4, cols: 2, rows: 2, y_dm: [40, 40, 40, 40] },
} as VoxelPayload;

function fingerprint(root: Group): string {
  const hash = new Bun.CryptoHasher("sha256");
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    for (const attribute of Object.values(object.geometry.attributes)) {
      hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    if (object.geometry.index) hash.update(new Uint8Array(object.geometry.index.array.buffer));
  });
  return hash.digest("hex");
}

function records(batches: RestoredRoadBatch[]): string[] {
  const header: RestoredRoadManifest = { format: "bounded-source-road-surfaces", version: 1,
    encoding: "ndjson-base64-float32", source_sha256: "fixture", batch_count: batches.length };
  return [JSON.stringify(header), ...batches.map(batch => JSON.stringify(batch))];
}

function streamResponse(chunks: Uint8Array[]) {
  let next = 0;
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next < chunks.length) controller.enqueue(chunks[next++]);
      else controller.close();
    },
    cancel() { cancelled++; },
  }, { highWaterMark: 0 });
  return { response: { ok: true, body }, pulled: () => next, cancelled: () => cancelled };
}

function expandedFingerprint(root: Group): string {
  const hash = new Bun.CryptoHasher("sha256");
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    for (const attribute of Object.values(geometry.attributes)) {
      hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    if (geometry !== object.geometry) geometry.dispose();
  });
  return hash.digest("hex");
}

function geometryBytes(root: Group): number {
  let total = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    total += object.geometry.index?.array.byteLength ?? 0;
    for (const attribute of Object.values(object.geometry.attributes)) total += attribute.array.byteLength;
  });
  return total;
}

describe("restored exact road runtime", () => {
  test("uses all cached vertices and triangle indices on continuous surveyed terrain", () => {
    const root = host().createRestoredRoadBatch(asphalt(), (x, z) => 3 + x / 4 + z / 2);
    const object = root.children[0] as Mesh;
    expect(root.userData.exactSourceRoad).toBeTrue();
    expect(root.name).toBe("restored-asphalt-0-0");
    expect(object.name).toBe("smooth carriageways");
    expect(object.geometry.getAttribute("position").count).toBe(3);
    expect(Array.from(object.geometry.index!.array)).toEqual([0, 1, 2]);
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getY(i)).toBeCloseTo(3 + positions.getX(i) / 4 + positions.getZ(i) / 2 + 0.14, 5);
    }
    expect(object.geometry.boundingBox).not.toBeNull();
    expect(object.geometry.boundingSphere!.radius).toBeGreaterThan(0);
    expect(object.matrixAutoUpdate).toBeFalse();
    expect((object.material as MeshBasicMaterial).color.getHex()).toBe(0xc4c5c0);
  });

  test("keeps exact curb upstands and ink along supplied source segments", () => {
    const root = host().createRestoredRoadBatch({ id: "kerbs", kind: "kerbs", xz: encoded(new Float32Array([1, 2, 9, 2, 9, 2, 9, 7])) }, () => 4);
    const curb = root.getObjectByName("smooth kerb upstands") as Mesh;
    const ink = root.getObjectByName("smooth kerb ink") as LineSegments;
    expect(curb.geometry.getAttribute("position").count).toBe(6);
    expect(curb.geometry.index!.count).toBe(12);
    expect(ink.geometry.index!.count).toBe(4);
    expect(curb.geometry.boundingBox!.min.y).toBeCloseTo(4.14, 5);
    expect(curb.geometry.boundingBox!.max.y).toBeCloseTo(4.28, 5);
    expect(ink.geometry.boundingBox!.min.y).toBeCloseTo(4.29, 5);
    expect((curb.material as MeshBasicMaterial).side).toBe(DoubleSide);
    expect(ink.renderOrder).toBe(2);
  });

  test("preserves all geometry in all four drawn presentations", () => {
    for (const kind of ["asphalt", "paving"] as const) {
      const root = host().createRestoredRoadBatch({ ...asphalt(), kind }, () => 4);
      const expected = fingerprint(root);
      const object = root.children[0] as Mesh;
      for (const mode of ["night", "snowstorm", "schwellenraum", "day"] as const) {
        setIsoNightPresentation(root, mode === "night", true, mode);
        expect(fingerprint(root)).toBe(expected);
        expect(object.visible).toBeTrue();
        if (mode === "night") expect(object.material).toBe(object.userData.nightMaterial);
        if (mode === "day") expect(object.material).toBe(object.userData.dayMaterial);
      }
    }
  });

  test("reads only the next requested line and skips already-attached geometry", async () => {
    const batches = [asphalt(), { ...asphalt(), id: "already-attached", xz: "invalid-base64-unused" }, { ...asphalt(), id: "last", kind: "paving" as const }];
    const network = streamResponse(records(batches).map(line => new TextEncoder().encode(line + "\n")));
    const fetched: string[] = [];
    const runtime = host(async url => { fetched.push(url); return network.response; });
    const stream = runtime.createRestoredRoadSurfaceBatches(ground, new Set(["already-attached"]));
    expect(fetched).toHaveLength(0);
    const first = await stream.next();
    expect(first.value!.id).toBe("restored-asphalt-0-0");
    expect(network.pulled()).toBe(2); // Header and exactly one batch.
    const second = await stream.next();
    expect(second.value!.id).toBe("last");
    expect(network.pulled()).toBe(4);
    expect((second.value!.root.children[0] as Mesh).geometry.getAttribute("position").getY(0)).toBeCloseTo(4.1, 5);
    expect((await stream.next()).done).toBeTrue();
    expect(network.response.body.locked).toBeFalse();
    expect(fetched).toEqual(["./assets/restored-road-fixture.ndjson.txt"]);
  });

  test("retains UTF-8 IDs and geometry across arbitrary byte and line boundaries", async () => {
    const batches = [asphalt(), { ...asphalt(), id: "Straße-Üfer", kind: "paving" as const }];
    const bytes = new TextEncoder().encode(records(batches).join("\n")); // No final newline.
    for (const width of [1, 3, 31, bytes.length]) {
      const chunks = Array.from({ length: Math.ceil(bytes.length / width) }, (_, i) => bytes.slice(i * width, (i + 1) * width));
      const network = streamResponse(chunks);
      const stream = host(async () => network.response).createRestoredRoadSurfaceBatches(ground);
      const ids: string[] = [];
      for await (const batch of stream) ids.push(batch.id);
      expect(ids).toEqual(batches.map(batch => batch.id));
      expect(network.response.body.locked).toBeFalse();
    }
  });

  test("a whole-cache network chunk is decoded in bounded 64 KiB slices", async () => {
    const batches = Array.from({ length: 10_000 }, (_, i) => ({ ...asphalt(), id: `batch-${i}` }));
    const bytes = new TextEncoder().encode(records(batches).join("\n"));
    expect(bytes.byteLength).toBeGreaterThan(1024 * 1024);
    const network = streamResponse([bytes]);
    const runtime = host(async () => network.response);
    const stream = runtime.createRestoredRoadSurfaceBatches(ground);
    expect((await stream.next()).value!.id).toBe("batch-0");
    expect(runtime.decodeSizes).toEqual([64 * 1024]);
    await stream.return(undefined);
    expect(network.cancelled()).toBe(1);
  });

  test("cancels and unlocks the response if the consumer stops", async () => {
    const network = streamResponse(records([asphalt(), { ...asphalt(), id: "later" }]).map(line => new TextEncoder().encode(line + "\n")));
    const stream = host(async () => network.response).createRestoredRoadSurfaceBatches(ground);
    await stream.next();
    await stream.return(undefined);
    expect(network.pulled()).toBe(2);
    expect(network.cancelled()).toBe(1);
    expect(network.response.body.locked).toBeFalse();
  });

  test("fails visibly and cleans up missing, malformed, truncated and oversized data", async () => {
    const missing = host(async () => ({ ok: false, status: 404 }));
    await expect(missing.createRestoredRoadSurfaceBatches(ground).next()).rejects.toThrow("HTTP 404");
    const noBody = host(async () => ({ ok: true, body: null }));
    await expect(noBody.createRestoredRoadSurfaceBatches(ground).next()).rejects.toThrow("readable body");
    for (const [lines, message] of [
      [["{}"], "incomplete"],
      [[records([asphalt()])[0]], "incomplete"],
      [[records([asphalt()])[0], "{oops"], "invalid JSON"],
      [[records([asphalt()])[0], JSON.stringify({ ...asphalt(), kind: "unknown" })], "invalid batch"],
      [["x".repeat(2 * 1024 * 1024 + 1)], "bounded line size"],
    ] as const) {
      const network = streamResponse(lines.map(line => new TextEncoder().encode(line + "\n")));
      const stream = host(async () => network.response).createRestoredRoadSurfaceBatches(ground);
      await expect(stream.next()).rejects.toThrow(message);
      expect(network.response.body.locked).toBeFalse();
    }
  });

  test("exact indexing saves memory without changing any triangle or line attribute bits", () => {
    const fixtures: RestoredRoadBatch[] = [asphalt(), {
      id: "kerbs", kind: "kerbs", xz: encoded(new Float32Array([1, 2, 9, 2, 9, 2, 9, 7, 9, 7, 1, 7])),
    }];
    for (const fixture of fixtures) {
      const untouched = host(undefined, () => undefined).createRestoredRoadBatch(fixture, (x, z) => 4 + x * 0.003 - z * 0.002);
      const compact = host().createRestoredRoadBatch(fixture, (x, z) => 4 + x * 0.003 - z * 0.002);
      expect(expandedFingerprint(compact)).toBe(expandedFingerprint(untouched));
      expect(geometryBytes(compact)).toBeLessThan(geometryBytes(untouched));
    }
  });

  test("all delivered batches retain identical expanded attribute bits after indexing", async () => {
    const realGround = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
    const terrain = smoothGroundTopSampler(realGround);
    const topAt = (x: number, z: number): number => spreebogenTerrainYAt(x, z,
      terrain(x / realGround.cell_m - realGround.grid.min_x_idx, z / realGround.cell_m - realGround.grid.min_z_idx));
    const plain = host(undefined, () => undefined);
    const indexed = host();
    let beforeBytes = 0, afterBytes = 0, count = 0, declaredCount = 0;
    const body = Bun.file(new URL("../src/data/restoredRoadSurfaces.ndjson.txt", import.meta.url)).stream();
    for await (const line of indexed.roadLines(body)) {
      const value = JSON.parse(line);
      if (!value.kind) { declaredCount = value.batch_count; continue; }
      const before = plain.createRestoredRoadBatch(value, topAt);
      const after = indexed.createRestoredRoadBatch(value, topAt);
      expect(expandedFingerprint(after)).toBe(expandedFingerprint(before));
      beforeBytes += geometryBytes(before);
      afterBytes += geometryBytes(after);
      count++;
      for (const root of [before, after]) root.traverse(object => {
        if (object instanceof Mesh || object instanceof LineSegments) object.geometry.dispose();
      });
    }
    expect(count).toBe(declaredCount);
    expect(beforeBytes - afterBytes).toBeGreaterThan(16 * 1024 * 1024);
    expect(afterBytes).toBeLessThan(32 * 1024 * 1024);
  });

});
