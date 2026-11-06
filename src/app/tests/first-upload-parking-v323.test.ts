import { expect, test } from "bun:test";
import {
  BoxGeometry, BufferAttribute, BufferGeometry, DynamicDrawUsage, Group,
  InstancedMesh, InterleavedBuffer, InterleavedBufferAttribute, Matrix4,
  Mesh, MeshBasicMaterial, PerspectiveCamera,
} from "three";
import { collectFirstUploadParkingV323 } from "../src/firstUploadParkingV323";
import {
  hasParkedStaticStorageBackingV323, isParkedStaticStorageV321,
  parkStaticGeometrySteps, parkStaticInstancesSteps, staticStorageInfo,
} from "../src/losslessStaticStorage";

function finish<T>(steps: Generator<void, T>): T {
  let next = steps.next(); while (!next.done) next = steps.next(); return next.value;
}
function bytes(a: ArrayBufferView): Buffer { return Buffer.from(a.buffer, a.byteOffset, a.byteLength); }
function geometry() {
  const values = new Float32Array(24000);
  for (let i = 0; i < values.length; i += 3) { values[i] = (i % 9) / 10; values[i + 1] = (i % 7) / 10; }
  const g = new BufferGeometry().setAttribute("position", new BufferAttribute(values, 3));
  g.userData.exactIndexPending = false;
  return g;
}
function mesh() { const m = new Mesh(geometry(), new MeshBasicMaterial()); m.position.z = -5; return m; }
function camera() { const c = new PerspectiveCamera(60, 1, .1, 100); c.updateProjectionMatrix(); return c; }
function instanced() {
  const m = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 2048);
  const matrix = new Matrix4();
  for (let i = 0; i < m.count; i++) m.setMatrixAt(i, matrix);
  m.position.z = -5;
  return m;
}

test("actual frustum, visible ancestors and per-object layers select only first-camera uploads", () => {
  const root = new Group(), front = mesh(), offscreen = mesh(), invisible = mesh(), wrongLayer = mesh();
  offscreen.position.x = 1000; wrongLayer.layers.set(1);
  const hidden = new Group(); hidden.visible = false; hidden.add(invisible);
  const layerParent = new Group(), sameCameraLayerChild = mesh(); layerParent.layers.set(1); layerParent.add(sameCameraLayerChild);
  const noCull = mesh(); noCull.position.x = 1000; noCull.frustumCulled = false;
  const materialHidden = mesh(); materialHidden.material.visible = false;
  root.add(front, offscreen, hidden, wrongLayer, layerParent, noCull, materialHidden);
  const p = collectFirstUploadParkingV323([root], camera());
  expect(p.count).toBe(4); expect(p.bytes).toBe(4 * 96000);
  for (const m of [front, sameCameraLayerChild, noCull, materialHidden]) expect(p.shouldPark(m.geometry.getAttribute("position") as BufferAttribute)).toBe(false);
  for (const m of [offscreen, invisible, wrongLayer]) expect(p.shouldPark(m.geometry.getAttribute("position") as BufferAttribute)).toBe(true);
  p.release();
  // Visibility above a supplied staging root also prevents a first upload.
  const parent = new Group(); parent.visible = false; parent.add(root);
  expect(collectFirstUploadParkingV323([root], camera()).count).toBe(0);
});

test("geometry opt-ins, morphs, dynamic data and upload callbacks keep the existing exclusion contract", () => {
  const root = new Group(), candidates = Array.from({ length: 7 }, mesh);
  delete candidates[0].geometry.userData.exactIndexPending;
  candidates[1].geometry.userData.flatColorsBuilt = true;
  candidates[2].userData.modeColours = true;
  candidates[3].geometry.morphAttributes.position = [new BufferAttribute(new Float32Array(24000), 3)];
  (candidates[4].geometry.getAttribute("position") as BufferAttribute).setUsage(DynamicDrawUsage);
  (candidates[5].geometry.getAttribute("position") as BufferAttribute).onUpload(() => {});
  (candidates[6].geometry.getAttribute("position") as BufferAttribute).addUpdateRange(0, 3);
  root.add(...candidates);
  const p = collectFirstUploadParkingV323([root], camera()); expect(p.count).toBe(0); p.release();
  const matrix = instanced();
  // Stock unit boxes have no geometry parking opt-in; old instance parking is separate.
  const matrices = collectFirstUploadParkingV323([matrix], camera());
  expect(matrices.count).toBe(1); expect(matrices.shouldPark(matrix.instanceMatrix)).toBe(false); matrices.release();
});

test("both staging roots deduplicate shared geometry and interleaved backing", () => {
  const a = new Group(), b = new Group(), data = new InterleavedBuffer(new Float32Array(48000).fill(.125), 6);
  const g = new BufferGeometry(); g.userData.losslessStaticBacking = true;
  g.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0));
  g.setAttribute("normal", new InterleavedBufferAttribute(data, 3, 3));
  const first = new Mesh(g, new MeshBasicMaterial()), second = new Mesh(g, new MeshBasicMaterial());
  first.position.z = second.position.z = -5; a.add(first); b.add(second);
  const p = collectFirstUploadParkingV323([a, b], camera());
  expect(p.count).toBe(1); expect(p.bytes).toBe(data.array.byteLength); expect(p.shouldPark(data)).toBe(false);
  const original = data.array; finish(p.parkSteps()); expect(data.array).toBe(original);
  expect(Object.getOwnPropertyDescriptor(data, "array")?.get).toBeDefined();
});

test("exclusive matrix selection rejects live aliases including invisible foreign attributes", () => {
  const m = instanced(), root = new Group(), other = mesh(); root.add(m, other);
  other.visible = false;
  other.geometry.setAttribute("foreign", new BufferAttribute(m.instanceMatrix.array, 16));
  const p = collectFirstUploadParkingV323([root], camera());
  expect(p.shouldPark(m.instanceMatrix)).toBe(true); expect(p.count).toBe(0); p.release();
  other.geometry.deleteAttribute("foreign");
  const q = collectFirstUploadParkingV323([root], camera()); expect(q.count).toBe(1);
  const steps = q.parkSteps(), original = m.instanceMatrix.array; steps.next();
  other.geometry.setAttribute("foreign", new BufferAttribute(original, 16));
  finish(steps);
  expect(m.instanceMatrix.array).toBe(original); expect(original.byteLength).toBe(131072);
  expect(Object.getOwnPropertyDescriptor(m.instanceMatrix, "array")?.get).toBeUndefined();
});

test("filtered pre-render plus selected post-render parking preserves every byte and source identity", () => {
  const root = new Group(), front = mesh(), offscreen = mesh(), instances = instanced();
  offscreen.position.x = 1000; root.add(front, offscreen, instances);
  const position = front.geometry.getAttribute("position") as BufferAttribute;
  const matrix = instances.instanceMatrix, pInfo = staticStorageInfo(position), mInfo = staticStorageInfo(matrix);
  const expectedPosition = Buffer.from(bytes(position.array)), expectedMatrix = Buffer.from(bytes(matrix.array));
  const rawPosition = position.array, rawMatrix = matrix.array, p = collectFirstUploadParkingV323([root], camera());
  finish(parkStaticGeometrySteps(root, false, p.shouldPark));
  finish(parkStaticInstancesSteps(root, p.shouldPark));
  expect(position.array).toBe(rawPosition); expect(matrix.array).toBe(rawMatrix);
  expect(Object.getOwnPropertyDescriptor(offscreen.geometry.getAttribute("position"), "array")?.get).toBeDefined();
  finish(p.parkSteps());
  expect(rawPosition.byteLength).toBe(96000); expect(rawMatrix.byteLength).toBe(0);
  expect(bytes(position.array).equals(expectedPosition)).toBe(true); expect(bytes(matrix.array).equals(expectedMatrix)).toBe(true);
  expect(staticStorageInfo(position)).toEqual(pInfo); expect(staticStorageInfo(matrix)).toEqual(mInfo);
  const uploaded = matrix.array; matrix.onUploadCallback();
  expect(uploaded.byteLength).toBe(0); expect(bytes(matrix.array).equals(expectedMatrix)).toBe(true);
  expect(staticStorageInfo(matrix).arrayIdentity).toBe(mInfo.arrayIdentity);
  expect(p.shouldPark(position)).toBe(true); expect(finish(p.parkSteps())).toBeUndefined();
});

test("old optional-filter defaults and explicit true filters have identical final storage", () => {
  const a = mesh(), b = mesh();
  const oldSaved = finish(parkStaticGeometrySteps(a)), filteredSaved = finish(parkStaticGeometrySteps(b, false, () => true));
  expect(filteredSaved).toBe(oldSaved);
  expect(bytes(a.geometry.getAttribute("position").array).equals(bytes(b.geometry.getAttribute("position").array))).toBe(true);
  const c = instanced(), d = instanced();
  expect(finish(parkStaticInstancesSteps(c))).toBe(finish(parkStaticInstancesSteps(d, () => true)));
  expect(bytes(c.instanceMatrix.array).equals(bytes(d.instanceMatrix.array))).toBe(true);
});

test("release, cancellation, disposal and changed array/version cannot install stale backing", () => {
  for (const action of ["release", "cancel", "dispose", "version", "array", "owner"] as const) {
    const m = mesh(), p = collectFirstUploadParkingV323([m], camera()), original = m.geometry.getAttribute("position") as BufferAttribute;
    const steps = p.parkSteps(); steps.next();
    if (action === "release") { p.release(); p.release(); }
    if (action === "cancel") steps.return(undefined);
    if (action === "dispose") m.geometry.dispose();
    if (action === "version") original.needsUpdate = true;
    if (action === "array") original.array = new Float32Array(original.array.length);
    if (action === "owner") m.geometry = geometry();
    finish(steps);
    expect(Object.getOwnPropertyDescriptor(original, "array")?.get).toBeUndefined();
    expect(original.array.byteLength).toBe(96000); expect(p.shouldPark(original)).toBe(true);
  }
  const m = instanced(), p = collectFirstUploadParkingV323([m], camera()); m.dispose(); finish(p.parkSteps());
  expect(Object.getOwnPropertyDescriptor(m.instanceMatrix, "array")?.get).toBeUndefined();
  const before = mesh(), q = collectFirstUploadParkingV323([before], camera()); q.release();
  finish(q.parkSteps()); expect(q.shouldPark(before.geometry.getAttribute("position") as BufferAttribute)).toBe(true);
});

test("unsafe bounds or foreign array accessors fall back without reading or altering source", () => {
  const m = mesh(), storage = m.geometry.getAttribute("position") as BufferAttribute;
  const original = storage.array; let reads = 0;
  Object.defineProperty(storage, "array", { configurable: true, get() { reads++; return original; } });
  const p = collectFirstUploadParkingV323([m], camera());
  expect(p.count).toBe(0); expect(p.bytes).toBe(0); expect(p.shouldPark(storage)).toBe(true); expect(reads).toBe(0);
  const safe = mesh(), cam = camera(); cam.projectionMatrix.elements[0] = NaN;
  const q = collectFirstUploadParkingV323([safe], cam); expect(q.count).toBe(0);
});

test("private parked alias metadata accepts a live WeakRef without entering its getter", () => {
  const old = mesh(), values = old.geometry.getAttribute("position") as BufferAttribute;
  old.geometry.computeBoundingSphere();
  const original = values.array;
  finish(parkStaticGeometrySteps(old));
  expect(values.array).toBe(original); expect(isParkedStaticStorageV321(values)).toBe(false);
  expect(hasParkedStaticStorageBackingV323(values)).toBe(true);
  const root = new Group(), matrix = instanced(); root.add(old, matrix);
  const p = collectFirstUploadParkingV323([root], camera());
  expect(p.count).toBe(1); finish(p.parkSteps());
  expect(Object.getOwnPropertyDescriptor(matrix.instanceMatrix, "array")?.get).toBeDefined();
  // An actual foreign/wrapped accessor never inherits the private proof.
  Object.defineProperty(values, "array", { configurable: true, get() { throw Error("foreign getter entered"); } });
  expect(hasParkedStaticStorageBackingV323(values)).toBe(false);
  const second = instanced(); root.add(second);
  const q = collectFirstUploadParkingV323([root], camera());
  expect(q.shouldPark(second.instanceMatrix)).toBe(true); q.release();
});

test("irrelevant parked or tiny objects with missing bounds preserve a legal candidate", () => {
  const root = new Group(), old = mesh(), large = mesh();
  finish(parkStaticGeometrySteps(old));
  expect(old.geometry.boundingSphere).toBeNull();
  const tiny = new Mesh(new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(9), 3)), new MeshBasicMaterial());
  root.add(old, tiny, large);
  const p = collectFirstUploadParkingV323([root], camera());
  expect(p.count).toBe(1); expect(p.shouldPark(large.geometry.getAttribute("position") as BufferAttribute)).toBe(false);
  p.release();
  // An eligible large field whose own required bounds need a foreign getter is unsafe.
  const source = mesh(); source.geometry.setAttribute("normal", new BufferAttribute(new Float32Array(24000), 3));
  const position = source.geometry.getAttribute("position") as BufferAttribute, values = position.array;
  Object.defineProperty(position, "array", { configurable: true, get() { throw Error("no bounds read allowed"); } });
  const q = collectFirstUploadParkingV323([large, source], camera());
  expect(q.count).toBe(0); expect(q.shouldPark(source.geometry.getAttribute("normal") as BufferAttribute)).toBe(true);
  Object.defineProperty(position, "array", { configurable: true, writable: true, value: values });
});

test("atomic staging-child attachment can rebind only the scope, retaining exact source pins", () => {
  const staging = new Group(), published = new Group(), m = mesh(), matrix = instanced(); staging.add(m, matrix);
  const storage = m.geometry.getAttribute("position") as BufferAttribute, expected = Buffer.from(bytes(storage.array));
  const p = collectFirstUploadParkingV323([staging], camera());
  published.add(...staging.children); expect(staging.children).toHaveLength(0);
  p.reparent([published]); finish(p.parkSteps());
  expect(bytes(storage.array).equals(expected)).toBe(true); expect(Object.getOwnPropertyDescriptor(storage, "array")?.get).toBeDefined();
  expect(Object.getOwnPropertyDescriptor(matrix.instanceMatrix, "array")?.get).toBeDefined();
  const old = mesh(), a = new Group(), b = new Group(); a.add(old);
  const q = collectFirstUploadParkingV323([a], camera()), original = old.geometry.getAttribute("position") as BufferAttribute;
  a.remove(old); b.add(new Mesh(old.geometry, old.material));
  q.reparent([b]); finish(q.parkSteps());
  expect(Object.getOwnPropertyDescriptor(original, "array")?.get).toBeUndefined();
  const native = instanced(), provisional = new Group(), target = new Group(); provisional.add(native);
  const r = collectFirstUploadParkingV323([provisional], camera()), raw = native.instanceMatrix.array;
  target.add(native); const foreign = mesh(); foreign.visible = false;
  foreign.geometry.setAttribute("foreign", new BufferAttribute(raw, 16)); target.add(foreign);
  r.reparent([target]); finish(r.parkSteps());
  expect(raw.byteLength).toBe(131072); expect(Object.getOwnPropertyDescriptor(native.instanceMatrix, "array")?.get).toBeUndefined();
});

test("completed entries release their raw WeakRef and listeners before later selected work finishes", async () => {
  const first = (() => {
    const m = mesh();
    return { m, raw: new WeakRef(m.geometry.getAttribute("position").array) };
  })();
  const second = mesh(), root = new Group(); root.add(first.m, second);
  const firstStorage = first.m.geometry.getAttribute("position") as BufferAttribute;
  const secondStorage = second.geometry.getAttribute("position") as BufferAttribute;
  const p = collectFirstUploadParkingV323([root], camera()), steps = p.parkSteps();
  expect(steps.next().done).toBe(false); // First source is still being compressed.
  expect(p.shouldPark(firstStorage)).toBe(false);
  expect(steps.next().done).toBe(false); // First installed, second source suspended.
  expect(p.shouldPark(firstStorage)).toBe(true); expect(p.shouldPark(secondStorage)).toBe(false);
  expect(Object.getOwnPropertyDescriptor(firstStorage, "array")?.get).toBeDefined();
  const listeners = (g: BufferGeometry) => (g as unknown as { _listeners?: { dispose?: unknown[] } })._listeners?.dispose?.length ?? 0;
  expect(listeners(first.m.geometry)).toBe(0); expect(listeners(second.geometry)).toBeGreaterThan(0);
  // Separate jobs clear JS WeakRef keepalive; an unfinished plan must not retain
  // the first original view through its entry/cleanup/compression closures.
  await new Promise(resolve => setTimeout(resolve, 0)); Bun.gc(true);
  await new Promise(resolve => setTimeout(resolve, 0)); Bun.gc(true);
  expect(first.raw.deref()).toBeUndefined();
  expect(hasParkedStaticStorageBackingV323(firstStorage)).toBe(true);
  expect(isParkedStaticStorageV321(firstStorage)).toBe(true);
  finish(steps); expect(p.shouldPark(secondStorage)).toBe(true); expect(listeners(second.geometry)).toBe(0);
});
