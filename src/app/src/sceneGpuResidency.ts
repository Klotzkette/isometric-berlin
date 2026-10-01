import { Frustum, InstancedMesh, Matrix4, Quaternion, Vector3, type Camera, type Object3D, type WebGLRenderer } from "three";
import { registerInkRenderObserver } from "./inkDrawVisibility";

export const MOBILE_INSTANCE_GPU_BUDGET_BYTES = 48 * 1024 * 1024;
export const MOBILE_INSTANCE_GPU_BUDGET_BUFFERS = 2_500;
export const MOBILE_GPU_RESIDENCY_GRACE_MS = 2_000;
export const MOBILE_GPU_RESIDENCY_SCAN_INTERVAL_MS = 100;
export const MOBILE_GPU_RESIDENCY_SCAN_LIMIT = 64;
export const MOBILE_GPU_RESIDENCY_JUMP_METERS = 128;
export const MOBILE_GPU_RESIDENCY_TURN_DEGREES = 36;

type Entry = {
  mesh: InstancedMesh;
  original: InstancedMesh["onAfterRender"];
  wrapped: InstancedMesh["onAfterRender"];
  onDispose: () => void;
  attributes: object[];
  resident: boolean;
  bytes: number;
  lastUse: number;
  active: boolean;
};

export type SceneGpuResidency = {
  enqueue: (root: Object3D) => void;
  release: (root: Object3D) => void;
  refresh: (now?: number, immediate?: boolean) => number;
  readonly residentBytes: number;
  readonly residentBuffers: number;
  dispose: () => void;
};

/**
 * Bound speculative/previous-view instance storage, never authored detail.
 * Public InstancedMesh.dispose releases only its GPU instance buffers/VAOs;
 * Three reuploads its unchanged CPU attributes on the next ordinary draw.
 * Shared base geometry and materials are deliberately outside this policy.
 * Install before GPU warmup; release warmup before releasing these observers.
 */
export function createSceneGpuResidency(
  renderer: WebGLRenderer,
  camera: Camera,
  options: {
    budgetBytes?: number;
    budgetBuffers?: number;
    graceMs?: number;
    now?: () => number;
    onEvict?: (mesh: InstancedMesh) => void;
  } = {},
): SceneGpuResidency {
  const budget = options.budgetBytes ?? MOBILE_INSTANCE_GPU_BUDGET_BYTES;
  const bufferBudget = options.budgetBuffers ?? MOBILE_INSTANCE_GPU_BUDGET_BUFFERS;
  const grace = options.graceMs ?? MOBILE_GPU_RESIDENCY_GRACE_MS;
  const clock = options.now ?? (() => performance.now());
  const entries = new Map<InstancedMesh, Entry>();
  const attributeOwners = new Map<object, Set<Entry>>();
  const residentAttributes = new Map<object, number>();
  const scan: Entry[] = [];
  const projection = new Matrix4();
  const view = new Matrix4();
  const frustum = new Frustum();
  const cleanupPosition = new Vector3();
  const currentPosition = new Vector3();
  const cleanupRotation = new Quaternion();
  const currentRotation = new Quaternion();
  const cleanupProjection = new Matrix4();
  let haveCleanupPose = false;
  let residentBytes = 0;
  let cursor = 0;
  let lastScan = -Infinity;
  let observedFrame = -1;
  let observedAt = 0;
  let disposed = false;

  const forgetUpload = (entry: Entry): void => {
    if (entry.resident) {
      residentBytes -= entry.bytes;
      for (const attribute of entry.attributes) {
        const remaining = (residentAttributes.get(attribute) ?? 1) - 1;
        if (remaining > 0) residentAttributes.set(attribute, remaining);
        else residentAttributes.delete(attribute);
      }
    }
    entry.resident = false;
  };
  const releaseEntry = (entry: Entry): void => {
    entry.active = false;
    forgetUpload(entry);
    if (entry.mesh.onAfterRender === entry.wrapped) entry.mesh.onAfterRender = entry.original;
    entry.mesh.removeEventListener("dispose", entry.onDispose);
    for (const attribute of entry.attributes) {
      const owners = attributeOwners.get(attribute);
      owners?.delete(entry);
      if (owners?.size === 0) attributeOwners.delete(attribute);
    }
    entries.delete(entry.mesh);
  };
  const enqueue = (root: Object3D): void => {
    if (disposed) return;
    root.traverse((object) => {
      if (!(object instanceof InstancedMesh) || entries.has(object)) return;
      const attributes = [object.instanceMatrix, ...(object.instanceColor ? [object.instanceColor] : [])];
      const entry: Entry = {
        mesh: object, original: object.onAfterRender, wrapped: object.onAfterRender,
        onDispose: () => forgetUpload(entry), attributes,
        resident: false, bytes: attributes.reduce((sum, attribute) => sum + attribute.array.byteLength, 0),
        lastUse: -Infinity, active: true,
      };
      entry.wrapped = function (this: InstancedMesh, ...args) {
        if (!disposed && entry.active && args[0] === renderer) {
          if (observedFrame !== renderer.info.render.frame) {
            observedFrame = renderer.info.render.frame;
            observedAt = clock();
          }
          if (!entry.resident) {
            entry.resident = true; residentBytes += entry.bytes;
            for (const attribute of entry.attributes) {
              residentAttributes.set(attribute, (residentAttributes.get(attribute) ?? 0) + 1);
            }
          }
          entry.lastUse = observedAt;
        }
        entry.original.apply(this, args);
      };
      registerInkRenderObserver(entry.original, entry.wrapped);
      object.onAfterRender = entry.wrapped;
      object.addEventListener("dispose", entry.onDispose);
      for (const attribute of attributes) {
        let owners = attributeOwners.get(attribute);
        if (!owners) attributeOwners.set(attribute, owners = new Set());
        owners.add(entry);
      }
      entries.set(object, entry);
      scan.push(entry);
    });
  };
  const release = (root: Object3D): void => {
    root.traverse((object) => {
      const entry = entries.get(object as InstancedMesh);
      if (entry) releaseEntry(entry);
    });
    // Detached districts must not remain strongly referenced until another tick.
    let length = 0;
    for (const entry of scan) if (entry.active) scan[length++] = entry;
    scan.length = length;
    cursor = scan.length ? cursor % scan.length : 0;
  };
  const overBudget = (): boolean => residentBytes > budget || residentAttributes.size > bufferBudget;
  const refresh = (now = clock(), immediate = false): number => {
    if (disposed || !scan.length || renderer.getContext().isContextLost()) return 0;
    camera.updateWorldMatrix(true, false);
    currentPosition.setFromMatrixPosition(camera.matrixWorld);
    camera.getWorldQuaternion(currentRotation);
    // Accumulate movement from the last complete cleanup, including ordinary
    // smooth flight. Large pose changes must release obsolete views before
    // uploading the next one, rather than retaining them for the normal grace.
    const urgent = immediate || (haveCleanupPose && (
      currentPosition.distanceToSquared(cleanupPosition) >= MOBILE_GPU_RESIDENCY_JUMP_METERS ** 2 ||
      Math.abs(currentRotation.dot(cleanupRotation)) <= Math.cos(MOBILE_GPU_RESIDENCY_TURN_DEGREES * Math.PI / 360) ||
      camera.projectionMatrix.elements.some((value, i) =>
        Math.abs(value - cleanupProjection.elements[i]) > Math.max(0.1, Math.abs(cleanupProjection.elements[i]) * 0.2))
    ));
    if (!haveCleanupPose || urgent) {
      haveCleanupPose = true;
      cleanupPosition.copy(currentPosition); cleanupRotation.copy(currentRotation);
      cleanupProjection.copy(camera.projectionMatrix);
    }
    if (!urgent && (!overBudget() || now - lastScan < MOBILE_GPU_RESIDENCY_SCAN_INTERVAL_MS)) return 0;
    lastScan = now;
    projection.copy(camera.projectionMatrix);
    for (const index of [0, 4, 8, 12, 1, 5, 9, 13]) projection.elements[index] *= 0.5;
    view.multiplyMatrices(projection, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(view, camera.coordinateSystem);
    let evicted = 0;
    const count = urgent ? scan.length : Math.min(scan.length, MOBILE_GPU_RESIDENCY_SCAN_LIMIT);
    for (let i = 0; i < count && (urgent || overBudget()); i++) {
      const entry = scan[cursor]; cursor = (cursor + 1) % scan.length;
      if (!entry.resident || (!urgent && now - entry.lastUse < grace) ||
          entry.attributes.some((attribute) => (attributeOwners.get(attribute)?.size ?? 0) !== 1)) continue;
      const mesh = entry.mesh;
      // Stock dispose also destroys and nulls morphTexture. This policy must
      // never mutate authored CPU-side deformation state.
      if (mesh.morphTexture !== null) continue;
      // Changes of attribute ownership require a fresh registration. Preserve
      // them conservatively rather than freeing an untracked shared buffer.
      if (mesh.instanceMatrix !== entry.attributes[0] ||
          (mesh.instanceColor ?? undefined) !== entry.attributes[1]) continue;
      let visible = mesh.layers.test(camera.layers);
      for (let parent: Object3D | null = mesh; parent && visible; parent = parent.parent) visible = parent.visible;
      if (visible) {
        if (!mesh.frustumCulled) continue;
        mesh.updateWorldMatrix(true, false);
        if (frustum.intersectsObject(mesh)) continue;
      }
      mesh.dispose();
      options.onEvict?.(mesh);
      evicted++;
    }
    return evicted;
  };
  return {
    enqueue, release, refresh,
    get residentBytes() { return residentBytes; },
    get residentBuffers() { return residentAttributes.size; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) releaseEntry(entry);
      scan.length = 0;
      attributeOwners.clear();
      residentAttributes.clear();
    },
  };
}
