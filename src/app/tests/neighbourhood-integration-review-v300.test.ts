import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BufferGeometry, Group, OrthographicCamera } from "three";
import {
  applyNeighbourhoodTrianglesV300,
  captureNeighbourhoodPacketV300,
  neighbourhoodPacketAdmittedV300,
  prepareNeighbourhoodPacketV300,
  type NeighbourhoodSourceV300,
} from "../src/NeighbourhoodPacketV300";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { createSurroundingCity, disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { captureNeighbourhoodFidelityV300 } from "../src/NeighbourhoodFidelityV300";

function done<T>(steps: Generator<void, T>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}
const hash = (text: string) => {
  let value = 2166136261;
  for (let at = 0; at < text.length; at++) value = Math.imul(value ^ text.charCodeAt(at), 16777619) >>> 0;
  return value;
};
const base64 = (array: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
function fixture() {
  const part: SurroundingPackedMesh = {
    kind: "original-body-and-front",
    positionType: "u16cm",
    positions: base64(new Uint16Array([0, 0, 0, 100, 0, 0, 0, 100, 0])),
    colors: base64(new Uint8Array(9).fill(70)),
    indices: base64(new Uint32Array([0, 1, 2])),
  };
  const append = { ...part, kind: "review-complete-front" };
  const raw: SurroundingCityChunk = {
    schemaVersion: 1,
    origin: [0, 0, 0],
    meshes: [part],
    lines: {
      positionType: "u16cm",
      positions: base64(new Uint16Array([0, 0, 0, 100, 0, 0])),
      colors: base64(new Uint8Array(6).fill(90)),
    },
    nav: { ground: [], buildings: [], water: [], groundY: 0 },
  };
  const source: NeighbourhoodSourceV300 = {
    schemaVersion: 1,
    keys: ["drawn:review"],
    packets: {
      "drawn:review": {
        origin: [0, 0, 0],
        navGuard: hash(JSON.stringify(raw.nav)),
        records: [{ mesh: 0, kind: part.kind, fingerprint: hash(part.positions + part.colors + part.indices) }],
        lineGuard: hash(raw.lines!.positions + raw.lines!.colors),
        append,
        appendFingerprint: hash(append.positions + append.colors + append.indices),
        retire: [{ mesh: 0, triangles: [0] }],
        owners: ["exact-complete-source-parent"],
      },
    },
  };
  const capture = () => done(captureNeighbourhoodPacketV300(raw, "review", false, true, source, append.kind));
  return { raw, source, capture };
}

test("independent review: unreceipted preparer navigation or ink changes fail closed", () => {
  for (const mutate of [
    (chunk: SurroundingCityChunk) => { chunk.nav.groundY = 1; },
    (chunk: SurroundingCityChunk) => { chunk.lines!.positions = "AQAA" + chunk.lines!.positions.slice(4); },
    (chunk: SurroundingCityChunk) => { delete chunk.lines; },
  ]) {
    const { raw, capture } = fixture(), ticket = capture();
    expect(typeof ticket).toBe("function");
    const prepared = structuredClone(raw);
    mutate(prepared);
    expect(done(prepareNeighbourhoodPacketV300(prepared, ticket))).toBe(prepared);
    expect(neighbourhoodPacketAdmittedV300(prepared)).toBeFalse();
  }
});

test("independent review: post-admission navigation or ink mutation revokes every retirement", () => {
  for (const mutate of [
    (chunk: SurroundingCityChunk) => { chunk.nav.groundY = 1; },
    (chunk: SurroundingCityChunk) => { chunk.lines = { ...chunk.lines!, colors: "AQAA" + chunk.lines!.colors!.slice(4) }; },
    (chunk: SurroundingCityChunk) => { chunk.origin = [0, 1, 0]; },
  ]) {
    const { raw, capture } = fixture();
    const admitted = done(prepareNeighbourhoodPacketV300(structuredClone(raw), capture()));
    expect(neighbourhoodPacketAdmittedV300(admitted)).toBeTrue();
    mutate(admitted);
    expect(neighbourhoodPacketAdmittedV300(admitted)).toBeFalse();
    const indices = new Uint32Array([0, 1, 2]);
    expect(done(applyNeighbourhoodTrianglesV300(admitted, 0, indices, 0))).toBe(0);
    expect([...indices]).toEqual([0, 1, 2]);
  }
});

test("independent review: aggregate part and vertex caps cannot admit partial replacement", () => {
  const { raw, capture } = fixture();
  const fullParts = { ...raw, meshes: Array.from({ length: 16 }, () => ({ ...raw.meshes[0] })) };
  expect(done(prepareNeighbourhoodPacketV300(fullParts, capture()))).toBe(fullParts);
  const large: SurroundingPackedMesh = {
    ...raw.meshes[0], kind: "previous-complete-family",
    positions: base64(new Uint16Array(400_000 * 3)),
    colors: base64(new Uint8Array(400_000 * 3)),
    indices: base64(new Uint32Array([0, 1, 2])),
  };
  const fullVertices = { ...raw, meshes: [...raw.meshes, large] };
  expect(done(prepareNeighbourhoodPacketV300(fullVertices, capture()))).toBe(fullVertices);
  expect(neighbourhoodPacketAdmittedV300(fullVertices)).toBeFalse();
  const fullIndices = { ...raw, meshes: [...raw.meshes, { ...raw.meshes[0], kind: "previous-index-family", indices: "AAAA".repeat(3_200_000) }] };
  expect(done(prepareNeighbourhoodPacketV300(fullIndices, capture()))).toBe(fullIndices);
  expect(neighbourhoodPacketAdmittedV300(fullIndices)).toBeFalse();
  expect(raw.meshes).toHaveLength(1);
});

test("independent review: cancellation publishes no transfer and cloned markers confer no authority", () => {
  const { raw, source, capture } = fixture(), before = JSON.stringify(raw);
  const steps = captureNeighbourhoodPacketV300(raw, "review", false, true, source, "review-complete-front");
  expect(steps.next().done).toBeFalse();
  steps.return(undefined);
  expect(JSON.stringify(raw)).toBe(before);
  expect(neighbourhoodPacketAdmittedV300(raw)).toBeFalse();
  const admitted = done(prepareNeighbourhoodPacketV300(raw, capture()));
  expect(neighbourhoodPacketAdmittedV300(admitted)).toBeTrue();
  expect(neighbourhoodPacketAdmittedV300(structuredClone(admitted))).toBeFalse();
  const detached = { ...admitted, meshes: admitted.meshes.slice(0, -1) };
  expect(neighbourhoodPacketAdmittedV300(detached)).toBeFalse();
  expect(Object.isFrozen(admitted.meshes.at(-1))).toBeTrue();
});

const publicDirectory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const publicManifest = JSON.parse(readFileSync(new URL("manifest.json", publicDirectory), "utf8"));
function westFixture(native: boolean, neighbour = false) {
  const descriptor = publicManifest.chunks.find((entry: { id: string }) => entry.id === "-7_3");
  const raw: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(new URL(descriptor[native ? "minecraft" : "drawn"].url, publicDirectory))).toString());
  const body = JSON.stringify(raw), asset = { url: "owner.json", bytes: Buffer.byteLength(body) };
  const x = descriptor.bounds[0], z = descriptor.bounds[1];
  const other = fixture().raw;
  other.origin = [x + 400, -10, z];
  const otherBody = JSON.stringify(other), otherAsset = { url: "neighbour.json", bytes: Buffer.byteLength(otherBody) };
  const ring = [[x, z], [x + 512, z], [x + 512, z + 512], [x, z + 512]];
  const manifest = {
    schemaVersion: 1, groundY: 3, footprint: [{ ring, holes: [] }],
    chunks: [{ ...descriptor, drawn: asset, minecraft: asset }, ...(neighbour ? [{ id: "independent-v300-neighbour", bounds: [x + 400, z, x + 512, z + 200], drawn: otherAsset, minecraft: otherAsset }] : [])],
  };
  const camera = new OrthographicCamera(-350, 350, 350, -350, 1, 3000);
  camera.position.set(x + 256, 500, z + 256); camera.up.set(0, 0, -1); camera.lookAt(x + 256, 0, z + 256); camera.updateMatrixWorld();
  return { raw, body, otherBody, manifest, camera };
}
async function until(predicate: () => boolean) {
  for (let at = 0; at < 1000; at++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 2)); }
  throw new Error("Independent v300 controller review did not settle");
}

test("independent review: the entire West wrapper remains closed without both explicit packet and complete-core gates", () => {
  for (const native of [false, true]) {
    const { raw } = westFixture(native);
    expect(done(captureNeighbourhoodFidelityV300(raw, "-7_3", native))).toHaveLength(0);
    expect(done(captureNeighbourhoodFidelityV300(raw, "-7_3", native, true))).toHaveLength(0);
    expect(done(captureNeighbourhoodFidelityV300(raw, "-7_3", native, false, true))).toHaveLength(0);
    expect(done(captureNeighbourhoodFidelityV300(raw, "-7_3", native, true, true))).toHaveLength(1);
  }
});

test("independent review: late West admission and revocation replace only exact resident receipt tiles", async () => {
  for (const native of [false, true]) {
    const { body, otherBody, manifest, camera } = westFixture(native, true), calls = new Map<string, number>();
    let admitted = false;
    const city = createSurroundingCity({
      manifestUrl: new URL("https://example.test/manifest.json"), camera, mode: native ? "minecraft" : "day", neighbourhoodV300: true,
      westKiezV302: receivedNative => { expect(receivedNative).toBe(native); return admitted; },
      fetch: (async input => { const path = new URL(String(input)).pathname; calls.set(path, (calls.get(path) ?? 0) + 1); return new Response(path.endsWith("manifest.json") ? JSON.stringify(manifest) : path.endsWith("owner.json") ? body : otherBody); }) as typeof fetch,
    });
    const owner = () => city.root.children.find(child => child.name.includes(" -7_3"))!;
    try {
      await city.ready; await until(() => city.residentChunkCount === 2 && !city.pending);
      const initial = owner(), neighbour = city.root.children.find(child => child !== initial)!;
      expect(initial.userData.neighbourhoodV300).toBeFalse();
      admitted = true; city.refresh(performance.now() + 1000);
      await until(() => city.residentChunkCount === 2 && !city.pending && owner()?.userData.neighbourhoodV300 === true);
      expect(owner()).not.toBe(initial); expect(city.root.children).toContain(neighbour);
      expect(calls.get("/owner.json")).toBe(2); expect(calls.get("/neighbour.json")).toBe(1);
      const open = owner(); admitted = false; city.refresh(performance.now() + 2000);
      await until(() => city.residentChunkCount === 2 && !city.pending && owner()?.userData.neighbourhoodV300 === false);
      expect(owner()).not.toBe(open); expect(city.root.children).toContain(neighbour);
      expect(calls.get("/owner.json")).toBe(3); expect(calls.get("/neighbour.json")).toBe(1);
      city.refresh(performance.now() + 3000); await new Promise(resolve => setTimeout(resolve, 5));
      expect(calls.get("/owner.json")).toBe(3);
    } finally { city.dispose(); }
  }
});

test("independent review: West revocation during fetch, decode or onAttach cannot publish a stale retired front", async () => {
  for (const boundary of ["fetch", "decode", "attach"] as const) {
    const { body, manifest, camera } = westFixture(false), released: Group[] = [], published: Group[] = [];
    let admitted = true, started = false, changed = false, unblock: (() => void) | undefined;
    const blocked = new Promise<void>(resolve => { unblock = resolve; });
    const setAttribute = BufferGeometry.prototype.setAttribute;
    const city = createSurroundingCity({
      manifestUrl: new URL("https://example.test/manifest.json"), camera, neighbourhoodV300: true, westKiezV302: () => admitted,
      fetch: (async input => {
        if (String(input).includes("manifest.json")) return new Response(JSON.stringify(manifest));
        if (boundary === "fetch" && !started) { started = true; await blocked; }
        return new Response(body);
      }) as typeof fetch,
      onAttach: root => { if (boundary === "attach" && !changed) { expect(root.userData.neighbourhoodV300).toBeTrue(); admitted = false; changed = true; } published.push(root); },
      onRelease: root => { released.push(root); disposeSurroundingCityRoot(root); },
    });
    try {
      if (boundary === "decode") BufferGeometry.prototype.setAttribute = function (...args) {
        if (!changed) { admitted = false; changed = true; }
        return setAttribute.apply(this, args as Parameters<typeof setAttribute>);
      };
      await city.ready;
      if (boundary === "fetch") { await until(() => started); admitted = false; changed = true; city.refresh(performance.now() + 1000); unblock!(); }
      await until(() => !city.pending);
      expect(changed).toBeTrue();
      expect(city.root.children.every(root => root.userData.neighbourhoodV300 !== true)).toBeTrue();
      if (boundary !== "fetch") expect(released.some(root => root.userData.neighbourhoodV300 === true)).toBeTrue();
      if (boundary === "decode") expect(published).toHaveLength(0);
      city.refresh(performance.now() + 2000);
      await until(() => city.residentChunkCount === 1 && !city.pending);
      expect(city.root.children[0].userData.neighbourhoodV300).toBeFalse();
    } finally { BufferGeometry.prototype.setAttribute = setAttribute; unblock?.(); city.dispose(); }
  }
});
