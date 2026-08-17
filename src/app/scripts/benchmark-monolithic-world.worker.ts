import { Group, LineSegments, Mesh } from "three";

import {
  createIsometricCity,
  setIsoNightPresentation,
  type PrismPayload,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";

const meshRoot = `${import.meta.dir}/../public/mesh/regierungsviertel`;
const [prismPayload, ground, surfaces] = await Promise.all([
  Bun.file(`${meshRoot}/lod2-prisms.json`).json() as Promise<PrismPayload>,
  Bun.file(`${meshRoot}/ground-context.json`).json() as Promise<VoxelPayload>,
  Bun.file(`${meshRoot}/surface-polygons.json`).json() as Promise<SurfacePayload>,
]);
const startedAt = performance.now();
const root = new Group();
root.add(createIsometricCity(prismPayload, ground, null, surfaces));
setIsoNightPresentation(root, false, true, "day");
const buildMs = performance.now() - startedAt;

let drawCalls = 0;
let geometryBytes = 0;
let object3DCount = 0;
let renderableCount = 0;
let vertices = 0;
const geometries = new Set<object>();
root.traverse((object) => {
  object3DCount += 1;
  if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
  renderableCount += 1;
  const geometry = object.geometry;
  drawCalls += Array.isArray(object.material)
    ? Math.max(1, geometry.groups.length)
    : 1;
  if (geometries.has(geometry)) return;
  geometries.add(geometry);
  vertices += geometry.getAttribute("position")?.count ?? 0;
  for (const attribute of Object.values(geometry.attributes)) {
    geometryBytes += attribute.array.byteLength;
  }
  if (geometry.index) geometryBytes += geometry.index.array.byteLength;
});

function geometryHash(name: string): string | null {
  const object = root.getObjectByName(name);
  if (!(object instanceof Mesh)) return null;
  const hasher = new Bun.CryptoHasher("sha256");
  for (const attributeName of Object.keys(object.geometry.attributes).sort()) {
    hasher.update(attributeName);
    hasher.update(object.geometry.getAttribute(attributeName).array);
  }
  if (object.geometry.index) hasher.update(object.geometry.index.array);
  return hasher.digest("hex");
}

self.postMessage({
  build_ms: Number(buildMs.toFixed(1)),
  steady_state: {
    asphalt_sha256: geometryHash("smooth carriageways"),
    draw_calls: drawCalls,
    geometry_mib: Number((geometryBytes / 1024 / 1024).toFixed(1)),
    object3d: object3DCount,
    renderables: renderableCount,
    vertices,
  },
});
