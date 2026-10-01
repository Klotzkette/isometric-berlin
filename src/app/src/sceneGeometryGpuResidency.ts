import {
  BufferAttribute, BufferGeometry, Frustum, InterleavedBuffer, Line, Matrix4,
  Mesh, Points, Vector3, type Camera, type Object3D, type WebGLRenderer,
} from "three";
import { registerInkRenderObserver } from "./inkDrawVisibility";

export const MOBILE_GEOMETRY_GPU_BUFFER_BUDGET = 6_000;
export const MOBILE_GEOMETRY_GPU_GRACE_MS = 2_000;
export const MOBILE_GEOMETRY_GPU_SCAN_INTERVAL_MS = 100;
export const MOBILE_GEOMETRY_GPU_SCAN_LIMIT = 128;
export const MOBILE_GEOMETRY_GPU_EMERGENCY_HEADROOM = 1_000;
export const MOBILE_GEOMETRY_GPU_JUMP_M = 128;

type Renderable = Mesh | Line | Points;
type AttributeStorage = BufferAttribute | InterleavedBuffer;
type GeometryEntry = {
  geometry: BufferGeometry;
  owners: Set<Owner>;
  attributes: AttributeStorage[];
  resident: boolean;
  mutable: boolean;
  wireframe: boolean;
  lastUse: number;
  onDispose: () => void;
};
type Owner = {
  object: Renderable;
  entry: GeometryEntry;
  active: boolean;
  original: Renderable["onAfterRender"];
  wrapped: Renderable["onAfterRender"];
};

export type SceneGeometryGpuResidency = {
  enqueue: (root: Object3D) => void;
  /** Unregister immediately before the root's authored disposal/removal. */
  release: (root: Object3D) => void;
  /** Run before drawing; immediate also retires all eligible previous-view buffers. */
  refresh: (now?: number, immediate?: boolean) => number;
  readonly residentBuffers: number;
  dispose: () => void;
};

function renderable(object: Object3D): object is Renderable {
  return object instanceof Mesh || object instanceof Line || object instanceof Points;
}

/** WebGLAttributes keys interleaved fields by their common data object. */
function geometryStorage(geometry: BufferGeometry): AttributeStorage[] {
  const attributes = Object.values(geometry.attributes);
  if (geometry.index) attributes.push(geometry.index);
  return [...new Set(attributes.map(attribute =>
    "isInterleavedBufferAttribute" in attribute ? attribute.data : attribute,
  ))];
}

/**
 * Retire only old, off-view GPU geometry, retaining every authored CPU buffer.
 * Register the complete scene (including hidden owners) before its first upload.
 * A geometry shared by visible objects, or an attribute shared across geometries,
 * cannot be retired here. Public BufferGeometry.dispose releases its WebGL
 * attributes/VAOs; Three uploads the identical arrays when it is drawn again.
 *
 * The count is a best-effort working-set budget, never a visibility limit. A
 * visible scene larger than the budget remains intact. Camera jumps and acute
 * pressure bypass the ordinary grace/scan limits before another view uploads.
 * Install after instance residency and before warmup; release in reverse order.
 */
export function createSceneGeometryGpuResidency(
  renderer: WebGLRenderer,
  camera: Camera,
  options: {
    budgetBuffers?: number;
    graceMs?: number;
    scanLimit?: number;
    scanIntervalMs?: number;
    emergencyHeadroomBuffers?: number;
    jumpDistanceM?: number;
    now?: () => number;
    onEvict?: (geometry: BufferGeometry) => void;
  } = {},
): SceneGeometryGpuResidency {
  const budget = options.budgetBuffers ?? MOBILE_GEOMETRY_GPU_BUFFER_BUDGET;
  const grace = options.graceMs ?? MOBILE_GEOMETRY_GPU_GRACE_MS;
  const scanLimit = options.scanLimit ?? MOBILE_GEOMETRY_GPU_SCAN_LIMIT;
  const scanInterval = options.scanIntervalMs ?? MOBILE_GEOMETRY_GPU_SCAN_INTERVAL_MS;
  const emergencyHeadroom = options.emergencyHeadroomBuffers ?? MOBILE_GEOMETRY_GPU_EMERGENCY_HEADROOM;
  const jumpDistance = options.jumpDistanceM ?? MOBILE_GEOMETRY_GPU_JUMP_M;
  const clock = options.now ?? (() => performance.now());
  const owners = new Map<Renderable, Owner>();
  const geometries = new Map<BufferGeometry, GeometryEntry>();
  const attributeOwners = new Map<AttributeStorage, Set<GeometryEntry>>();
  const residentAttributes = new Map<AttributeStorage, number>();
  const scan: GeometryEntry[] = [];
  const candidates: GeometryEntry[] = [];
  const projection = new Matrix4(), viewProjection = new Matrix4(), previousProjection = new Matrix4();
  const position = new Vector3(), previousPosition = new Vector3();
  const direction = new Vector3(), previousDirection = new Vector3();
  const frustum = new Frustum();
  let initializedView = false;
  let cursor = 0;
  let lastScan = -Infinity;
  let observedFrame = -1;
  let observedAt = 0;
  let residentBuffers = 0;
  let lastFullSweepBuffers = budget;
  let disposed = false;

  const forgetUpload = (entry: GeometryEntry): void => {
    if (!entry.resident) return;
    for (const attribute of entry.attributes) {
      const count = residentAttributes.get(attribute) ?? 0;
      if (count <= 1) {
        residentAttributes.delete(attribute);
        residentBuffers--;
      } else residentAttributes.set(attribute, count - 1);
    }
    if (entry.wireframe) residentBuffers--;
    entry.resident = false;
    entry.wireframe = false;
  };
  const registerAttribute = (entry: GeometryEntry, attribute: AttributeStorage): void => {
    let sharing = attributeOwners.get(attribute);
    if (!sharing) attributeOwners.set(attribute, sharing = new Set());
    sharing.add(entry);
  };
  const unregisterAttributes = (entry: GeometryEntry): void => {
    for (const attribute of entry.attributes) {
      const sharing = attributeOwners.get(attribute);
      sharing?.delete(entry);
      if (sharing?.size === 0) attributeOwners.delete(attribute);
    }
  };
  const observedUpload = (entry: GeometryEntry, wireframe: boolean): void => {
    if (!entry.resident) {
      const current = geometryStorage(entry.geometry);
      // Preparation may interleave storage between registration and first draw.
      unregisterAttributes(entry);
      entry.attributes = current;
      for (const attribute of current) registerAttribute(entry, attribute);
      entry.resident = true;
      entry.mutable = false;
      for (const attribute of current) {
        const count = residentAttributes.get(attribute) ?? 0;
        if (count === 0) residentBuffers++;
        residentAttributes.set(attribute, count + 1);
      }
    }
    if (wireframe && !entry.wireframe) { entry.wireframe = true; residentBuffers++; }
    entry.lastUse = observedAt;
  };
  const unchangedStorage = (entry: GeometryEntry): boolean => {
    // Attribute inspection belongs to the bounded sweep, never every draw.
    // A replaced attribute needs its authored disposal lifecycle. Conservatively
    // retain and count both old and new handles rather than risk shared storage.
    const current = geometryStorage(entry.geometry);
    if (current.length === entry.attributes.length &&
        current.every(attribute => entry.attributes.includes(attribute))) return true;
    entry.mutable = true;
    for (const attribute of current) {
      if (entry.attributes.includes(attribute)) continue;
      entry.attributes.push(attribute);
      registerAttribute(entry, attribute);
      const count = residentAttributes.get(attribute) ?? 0;
      if (count === 0) residentBuffers++;
      residentAttributes.set(attribute, count + 1);
    }
    return false;
  };
  const removeOwner = (owner: Owner): void => {
    owner.active = false;
    if (owner.object.onAfterRender === owner.wrapped) owner.object.onAfterRender = owner.original;
    owners.delete(owner.object);
    const entry = owner.entry;
    entry.owners.delete(owner);
    if (entry.owners.size) return;
    forgetUpload(entry);
    unregisterAttributes(entry);
    entry.geometry.removeEventListener("dispose", entry.onDispose);
    geometries.delete(entry.geometry);
  };
  const compactScan = (): void => {
    let retained = 0;
    for (const entry of scan) if (entry.owners.size) scan[retained++] = entry;
    scan.length = retained;
    cursor = retained ? cursor % retained : 0;
  };
  const enqueue = (root: Object3D): void => {
    if (disposed) return;
    root.traverse(object => {
      if (!renderable(object)) return;
      const previous = owners.get(object);
      if (previous?.entry.geometry === object.geometry) return;
      if (previous) removeOwner(previous);
      let entry = geometries.get(object.geometry);
      if (!entry) {
        entry = {
          geometry: object.geometry, owners: new Set(), attributes: geometryStorage(object.geometry),
          resident: false, mutable: false, wireframe: false, lastUse: -Infinity,
          onDispose: () => forgetUpload(entry!),
        };
        geometries.set(object.geometry, entry);
        for (const attribute of entry.attributes) registerAttribute(entry, attribute);
        object.geometry.addEventListener("dispose", entry.onDispose);
        scan.push(entry);
      }
      const owner: Owner = {
        object, entry, active: true, original: object.onAfterRender, wrapped: object.onAfterRender,
      };
      owner.wrapped = function (this: Renderable, ...args) {
        if (!disposed && owner.active && args[0] === renderer &&
            args[3] === owner.entry.geometry && object.geometry === owner.entry.geometry) {
          if (observedFrame !== renderer.info.render.frame) {
            observedFrame = renderer.info.render.frame;
            observedAt = clock();
          }
          observedUpload(owner.entry, "wireframe" in args[4] && args[4].wireframe === true);
        }
        owner.original.apply(this, args);
      };
      registerInkRenderObserver(owner.original, owner.wrapped);
      object.onAfterRender = owner.wrapped;
      owners.set(object, owner);
      entry.owners.add(owner);
    });
    compactScan();
  };
  const release = (root: Object3D): void => {
    root.traverse(object => {
      const owner = owners.get(object as Renderable);
      if (owner) removeOwner(owner);
    });
    compactScan();
  };
  const protectedOwner = (owner: Owner): boolean => {
    const object = owner.object;
    // A changed geometry must first be registered; avoid stale bounds/ownership.
    if (object.geometry !== owner.entry.geometry) return true;
    if (!object.layers.test(camera.layers)) return false;
    for (let parent: Object3D | null = object; parent; parent = parent.parent) {
      if (!parent.visible) return false;
    }
    if (!object.frustumCulled) return true;
    object.updateWorldMatrix(true, false);
    return frustum.intersectsObject(object);
  };
  const refresh = (now = clock(), immediate = false): number => {
    if (disposed || renderer.getContext().isContextLost()) return 0;
    camera.updateWorldMatrix(true, false);
    position.setFromMatrixPosition(camera.matrixWorld);
    camera.getWorldDirection(direction);
    const currentProjection = camera.projectionMatrix.elements;
    const priorProjection = previousProjection.elements;
    const scaleJump = (axis: number): boolean => {
      const current = Math.abs(currentProjection[axis]), prior = Math.abs(priorProjection[axis]);
      return current > prior * 1.25 || prior > current * 1.25;
    };
    // Small continuous pinch/wheel changes must not trigger a full scan each
    // frame. Large zoom changes and projection switches can expose a new view.
    const projectionJump = currentProjection[15] !== priorProjection[15] ||
      scaleJump(0) || scaleJump(5) ||
      Math.abs(currentProjection[8] - priorProjection[8]) > 0.5 ||
      Math.abs(currentProjection[9] - priorProjection[9]) > 0.5 ||
      Math.abs(currentProjection[12] - priorProjection[12]) > 0.5 ||
      Math.abs(currentProjection[13] - priorProjection[13]) > 0.5;
    const jumped = initializedView && (
      position.distanceToSquared(previousPosition) >= jumpDistance * jumpDistance ||
      direction.dot(previousDirection) < Math.cos(Math.PI / 5) ||
      projectionJump
    );
    // A wide visible view may legitimately exceed the soft budget. Do not scan
    // the entire protected scene again each frame: only fresh handle growth
    // earns another pressure-only full sweep. Falling residency rearms it.
    lastFullSweepBuffers = Math.min(lastFullSweepBuffers, Math.max(budget, residentBuffers));
    const pressureGrowth = residentBuffers >= lastFullSweepBuffers + Math.max(1, emergencyHeadroom);
    const urgent = immediate || jumped ||
      (residentBuffers > budget + emergencyHeadroom && pressureGrowth);
    const shouldScan = scan.length > 0 &&
      (urgent || (residentBuffers > budget && now - lastScan >= scanInterval));
    if (!initializedView || shouldScan) {
      // Compare against the last swept view so many small movements accumulate.
      previousPosition.copy(position); previousDirection.copy(direction);
      previousProjection.copy(camera.projectionMatrix);
      initializedView = true;
    }
    if (!shouldScan) return 0;
    lastScan = now;
    projection.copy(camera.projectionMatrix);
    for (const index of [0, 4, 8, 12, 1, 5, 9, 13]) projection.elements[index] *= 0.5;
    viewProjection.multiplyMatrices(projection, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection, camera.coordinateSystem);
    candidates.length = 0;
    const count = urgent ? scan.length : Math.min(scan.length, scanLimit);
    for (let index = 0; index < count; index++) {
      const entry = scan[cursor]; cursor = (cursor + 1) % scan.length;
      if (!entry.resident || entry.mutable || (!urgent && now - entry.lastUse < grace)) continue;
      if (!unchangedStorage(entry)) continue;
      if (entry.attributes.some(attribute => (attributeOwners.get(attribute)?.size ?? 0) !== 1)) continue;
      let protectedGeometry = false;
      for (const owner of entry.owners) {
        if (protectedOwner(owner)) { protectedGeometry = true; break; }
      }
      if (protectedGeometry) continue;
      candidates.push(entry);
    }
    candidates.sort((left, right) => left.lastUse - right.lastUse);
    let evicted = 0;
    for (const entry of candidates) {
      if (!immediate && !jumped && residentBuffers <= budget) break;
      entry.geometry.dispose();
      options.onEvict?.(entry.geometry);
      evicted++;
    }
    candidates.length = 0;
    if (urgent) lastFullSweepBuffers = residentBuffers;
    return evicted;
  };
  const contextLost = (): void => {
    for (const entry of geometries.values()) forgetUpload(entry);
    observedFrame = -1;
    lastFullSweepBuffers = budget;
  };
  renderer.domElement?.addEventListener("webglcontextlost", contextLost);
  return {
    enqueue, release, refresh,
    get residentBuffers() { return residentBuffers; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const owner of owners.values()) removeOwner(owner);
      scan.length = 0; candidates.length = 0;
      attributeOwners.clear(); residentAttributes.clear();
      renderer.domElement?.removeEventListener("webglcontextlost", contextLost);
    },
  };
}
