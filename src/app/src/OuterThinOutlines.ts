import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from "three";
import data from "./data/outerThinOutlines.json";
import { extrapolatedEnvelopeBounds, PRESENTATION_BACKDROP_BOUNDS, PRESENTATION_FLOOR_Y_M } from "./worldEnvelope";
import type { VisualMode } from "./visualMode";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { createOutlineLandmarksV182 } from "./OutlineLandmarksV182";
import outskirts from "./data/outskirtsScopeV187.json";
import northCity from "./data/northCityScopeV190.json";
import named from "./data/namedScopeV194.json";
import parks from "./data/namedScopeV198.json";
import { tegelSpandauV198GroundAt, tegelSpandauV198WaterAt } from "./tegelSpandauV198Navigation";
import { northParksV198GroundAt, northParksV198SolidAt, northParksV198WaterAt } from "./northParksV198Navigation";
import { eastParksV198GroundAt } from "./eastParksV198Ground";
import { eastParksV198SolidAt, eastParksV198WaterAt } from "./eastParksV198Navigation";
import { airportsV194SolidAt, airportsV194NativeSolidAt } from "./airportsV194Navigation";
import { westLakesV194WaterAt, westLakesV194SolidAt } from "./westLakesV194Navigation";
import { teufelsbergStationV195SolidAt } from "./teufelsbergStationV195Navigation";
import { drachenbergLawnGroundAtV195 } from "./DrachenbergLawnV195";
import { iccV199SolidAt } from "./iccV199Navigation";
import { cemeteryGrunewaldV199SolidAt } from "./cemeteryGrunewaldV199Navigation";

/** The requested cartographic supplement: hairlines only, no solid buildings. */
export function createOuterThinOutlines(
  mode: VisualMode,
  beforeLandmarkRelease?: (root: Group) => void,
): Group {
  const root = new Group();
  let activeMode = mode;
  root.name = "Connected outer Berlin hairline outlines v180";
  root.userData = { outlineOnly: true, textureFree: true, features: data.features };
  // Keep detailed navigation in this lazy supplement, out of the startup bundle.
  root.userData.solidAt = (x: number, y: number, z: number, radius = 0) =>
    (activeMode === "minecraft" ? airportsV194NativeSolidAt : airportsV194SolidAt)(x, y, z, radius) ||
    westLakesV194SolidAt(x, y, z, radius, activeMode === "minecraft") ||
    teufelsbergStationV195SolidAt(x, y, z, radius, activeMode === "minecraft") ||
    northParksV198SolidAt(x, y, z, radius, activeMode === "minecraft") ||
    iccV199SolidAt(x, y, z, radius) ||
    cemeteryGrunewaldV199SolidAt(x, y, z, radius, activeMode === "minecraft") ||
    eastParksV198SolidAt(x, y, z, radius, activeMode === "minecraft");
  root.userData.waterAt = (x: number, z: number) =>
    tegelSpandauV198WaterAt(x, z, activeMode === "minecraft") !== null ||
    northParksV198WaterAt(x, z, activeMode === "minecraft") !== null ||
    eastParksV198WaterAt(x, z, activeMode === "minecraft") !== null ||
    westLakesV194WaterAt(x, z, activeMode === "minecraft") !== null;
  root.userData.groundAt = (x: number, z: number) =>
    tegelSpandauV198GroundAt(x, z, activeMode === "minecraft") ??
    northParksV198GroundAt(x, z, activeMode === "minecraft") ??
    eastParksV198GroundAt(x, z) ??
    drachenbergLawnGroundAtV195(x, z, activeMode === "minecraft");
  const positions = new Float32Array(data.positions);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += terrainGroundAt(positions[i], positions[i + 2], 3, false) - 3;
  }
  const positionAttribute = new BufferAttribute(positions, 3);
  const streetIndices: number[] = [], railIndices: number[] = [];
  for (const feature of data.features) {
    // The full v199 measured ICC owns this exact older coarse wire envelope.
    // Its former 39.5m skyway lines would float above the corrected bridge.
    if (feature.name === "ICC") continue;
    const target = feature.kind === "rail" || feature.kind.startsWith("station-") ? railIndices : streetIndices;
    for (let v = feature.firstVertex; v < feature.firstVertex + feature.vertexCount; v++) target.push(v);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  geometry.setIndex(streetIndices);
  geometry.computeBoundingSphere();
  const ink = new LineBasicMaterial({ color: 0x64716b, linewidth: 1, transparent: true, opacity: 0.68, depthWrite: false, fog: false });
  const lines = new LineSegments(geometry, ink);
  lines.name = "Mapped motorway, Ringbahn and landmark hairlines";
  root.add(lines);

  // Extend only the recessed blank paper, never cover the existing city.
  const old = extrapolatedEnvelopeBounds();
  const backdrop = PRESENTATION_BACKDROP_BOUNDS;
  const west=Math.min(data.bounds[0],outskirts.bounds[0],northCity.bounds[0], named.bounds[0], parks.bounds[0]), north=Math.min(data.bounds[1],outskirts.bounds[1],northCity.bounds[1], named.bounds[1], parks.bounds[1]);
  const east=Math.max(data.bounds[2],outskirts.bounds[2],northCity.bounds[2], named.bounds[2], parks.bounds[2]), south=Math.max(data.bounds[3],outskirts.bounds[3],northCity.bounds[3], named.bounds[3], parks.bounds[3]);
  const minX = Math.min(west - 200, backdrop.minX), maxX = Math.max(east + 200, backdrop.maxX);
  const minZ = Math.min(north - 200, backdrop.minZ), maxZ = Math.max(south + 200, backdrop.maxZ);
  const paper: number[] = [];
  const rect = (x0: number, z0: number, x1: number, z1: number) => {
    if (x1 <= x0 || z1 <= z0) return;
    const y = PRESENTATION_FLOOR_Y_M;
    paper.push(x0,y,z0, x0,y,z1, x1,y,z1, x0,y,z0, x1,y,z1, x1,y,z0);
  };
  rect(minX,minZ,maxX,backdrop.minZ); rect(minX,backdrop.maxZ,maxX,maxZ);
  rect(minX,backdrop.minZ,backdrop.minX,backdrop.maxZ); rect(backdrop.maxX,backdrop.minZ,maxX,backdrop.maxZ);
  const drawnPaperVertices = paper.length / 3;
  // Minecraft lacks the drawn 16 km backdrop: its additional ring shares this
  // buffer and is enabled by drawRange, with no extra mesh or mode allocation.
  rect(backdrop.minX,backdrop.minZ,backdrop.maxX,old.minZ);
  rect(backdrop.minX,old.maxZ,backdrop.maxX,backdrop.maxZ);
  rect(backdrop.minX,old.minZ,old.minX,old.maxZ);
  rect(old.maxX,old.minZ,backdrop.maxX,old.maxZ);
  const paperGeometry = new BufferGeometry();
  paperGeometry.setAttribute("position", new Float32BufferAttribute(paper, 3));
  const paperMaterial = new MeshBasicMaterial({ color: 0xe9efe4 });
  root.add(new Mesh(paperGeometry, paperMaterial));
  // The ring is explicitly a cartographic outline. Keep its real coordinates
  // legible through station halls/road bridges, never move or remove those
  // retained buildings. Share the position buffer instead of duplicating it.
  const railGeometry = new BufferGeometry();
  railGeometry.setAttribute("position", positionAttribute);
  railGeometry.setIndex(railIndices);
  railGeometry.computeBoundingSphere();
  const railInk = new LineBasicMaterial({ color: 0x52695d, linewidth: 1, transparent: true, opacity: 0.42, depthTest: false, depthWrite: false, fog: false });
  const rail = new LineSegments(railGeometry, railInk);
  rail.name = "Schematic Ringbahn and station outlines";
  rail.userData.cartographicOverlay = true;
  rail.renderOrder = 100;
  root.add(rail);
  const landmarks = createOutlineLandmarksV182(mode, beforeLandmarkRelease);
  root.add(landmarks);
  root.userData.update = (timestamp: number, camera: import("three").Camera, reducedMotion = false) =>
    root.visible && landmarks.userData.update(timestamp, camera, reducedMotion);
  root.userData.setMode = (next: VisualMode) => {
    landmarks.userData.setMode(next);
    activeMode = next;
    paperGeometry.setDrawRange(0, next === "minecraft" ? paper.length / 3 : drawnPaperVertices);
    ink.color.setHex(next === "night" ? 0xa6bbce : next === "snowstorm" ? 0x647782 : 0x64716b);
    ink.opacity = next === "night" ? 0.82 : 0.68;
    railInk.color.setHex(next === "night" ? 0xa6bbce : 0x52695d);
    railInk.opacity = next === "night" ? 0.58 : 0.42;
    paperMaterial.color.setHex(next === "night" ? 0x17242d : next === "snowstorm" ? 0xe1e8e9 : next === "schwellenraum" ? 0xe7e0cc : 0xe9efe4);
  };
  root.userData.setMode(mode);
  root.traverse(object => { object.updateMatrix(); object.matrixAutoUpdate = false; });
  return root;
}
