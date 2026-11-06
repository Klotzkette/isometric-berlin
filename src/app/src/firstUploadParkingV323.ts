import {
  BufferAttribute, BufferGeometry, Camera, Frustum, InstancedMesh, InterleavedBuffer,
  Line, Matrix4, Mesh, Object3D, Points, Sphere, StaticDrawUsage,
} from "three";
import {
  hasParkedStaticStorageBackingV323, parkStaticAttribute, staticStorageInfo,
} from "./losslessStaticStorage";
import { isSceneGeometryGpuRetirementV309 } from "./sceneGeometryGpuResidency";
import { isSceneInstanceGpuRetirementV309 } from "./sceneGpuResidency";

type Storage = BufferAttribute | InterleavedBuffer;
type RenderObject = Mesh | Line | Points;
type Values = BufferAttribute["array"];
type Owner = { object: RenderObject; geometry: BufferGeometry; field: string; matrix: boolean };
type Entry = {
  storage: Storage; array: Values | null; version: number; ownsBuffer: boolean;
  ranges: Storage["updateRanges"]; owners: Owner[]; disposed: boolean;
  cleanups: Array<() => void>;
};
export type FirstUploadParkingV323 = {
  /** Unique physical original bytes; shared/interleaved storage counts once. */
  readonly bytes: number;
  readonly count: number;
  shouldPark(storage: Storage): boolean;
  /** After the caller's atomic attachment, before starting post-upload work. */
  reparent(roots: readonly Object3D[]): void;
  parkSteps(): Generator<void, void>;
  release(): void;
};
const MIN_BYTES = 64 * 1024;
const renderObject = (o: Object3D): o is RenderObject => o instanceof Mesh || o instanceof Line || o instanceof Points;
const storageOf = (a: BufferAttribute | { data: InterleavedBuffer }): Storage => "data" in a ? a.data : a;
const geometryEligible = (o: RenderObject): boolean =>
  (o.geometry.userData.exactIndexPending === false || o.geometry.userData.losslessStaticBacking === true) &&
  !o.userData.modeColours && !o.geometry.userData.flatColorsBuilt &&
  !Object.values(o.geometry.morphAttributes).some(a => a.length);

/** Never enter an array accessor merely to select deferred work. */
function ordinaryArray(storage: Storage): Values | null {
  const d = Object.getOwnPropertyDescriptor(storage, "array");
  return d && "value" in d && ArrayBuffer.isView(d.value) ? d.value as Values : null;
}
function eligibleArray(storage: Storage): Values | null {
  const a = ordinaryArray(storage);
  return a && typeof WeakRef === "function" && storage.usage === StaticDrawUsage &&
    !storage.updateRanges.length && storage.onUploadCallback === (storage instanceof BufferAttribute
      ? BufferAttribute.prototype.onUploadCallback : InterleavedBuffer.prototype.onUploadCallback) &&
    a.buffer instanceof ArrayBuffer && a.byteLength >= MIN_BYTES && !a.byteOffset &&
    a.byteLength === a.buffer.byteLength ? a : null;
}
function fields(o: RenderObject): Storage[] {
  const attrs = [...Object.values(o.geometry.attributes), o.geometry.index,
    ...Object.values(o.geometry.morphAttributes).flat(),
    ...(o instanceof InstancedMesh ? [o.instanceMatrix, o.instanceColor] : [])];
  return attrs.filter(a => a !== null).map(storageOf);
}
function visible(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function within(o: Object3D, roots: readonly Object3D[]): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (roots.includes(p)) return true;
  return false;
}
function finiteSphere(s: Sphere | null): boolean {
  return !!s && Number.isFinite(s.radius) && s.radius >= 0 && s.center.toArray().every(Number.isFinite);
}
/** Match Three's own culling; computing a missing sphere is safe only on raw arrays. */
function boundsReady(o: RenderObject): boolean {
  const g = o.geometry;
  if (g.boundingSphere === null) {
    const positions = g.getAttribute("position");
    if (!positions || !ordinaryArray(storageOf(positions)) ||
        Object.values(g.morphAttributes).flat().some(a => !ordinaryArray(storageOf(a)))) return false;
    g.computeBoundingSphere();
  }
  if (!finiteSphere(g.boundingSphere)) return false;
  if (o instanceof InstancedMesh) {
    if (o.boundingSphere === null) {
      if (!ordinaryArray(o.instanceMatrix)) return false;
      o.computeBoundingSphere();
    }
    if (!finiteSphere(o.boundingSphere)) return false;
  } else if ("boundingSphere" in o) {
    // Skinned/custom bounding providers can require animated or foreign reads.
    const sphere = (o as RenderObject & { boundingSphere: Sphere | null }).boundingSphere;
    if (!finiteSphere(sphere)) return false;
  }
  return true;
}
const empty = (): FirstUploadParkingV323 => ({ bytes: 0, count: 0,
  shouldPark: () => true, reparent() {}, *parkSteps() {}, release() {} });

/**
 * Defer only ordinary static buffers that the first main-camera traversal would
 * immediately upload. No geometry, renderer setting or residency limit changes.
 * The caller must finish this plan before more construction or a mode switch.
 * Offscreen shadow uploads retain the original eager-parking path.
 */
export function collectFirstUploadParkingV323(roots: readonly Object3D[], camera: Camera): FirstUploadParkingV323 {
  if ((camera as Camera & { isArrayCamera?: boolean }).isArrayCamera || !roots.length) return empty();
  const scope = [...new Set(roots)], objects = new Set<RenderObject>();
  const allStorages = new Set<Storage>(), aliases = new Map<object, Set<Storage>>();
  let unknownAlias = false, unsafe = false;
  try {
    camera.updateWorldMatrix(true, false);
    for (const root of scope) root.updateWorldMatrix(true, true);
    const projection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!projection.elements.every(Number.isFinite)) return empty();
    const frustum = new Frustum().setFromProjectionMatrix(projection, camera.coordinateSystem, camera.reversedDepth);
    if (frustum.planes.some(p => !Number.isFinite(p.constant) || !p.normal.toArray().every(Number.isFinite))) return empty();
    for (const root of scope) root.traverse(o => {
      if ((o as Object3D & { isLOD?: boolean }).isLOD && visible(o)) unsafe = true;
      if (renderObject(o)) { objects.add(o); for (const storage of fields(o)) allStorages.add(storage); }
    });
    for (const storage of allStorages) {
      if (!ordinaryArray(storage) && !hasParkedStaticStorageBackingV323(storage)) { unknownAlias = true; continue; }
      const key = staticStorageInfo(storage).bufferIdentity;
      let set = aliases.get(key); if (!set) aliases.set(key, set = new Set());
      set.add(storage);
    }
    const selected = new Map<Storage, Entry>();
    const add = (storage: Storage, owner: Owner) => {
      const a = eligibleArray(storage); if (!a) return;
      let entry = selected.get(storage);
      if (!entry) {
        entry = { storage, array: a, version: storage.version, ranges: storage.updateRanges,
          ownsBuffer: owner.matrix, owners: [], disposed: false, cleanups: [] };
        selected.set(storage, entry);
      }
      // Geometry precedes instance parking in the old path; its shared view is
      // never detached even when also exposed as an instance matrix.
      entry.ownsBuffer &&= owner.matrix;
      entry.owners.push(owner);
    };
    for (const o of objects) {
      if (!visible(o) || !o.layers.test(camera.layers)) continue;
      const geometryFields = geometryEligible(o) ? Object.entries(o.geometry.attributes)
        .filter(([, a]) => eligibleArray(storageOf(a))) : [];
      const index = geometryEligible(o) && o.geometry.index && eligibleArray(o.geometry.index) ? o.geometry.index : null;
      const matrix = o instanceof InstancedMesh && eligibleArray(o.instanceMatrix) && !unknownAlias &&
        aliases.get(staticStorageInfo(o.instanceMatrix).bufferIdentity)?.size === 1 ? o.instanceMatrix : null;
      if (!geometryFields.length && !index && !matrix) continue;
      if (o.frustumCulled) {
        if (!o.matrixWorld.elements.every(Number.isFinite) || !boundsReady(o)) { unsafe = true; break; }
        if (!frustum.intersectsObject(o)) continue;
      }
      for (const [field, a] of geometryFields)
        add(storageOf(a), { object: o, geometry: o.geometry, field, matrix: false });
      if (index) add(index, { object: o, geometry: o.geometry, field: "#index", matrix: false });
      if (matrix) add(matrix, { object: o, geometry: o.geometry, field: "#matrix", matrix: true });
    }
    if (unsafe) return empty();
    // An aliased matrix cannot use the old exclusive-owned retirement contract.
    for (const [s, e] of selected) if (e.ownsBuffer && (unknownAlias || aliases.get(staticStorageInfo(s).bufferIdentity)?.size !== 1)) selected.delete(s);
    return plan(scope, selected);
  } catch {
    // Bad/custom bounds cannot turn a startup optimization into lost parking.
    return empty();
  }
}

function plan(roots: Object3D[], selected: Map<Storage, Entry>): FirstUploadParkingV323 {
  const buffers = new Set<ArrayBufferLike>();
  let bytes = 0;
  for (const e of selected.values()) {
    const array = e.array!;
    if (!buffers.has(array.buffer)) { buffers.add(array.buffer); bytes += array.byteLength; }
  }
  const count = selected.size;
  for (const e of selected.values()) for (const owner of e.owners) {
    const geometryDisposed = () => { if (!isSceneGeometryGpuRetirementV309(owner.geometry)) e.disposed = true; };
    owner.geometry.addEventListener("dispose", geometryDisposed);
    e.cleanups.push(() => owner.geometry.removeEventListener("dispose", geometryDisposed));
    if (owner.object instanceof InstancedMesh) {
      const mesh = owner.object, meshDisposed = () => { if (!isSceneInstanceGpuRetirementV309(mesh)) e.disposed = true; };
      mesh.addEventListener("dispose", meshDisposed);
      e.cleanups.push(() => mesh.removeEventListener("dispose", meshDisposed));
    }
  }
  let state: "pending" | "parking" | "done" | "released" = "pending";
  let child: Generator<void, number> | null = null;
  let active: Generator<void, void> | null = null;
  const forget = (e: Entry) => {
    for (const cleanup of e.cleanups) cleanup();
    e.cleanups.length = 0; e.owners.length = 0; e.array = null;
    selected.delete(e.storage);
  };
  const clear = () => { for (const e of selected.values()) forget(e); roots.length = 0; };
  const valid = (e: Entry): boolean => !!e.array && !e.disposed && eligibleArray(e.storage) === e.array &&
    e.storage.version === e.version && e.storage.updateRanges === e.ranges && e.owners.every(o =>
      within(o.object, roots) && o.object.geometry === o.geometry && (o.matrix
        ? o.object instanceof InstancedMesh && o.object.instanceMatrix === e.storage
        : geometryEligible(o.object) && (o.field === "#index" ? o.geometry.index === e.storage
          : o.geometry.getAttribute(o.field) && storageOf(o.geometry.getAttribute(o.field)) === e.storage)));
  const exclusive = (e: Entry): boolean => {
    if (!e.ownsBuffer) return true;
    let okay = true;
    for (const root of roots) root.traverse(o => {
      if (!renderObject(o)) return;
      for (const s of fields(o)) {
        if (s === e.storage) continue;
        if (!ordinaryArray(s) && !hasParkedStaticStorageBackingV323(s)) { okay = false; continue; }
        if (staticStorageInfo(s).bufferIdentity === staticStorageInfo(e.storage).bufferIdentity) okay = false;
      }
    });
    return okay;
  };
  return {
    bytes, count,
    shouldPark: storage => !((state === "pending" || state === "parking") && selected.has(storage)),
    reparent(nextRoots) {
      if (state === "pending") roots.splice(0, roots.length, ...new Set(nextRoots));
    },
    parkSteps() {
      if (state !== "pending") return (function* () {})();
      state = "parking";
      active = (function* () {
       try {
        for (const e of selected.values()) {
          if (!valid(e) || !exclusive(e)) { forget(e); continue; }
          child = parkStaticAttribute(e.storage, e.ownsBuffer);
          let resumes = 0;
          const chunks = Math.ceil(e.array!.byteLength / (256 * 1024));
          for (;;) {
            if (state !== "parking" || !valid(e)) { child?.return(0); break; }
            // Only the resume after the last block can install/detach. Do not
            // rescan the city for every 256 KiB compression block.
            if (e.ownsBuffer && resumes === chunks && !exclusive(e)) { child?.return(0); break; }
            const next = child.next();
            if (next.done) break;
            resumes++;
            yield;
          }
          child = null;
          forget(e);
          if (state !== "parking") return;
        }
      } finally {
        child?.return(0); child = null;
        if (state === "parking") state = "done";
        clear();
       }
      })();
      return active;
    },
    release() {
      if (state === "done" || state === "released") return;
      state = "released";
      active?.return(undefined); active = null;
      child?.return(0); child = null; clear();
    },
  };
}
