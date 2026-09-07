import { InstancedMesh, LineSegments, Mesh, type Object3D } from "three";
import { createArchitecturalSignature, type ArchitecturalSignature } from "../src/ArchitecturalLandmarks";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import scene from "../public/mesh/regierungsviertel/scene.json";

/** Stored geometry/instance buffers, independent of camera and visibility culling. */
function measure(root: Object3D): object {
  const geometries = new Set();
  let renderables = 0, renderedVertices = 0, bufferBytes = 0, instances = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    renderables += 1;
    const count = object instanceof InstancedMesh ? object.count : 1;
    renderedVertices += object.geometry.getAttribute("position").count * count;
    if (object instanceof InstancedMesh) {
      instances += count;
      bufferBytes += object.instanceMatrix.array.byteLength;
      bufferBytes += object.instanceColor?.array.byteLength ?? 0;
    }
    if (geometries.has(object.geometry)) return;
    geometries.add(object.geometry);
    for (const attribute of Object.values(object.geometry.attributes)) {
      bufferBytes += attribute.array.byteLength;
    }
    bufferBytes += object.geometry.index?.array.byteLength ?? 0;
  });
  return { renderables, renderedVertices, bufferBytes, instances };
}

const result: Record<string, object> = {};
for (const signature of scene.architectural_signatures) {
  if (!/reichstag|brandenburger/.test(signature.id)) continue;
  const root = createArchitecturalSignature(signature as ArchitecturalSignature);
  if (root) result[signature.id] = measure(root);
}
const blocks = createMinecraftArchitecturalLandmarks();
for (const root of blocks.children) {
  if (/Reichstag|Brandenburg/.test(root.name)) result[root.name] = measure(root);
}
console.log(JSON.stringify(result, null, 2));
