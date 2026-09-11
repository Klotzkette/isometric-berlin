import { heapStats } from "bun:jsc";
import {
  BufferGeometry, Group, InstancedMesh, LineSegments, Material, Mesh,
  OrthographicCamera, Scene, type WebGLRenderer,
} from "three";
import { createIsometricCity, setIsoNightPresentation, type PrismPayload } from "../src/IsometricCityWorld";
import { compactStaticGeometry } from "../src/compactStaticGeometry";
import { createSceneGpuWarmup, type SceneGpuWarmup } from "../src/sceneGpuWarmup";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";

// --retain-queue reproduces the previous integration: evicted GPU resources
// were disposed, but preparation still held their meshes until its next task.
const retainQueue = Bun.argv.includes("--retain-queue");
const modes = ["day", "night", "snowstorm", "schwellenraum"] as const;
const scene = new Scene();
const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
const renderer = {
  domElement: new EventTarget(),
  shadowMap: { enabled: false, type: 1 },
  localClippingEnabled: false, clippingPlanes: [],
  getContext: () => ({ isContextLost: () => false }),
} as unknown as WebGLRenderer;
const warmup = createSceneGpuWarmup(renderer, scene, camera);
const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;

function loadAndEvict(warmup: SceneGpuWarmup) {
  const references = new Map<ArrayBufferLike, { bytes: number; names: Set<string> }>();
  const objects: WeakRef<Mesh | LineSegments>[] = [];
  for (let district = 0; district < 16; district++) {
    const buildings = payload.buildings.slice(1000 + district * 240, 1240 + district * 240);
    const root: Group = createIsometricCity(payload, null, null, null, {
      buildings, detailProfile: "mobile", includeContext: false,
    });
    const mode = modes[district % modes.length];
    setIsoNightPresentation(root, mode === "night", true, mode);
    const visible = new Set<Mesh | LineSegments>();
    root.traverseVisible(object => { if (object instanceof Mesh || object instanceof LineSegments) visible.add(object); });
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    root.traverse(object => {
      compactStaticGeometry(object);
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      geometries.add(object.geometry);
      for (const material of objectMaterialsIncludingTransferredAlternates(object)) materials.add(material);
      if (!visible.has(object)) return;
      objects.push(new WeakRef(object));
      const attributes = [...Object.values(object.geometry.attributes), object.geometry.index];
      if (object instanceof InstancedMesh) attributes.push(object.instanceMatrix, object.instanceColor);
      for (const attribute of attributes) if (attribute) {
        const reference = references.get(attribute.array.buffer) ?? { bytes: attribute.array.buffer.byteLength, names: new Set<string>() };
        reference.names.add(object.name);
        references.set(attribute.array.buffer, reference);
      }
    });
    scene.add(root);
    warmup.enqueue(root);
    if (!retainQueue) warmup.release(root);
    root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    root.removeFromParent(); root.clear();
  }
  return { objects, buffers: [...references].map(([buffer, entry]) => ({ buffer: new WeakRef(buffer), ...entry })) };
}

const tracked = await new Promise<ReturnType<typeof loadAndEvict>>(resolve => {
  setTimeout(() => resolve(loadAndEvict(warmup)), 0);
});
for (let turn = 0; turn < 8; turn++) {
  Bun.gc(true);
  await new Promise(resolve => setTimeout(resolve, 10));
}
const references = tracked.buffers;
const retainedObjects = tracked.objects.filter(reference => reference.deref() !== undefined);
const retained = references.filter(reference => reference.buffer.deref() !== undefined);
console.log(JSON.stringify({
  retainQueue, modes, districts: 16, buffers: references.length,
  evictedBufferBytes: references.reduce((sum, reference) => sum + reference.bytes, 0),
  retainedObjects: retainedObjects.length,
  retainedBuffers: retained.length,
  retainedBufferBytes: retained.reduce((sum, reference) => sum + reference.bytes, 0),
  preparationPending: warmup.pending, heapBytes: heapStats().heapSize,
  retainedNames: [...new Set(retained.flatMap(reference => [...reference.names]))],
}));
warmup.dispose();
if (!retainQueue && retainedObjects.length > 0) throw new Error("Evicted preparation objects remain reachable");
