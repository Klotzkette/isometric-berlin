import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  BufferGeometry, Group, InstancedMesh, Line, Material, Mesh,
  OrthographicCamera, Scene, type Object3D, type WebGLRenderer,
} from "three";
import { createOutlineLandmarksV182 } from "../src/OutlineLandmarksV182";
import { createOuterThinOutlines } from "../src/OuterThinOutlines";
import { createSceneGpuResidency } from "../src/sceneGpuResidency";
import { createSceneGeometryGpuResidency } from "../src/sceneGeometryGpuResidency";
import { createSceneGpuWarmup } from "../src/sceneGpuWarmup";
import type { VisualMode } from "../src/visualMode";

function renderables(root: Object3D): Array<Mesh | Line> {
  const result: Array<Mesh | Line> = [];
  root.traverse(object => { if (object instanceof Mesh || object instanceof Line) result.push(object); });
  return result;
}

function resources(root: Object3D) {
  const geometry = new Set<BufferGeometry>(), material = new Set<Material>(), instances = new Set<InstancedMesh>();
  for (const object of renderables(root)) {
    geometry.add(object.geometry);
    if (object instanceof InstancedMesh) instances.add(object);
    for (const value of [object.material, object.userData.dayMaterial, object.userData.nightMaterial]) {
      for (const candidate of Array.isArray(value) ? value : [value]) {
        if (candidate instanceof Material) material.add(candidate);
      }
    }
  }
  return [...geometry, ...material, ...instances];
}

/** Hash every real buffer byte: no floating point tolerance or sampled vertices. */
function signature(root: Object3D) {
  return renderables(root).map(object => {
    const digest = (array: ArrayBufferView) => createHash("sha256")
      .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest("hex");
    const attributes = Object.entries(object.geometry.attributes).map(([name, attribute]) =>
      [name, attribute.itemSize, digest(attribute.array)]);
    return {
      name: object.name, attributes,
      index: object.geometry.index && digest(object.geometry.index.array),
      instances: object instanceof InstancedMesh ? {
        count: object.count, matrices: digest(object.instanceMatrix.array),
        colors: object.instanceColor && digest(object.instanceColor.array),
      } : null,
    };
  });
}

test("mode families release residency owners, alternate materials and instance buffers before exact reconstruction", () => {
  const scene = new Scene(), camera = new OrthographicCamera(-5, 5, 5, -5, .1, 1000);
  const renderer = {
    domElement: new EventTarget(), info: { render: { frame: 1 } },
    shadowMap: { enabled: false, type: 2 }, localClippingEnabled: false, clippingPlanes: [],
    getContext: () => ({ isContextLost: () => false }),
  } as unknown as WebGLRenderer;
  const instances = createSceneGpuResidency(renderer, camera);
  const geometry = createSceneGeometryGpuResidency(renderer, camera);
  const warmup = createSceneGpuWarmup(renderer, scene, camera);
  let releases = 0;
  let originals = new Map<Mesh | Line, Mesh["onAfterRender"]>();
  const root = createOutlineLandmarksV182("day", previous => {
    expect(previous.children).toHaveLength(7); // Still traversable at release.
    warmup.release(previous);
    geometry.release(previous);
    instances.release(previous);
    expect(warmup.pending).toBeFalse();
    expect(geometry.residentBuffers).toBe(0);
    expect(instances.residentBuffers).toBe(0);
    for (const [object, original] of originals) expect(object.onAfterRender).toBe(original);
    releases++;
  });
  scene.add(root);
  const register = () => {
    originals = new Map(renderables(root).map(object => [object, object.onAfterRender]));
    instances.enqueue(root); geometry.enqueue(root); warmup.enqueue(root);
    // One real upload observation, leaving other objects in the warmup queue.
    const instance = renderables(root).find(object => object instanceof InstancedMesh)!;
    const material = Array.isArray(instance.material) ? instance.material[0] : instance.material;
    instance.onAfterRender(renderer, scene, camera, instance.geometry, material, null);
    expect(warmup.pending).toBeTrue();
    expect(instances.residentBuffers).toBeGreaterThan(0);
  };
  const daySignature = signature(root);
  let nativeSignature: ReturnType<typeof signature> | undefined;
  try {
    const retained = [...root.children];
    for (const mode of ["night", "snowstorm", "schwellenraum", "flood", "day"] satisfies VisualMode[]) {
      root.userData.setMode(mode);
      expect(root.children).toEqual(retained);
      expect(releases).toBe(0);
      for (const object of renderables(root)) {
        const expected = object.userData[mode === "night" ? "nightMaterial" : "dayMaterial"];
        if (expected) expect(object.material).toBe(expected);
      }
    }
    for (const mode of ["minecraft", "day", "minecraft", "day"] satisfies VisualMode[]) {
      register();
      const previous = [...root.children];
      const counts = resources(root).map(resource => {
        const record = { disposed: 0 };
        resource.addEventListener("dispose", () => { record.disposed++; });
        return record;
      });
      root.userData.setMode(mode);
      expect(previous.every(child => child.parent === null)).toBeTrue();
      expect(counts.every(record => record.disposed === 1)).toBeTrue();
      expect(root.children).toHaveLength(7);
      expect(root.children.every(child => child.userData.nativeMinecraft === (mode === "minecraft"))).toBeTrue();
      if (mode === "day") expect(signature(root)).toEqual(daySignature);
      else if (nativeSignature) expect(signature(root)).toEqual(nativeSignature);
      else nativeSignature = signature(root);
    }
    expect(releases).toBe(4);
  } finally {
    warmup.release(root); geometry.release(root); instances.release(root);
    for (const resource of resources(root)) resource.dispose();
    root.clear(); scene.clear(); warmup.dispose(); geometry.dispose(); instances.dispose();
  }
});

test("outer outline mode routing keeps shared map buffers and releases only the changed landmark family", () => {
  const released: Object3D[][] = [];
  const root = createOuterThinOutlines("day", previous => released.push([...previous.children]));
  const mapObjects = root.children.slice(0, 3);
  const positions = (mapObjects[0] as Line).geometry.getAttribute("position");
  const original = signature(root);
  try {
    root.userData.setMode("night");
    expect(released).toHaveLength(0);
    root.userData.setMode("minecraft");
    root.userData.setMode("day");
    expect(released).toHaveLength(2);
    expect(released.flat().every(object => object.parent === null)).toBeTrue();
    expect(root.children.slice(0, 3)).toEqual(mapObjects);
    expect((mapObjects[2] as Line).geometry.getAttribute("position")).toBe(positions);
    expect(signature(root)).toEqual(original);
  } finally {
    for (const resource of resources(root)) resource.dispose();
    root.clear();
  }
});
