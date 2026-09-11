import {
  BufferGeometry, InstancedMesh, Line, Material, Mesh, Points, Vector4,
  WebGLRenderTarget,
  type Camera, type Object3D, type Scene, type WebGLRenderer,
} from "three";

// Spatial park cells share geometry and carry small instance buffers. Keep
// the byte ceiling, but amortize scene traversal over more of these tiny draws.
export const GPU_WARMUP_MAX_OBJECTS = 32;
export const GPU_WARMUP_MAX_BYTES = 2 * 1024 * 1024;

type Renderable = Mesh | Line | Points;
type Snapshot = readonly unknown[];
type GpuResource = BufferGeometry | Material | InstancedMesh;

export type SceneGpuWarmup = {
  enqueue: (root: Object3D) => void;
  /** Stop retaining an evicted subtree before its CPU/GPU resources are freed. */
  release: (root: Object3D) => void;
  /** One synchronous, bounded upload task. Returns the warmed object count. */
  warmNext: () => number;
  readonly pending: boolean;
  dispose: () => void;
};

function renderable(object: Object3D): object is Renderable {
  return object instanceof Mesh || object instanceof Line || object instanceof Points;
}

function materials(object: Renderable): Material[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

function active(object: Renderable, scene: Scene, camera: Camera): boolean {
  if (!object.layers.test(camera.layers) || !materials(object).some((item) => item.visible)) return false;
  for (let parent: Object3D | null = object; parent; parent = parent.parent) {
    if (!parent.visible) return false;
    if (parent === scene) return true;
  }
  return false;
}

function attributes(object: Renderable) {
  const result = Object.values(object.geometry.attributes);
  if (object.geometry.index) result.push(object.geometry.index);
  if (object instanceof InstancedMesh) {
    result.push(object.instanceMatrix);
    if (object.instanceColor) result.push(object.instanceColor);
  }
  return result;
}

function same(left: Snapshot | undefined, right: Snapshot): boolean {
  return !!left && left.length === right.length && left.every((item, index) => item === right[index]);
}

/**
 * Make offscreen city buffers resident before the camera first encounters them.
 * Three uploads attributes only after its frustum test. A zero-count render into
 * a tiny target reaches that same public upload and shader path, including
 * instance/index buffers, without drawing vertices. Nothing is reparented or
 * cloned; temporary flags are restored synchronously even on rendering errors.
 * Queued objects encountered by the ordinary view leave the queue after their
 * real upload, avoiding a redundant preparation render of the entire scene.
 */
export function createSceneGpuWarmup(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
): SceneGpuWarmup {
  const target = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  // Three keys its physical-glass transmission target by camera id. A separate
  // camera keeps this 1 px pass from shrinking/reallocating the live glass target.
  const PreparationCamera = camera.constructor as new () => Camera;
  const preparationCamera = new PreparationCamera();
  let warmed = new WeakMap<Renderable, Snapshot>();
  const epochs = new WeakMap<GpuResource, number>();
  const watched = new Map<GpuResource, () => void>();
  const queued = new Set<Renderable>();
  const queue: Renderable[] = [];
  const renderHooks = new Map<Renderable, {
    original: Renderable["onAfterRender"];
    wrapped: Renderable["onAfterRender"];
  }>();
  let observedFrame = -1;
  let observedContext: Snapshot = [];
  let disposed = false;

  const watch = (resource: GpuResource): void => {
    if (watched.has(resource)) return;
    const onDispose = (): void => {
      epochs.set(resource, (epochs.get(resource) ?? 0) + 1);
      (resource as BufferGeometry).removeEventListener("dispose", onDispose);
      watched.delete(resource);
    };
    (resource as BufferGeometry).addEventListener("dispose", onDispose);
    watched.set(resource, onDispose);
  };

  const context = (): Snapshot => {
    const lights: unknown[] = [];
    scene.traverseVisible((object) => {
      if ((object as Object3D & { isLight?: boolean }).isLight && object.layers.test(camera.layers)) {
        lights.push(object.type, object.castShadow);
      }
    });
    return [scene.fog, scene.environment, scene.overrideMaterial,
      renderer.shadowMap.enabled, renderer.shadowMap.type,
      renderer.localClippingEnabled, renderer.clippingPlanes.length,
      camera.layers.mask, ...lights];
  };

  const snapshot = (object: Renderable, state: Snapshot): Snapshot => {
    const values: unknown[] = [object.geometry, epochs.get(object.geometry) ?? 0,
      epochs.get(object as InstancedMesh) ?? 0, object.receiveShadow, ...state];
    for (const material of materials(object)) {
      values.push(material, material.version, epochs.get(material) ?? 0,
        material.visible, material.customProgramCacheKey());
    }
    for (const attribute of attributes(object)) {
      const buffer = "data" in attribute ? attribute.data : attribute;
      values.push(attribute, buffer, buffer.version, buffer.array);
    }
    return values;
  };

  const restoreRenderHook = (object: Renderable): void => {
    const hook = renderHooks.get(object);
    if (!hook) return;
    // An authored callback may replace itself while it runs. Do not overwrite
    // that replacement when removing this temporary residency observer.
    if (object.onAfterRender === hook.wrapped) object.onAfterRender = hook.original;
    renderHooks.delete(object);
  };

  const observeOrdinaryUpload = (object: Renderable): void => {
    if (renderHooks.has(object)) return;
    const original = object.onAfterRender;
    const seenMaterials = new Set<Material>();
    let seenSnapshot: Snapshot | undefined;
    const wrapped: Renderable["onAfterRender"] = function (this: Renderable, ...args) {
      const [drawingRenderer, drawingScene, drawingCamera, geometry, material] = args;
      const ordinary = drawingRenderer === renderer && drawingScene === scene &&
        drawingCamera === camera && queued.has(object);
      let current: Snapshot | undefined;
      if (ordinary) {
        // A real render has already uploaded the buffers and compiled this
        // material. Share one light/context scan across its queued objects.
        if (observedFrame !== renderer.info.render.frame) {
          observedFrame = renderer.info.render.frame;
          observedContext = context();
        }
        current = snapshot(object, observedContext);
        if (!same(seenSnapshot, current)) {
          seenSnapshot = current;
          seenMaterials.clear();
        }
        seenMaterials.add(material);
      }
      original.apply(this, args);
      if (!current || geometry !== object.geometry ||
          !same(current, snapshot(object, observedContext))) return;
      const list = materials(object);
      const expected = Array.isArray(object.material)
        ? object.geometry.groups
          .filter((group) => group.count > 0 &&
            group.start < geometry.drawRange.start + geometry.drawRange.count &&
            group.start + group.count > geometry.drawRange.start)
          .map((group) => list[group.materialIndex ?? 0])
        : list;
      if (!expected.filter((item) => item?.visible).every((item) => seenMaterials.has(item))) return;
      warmed.set(object, current);
      queued.delete(object);
      const index = queue.indexOf(object);
      if (index >= 0) queue.splice(index, 1);
      restoreRenderHook(object);
    };
    renderHooks.set(object, { original, wrapped });
    object.onAfterRender = wrapped;
  };

  const enqueue = (root: Object3D): void => {
    if (disposed) return;
    const state = context();
    root.traverseVisible((object) => {
      if (!renderable(object) || !active(object, scene, camera)) return;
      if (same(warmed.get(object), snapshot(object, state)) || queued.has(object)) return;
      watch(object.geometry);
      for (const material of materials(object)) watch(material);
      if (object instanceof InstancedMesh) watch(object);
      queued.add(object);
      queue.push(object);
      observeOrdinaryUpload(object);
    });
  };

  const release = (root: Object3D): void => {
    root.traverse((object) => {
      if (!renderable(object)) return;
      warmed.delete(object);
      queued.delete(object);
      restoreRenderHook(object);
    });
    // A disposed district must not wait for another warmup task (which may
    // be suspended in a hidden tab) before its attribute arrays can be freed.
    let retained = 0;
    for (const object of queue) {
      if (queued.has(object)) queue[retained++] = object;
    }
    queue.length = retained;
  };

  const onContextRestored = (): void => {
    warmed = new WeakMap();
    enqueue(scene);
  };
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

  const warmNext = (): number => {
    if (disposed || queue.length === 0 || renderer.getContext().isContextLost()) return 0;
    const selected: Renderable[] = [];
    const selectedBuffers = new Set<ArrayBufferLike>();
    let bytes = 0;
    const state = context();
    while (queue.length && selected.length < GPU_WARMUP_MAX_OBJECTS) {
      const object = queue[0];
      if (!active(object, scene, camera) || same(warmed.get(object), snapshot(object, state))) {
        queue.shift(); queued.delete(object);
        restoreRenderHook(object);
        continue;
      }
      const newBuffers = new Set(attributes(object).map((attribute) => attribute.array.buffer)
        .filter((buffer) => !selectedBuffers.has(buffer)));
      const additionalBytes = [...newBuffers].reduce((total, buffer) => total + buffer.byteLength, 0);
      // Existing large buffers are indivisible. Warm one alone rather than
      // split/copy authored buffers or silently skip its exact geometry.
      if (selected.length && bytes + additionalBytes > GPU_WARMUP_MAX_BYTES) break;
      queue.shift(); queued.delete(object);
      restoreRenderHook(object);
      selected.push(object);
      bytes += additionalBytes;
      for (const buffer of newBuffers) selectedBuffers.add(buffer);
    }
    if (selected.length === 0) return 0;

    const selectedSet = new Set(selected);
    const layers = new Map<Renderable, number>();
    const culling = new Map<Renderable, boolean>();
    const ranges = new Map<BufferGeometry, { start: number; count: number }>();
    const savedTarget = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace();
    const mipLevel = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new Vector4());
    const scissor = renderer.getScissor(new Vector4());
    const scissorTest = renderer.getScissorTest();
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
    const background = scene.background;
    try {
      scene.traverse((object) => {
        if (!renderable(object)) return;
        if (!selectedSet.has(object)) {
          layers.set(object, object.layers.mask);
          // Layers filter this renderable without hiding selected children
          // or lights beneath a mesh ancestor.
          object.layers.mask = 0;
        }
      });
      for (const object of selected) {
        const geometry: BufferGeometry = object.geometry;
        // The first real frustum test must not inherit a deferred vertex or
        // instance scan either. Compute the same bounds Three would compute.
        if (object.frustumCulled) {
          if (object instanceof InstancedMesh) {
            if (object.boundingSphere === null) object.computeBoundingSphere();
          } else if (geometry.boundingSphere === null) {
            geometry.computeBoundingSphere();
          }
        }
        culling.set(object, object.frustumCulled);
        object.frustumCulled = false;
        if (!ranges.has(geometry)) {
          ranges.set(geometry, { ...geometry.drawRange });
          const list = materials(object);
          // The first visible material group may start after vertex zero. Its
          // zero-count range must still reach the renderer's index binding.
          const firstGroup = geometry.groups.find((group) => list[group.materialIndex ?? 0]?.visible);
          geometry.setDrawRange(Array.isArray(object.material) ? firstGroup?.start ?? 0 : 0, 0);
        }
      }
      scene.background = null;
      // Preserve both the shader shadow variant and the existing shadow atlas.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, 1, 1);
      renderer.setScissorTest(false);
      preparationCamera.copy(camera, false);
      renderer.render(scene, preparationCamera);
    } finally {
      for (const [object, mask] of layers) object.layers.mask = mask;
      for (const [object, frustumCulled] of culling) object.frustumCulled = frustumCulled;
      for (const [geometry, range] of ranges) geometry.setDrawRange(range.start, range.count);
      scene.background = background;
      renderer.shadowMap.autoUpdate = shadowAutoUpdate;
      renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
      renderer.setRenderTarget(savedTarget, cubeFace, mipLevel);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
    }
    const finalState = context();
    for (const object of selected) warmed.set(object, snapshot(object, finalState));
    return selected.length;
  };

  return {
    enqueue,
    release,
    warmNext,
    get pending() { return !disposed && queue.length > 0 && !renderer.getContext().isContextLost(); },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      queue.length = 0;
      queued.clear();
      for (const object of renderHooks.keys()) restoreRenderHook(object);
      for (const [resource, listener] of watched) (resource as BufferGeometry).removeEventListener("dispose", listener);
      watched.clear();
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      target.dispose();
    },
  };
}
