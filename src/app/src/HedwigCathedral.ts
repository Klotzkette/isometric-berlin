import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, Float32BufferAttribute,
  Group, InstancedMesh, LineSegments, Matrix4, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, Vector3,
} from "three";
import source from "./bebelplatzBuildingSource.json";
import { addBox, addCylinder, createBuilder, finishDrawnGroup, paintGeometry, type Builder } from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { markArchitecturalAccentInk } from "./architecturalInk";

const OFFICIAL = source.profiles.hedwig;
const PART = OFFICIAL.parts[0];
const CENTRE = [1580.023723, 382.710048] as const;
const REAR = [1594.434878, 405.819831] as const;
const YAW = Math.atan2(367.26 - 354.378, 1576.921 - 1556.041);
const STONE = 0xcfc0a5, PALE = 0xe0d3b9, JOINT = 0xa4957e;
const WINDOW = 0x526b70, SHADOW = 0x3d4544, GOLD = 0xc9b269;
const COPPER = [0x729c83, 0x7ba58a, 0x6a927e, 0x80aa8f, 0x759f89];
const MAIN_EAVES = 22.10, REAR_EAVES = 20.10;
const DOME_TOP = PART.top_y_m - 0.12;
const MAIN_RADIUS = 19.490272, REAR_RADIUS = 8.56;
export const HEDWIG_CATHEDRAL_GROUP_NAME = "St Hedwig Cathedral at Bebelplatz";
export const MINECRAFT_HEDWIG_CATHEDRAL_GROUP_NAME = "Minecraft St Hedwig Cathedral";

export const HEDWIG_CATHEDRAL_PROFILE = {
  name: "St. Hedwigs-Kathedrale Berlin",
  osmKey: "way/58608090",
  replacedOsmPrismIds: OFFICIAL.replaced_osm_prism_ids,
  lod2Parent: OFFICIAL.parent_id,
  sourceCreated: OFFICIAL.source_created,
  sourceUrl: OFFICIAL.source_url,
  sourceSha256: OFFICIAL.source_sha256,
  sourceGroundY: PART.ground_y_m,
  sourceTopY: PART.top_y_m,
  sourceHeightM: PART.height_m,
  mainCentreWorldM: CENTRE,
  rearCentreWorldM: REAR,
  mainRadiusM: MAIN_RADIUS,
  rearRadiusM: REAR_RADIUS,
  facadeRotationY: YAW,
  mainEavesY: MAIN_EAVES,
  rearEavesY: REAR_EAVES,
  mainDomeSegments: 84,
  sourceConflict: "The retained 18 m OSM fallback and generalized LoD2 pitched roof do not represent the two domes. The exact official ground outline and 35.620 m complete envelope remain evidence; curve, eaves, rear dome height and facade details are bounded procedural interpretation.",
  references: [
    {
      title: "St. Hedwig's Cathedral (Berlin), 2024 (01).jpg",
      artist: "Bahnfrend", license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      pageUrl: "https://commons.wikimedia.org/wiki/File:St._Hedwig%27s_Cathedral_(Berlin),_2024_(01).jpg",
      role: "current green copper, low dome cap, six-column front, five arched bays and pediment",
    },
    {
      title: "St. Hedwig's Cathedral (Berlin) - Exterior.jpg",
      artist: "Yair Haklai", license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      pageUrl: "https://commons.wikimedia.org/wiki/File:St._Hedwig%27s_Cathedral_(Berlin)_-_Exterior.jpg",
      role: "two circular bodies, rear cupola, ring cornices and arched windows; historical 2019 colour corroborated by official history",
    },
  ],
  officialHistoryUrl: "https://www.hedwigs-kathedrale.de/kathedrale/geschichte/",
  photographsBundled: false,
  textureFree: true,
  geometryStatus: "Circle centre/radius fitted to exact LoD2 ground points; local subdivisions, portico relief cues, panel seams and shades are display reconstruction, not surveyed detail. The 84 roof strips echo the published concrete segment count without claiming surveyed copper seam positions.",
} as const;

type Point = [number, number, number];
function local(x: number, y: number, z: number): Point {
  return [CENTRE[0] + x * Math.cos(YAW) + z * Math.sin(YAW), y,
    CENTRE[1] - x * Math.sin(YAW) + z * Math.cos(YAW)];
}

/** Walking support follows the curved display, not the generalized source tent roof. */
export function hedwigRoofTopAt(x: number, z: number): number | null {
  let result: number | null = null;
  for (const [centre, radius, eaves, top] of [
    [CENTRE, MAIN_RADIUS, MAIN_EAVES, DOME_TOP],
    [REAR, REAR_RADIUS, REAR_EAVES, 27.75],
  ] as const) {
    const distance = Math.hypot(x - centre[0], z - centre[1]);
    if (distance > radius) continue;
    const height = distance <= radius * Math.sin(0.12) ? top + 0.12
      : eaves + (top - eaves) / Math.cos(0.12) * Math.sqrt(1 - (distance / radius) ** 2);
    result = Math.max(result ?? -Infinity, height);
  }
  const dx = x - CENTRE[0], dz = z - CENTRE[1];
  const lx = dx * Math.cos(YAW) - dz * Math.sin(YAW);
  const lz = dx * Math.sin(YAW) + dz * Math.cos(YAW);
  if (Math.abs(lx) <= 12.75 && lz >= -26.36 && lz <= -16) {
    result = Math.max(result ?? -Infinity, 29.2 - Math.abs(lx) * 5.97 / 12.75);
  }
  return result;
}
function box(b: Builder, c: number, x: number, y: number, z: number, w: number, h: number, d: number): void {
  addBox(b, c, ...local(x, y, z), w, h, d, YAW, false);
}
function polygon(b: Builder, points: number[][], c: number): void {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  const indices: number[] = [];
  for (let i = 1; i + 1 < points.length; i += 1) indices.push(0, i, i + 1);
  g.setIndex(indices);
  paintGeometry(g, c);
  b.parts.push(g);
}
function line(b: Builder, points: number[][]): void {
  const g = new BufferGeometry();
  const segments: number[] = [];
  for (let i = 1; i < points.length; i += 1) segments.push(...points[i - 1], ...points[i]);
  g.setAttribute("position", new Float32BufferAttribute(segments, 3));
  b.edges.push(g);
}
function drum(b: Builder, centre: readonly [number, number], radius: number, bottom: number, top: number, n: number): void {
  for (let i = 0; i < n; i += 1) {
    const a = i * Math.PI * 2 / n, c = (i + 1) * Math.PI * 2 / n;
    const tone = new Color(STONE).multiplyScalar(0.94 + 0.06 * Math.cos((a + c) / 2 - 0.7));
    polygon(b, [
      [centre[0] + Math.cos(a) * radius, bottom, centre[1] + Math.sin(a) * radius],
      [centre[0] + Math.cos(a) * radius, top, centre[1] + Math.sin(a) * radius],
      [centre[0] + Math.cos(c) * radius, top, centre[1] + Math.sin(c) * radius],
      [centre[0] + Math.cos(c) * radius, bottom, centre[1] + Math.sin(c) * radius],
    ], tone.getHex());
  }
}
function dome(b: Builder, centre: readonly [number, number], radius: number, eaves: number, top: number, n: number): void {
  const min = 0.12, rise = (top - eaves) / Math.cos(min), rings = 14;
  const vertex = (t: number, p: number): number[] => [centre[0] + radius * Math.sin(t) * Math.cos(p),
    eaves + rise * Math.cos(t), centre[1] + radius * Math.sin(t) * Math.sin(p)];
  for (let s = 0; s < n; s += 1) {
    const p = s * Math.PI * 2 / n, q = (s + 1) * Math.PI * 2 / n;
    const seam: number[][] = [];
    for (let r = 0; r < rings; r += 1) {
      const a = min + (Math.PI / 2 - min) * r / rings;
      const c = min + (Math.PI / 2 - min) * (r + 1) / rings;
      polygon(b, [vertex(a, p), vertex(a, q), vertex(c, q), vertex(c, p)], COPPER[(s + Math.floor(r / 3)) % COPPER.length]);
      seam.push(vertex(a, p));
      if (r === rings - 1) seam.push(vertex(c, p));
      if (r % 5 === 3 && s % 3 === 0) line(b, [vertex(c, p), vertex(c, q)]);
    }
    if (s % 3 === 0) line(b, seam);
  }
  addCylinder(b, COPPER[1], centre[0], top + 0.06, centre[1], radius * Math.sin(min), 0.12, n);
  addCylinder(b, 0x577766, centre[0], eaves, centre[1], radius + 0.06, 0.15, n);
}
function frontArch(b: Builder, x: number, sill: number, z: number, width: number, height: number, color: number): void {
  const r = width / 2;
  box(b, color, x, sill + (height - r) / 2, z, width, height - r, 0.1);
  const g = new CircleGeometry(r, 16, 0, Math.PI);
  g.rotateY(YAW + Math.PI);
  g.translate(...local(x, sill + height - r, z));
  paintGeometry(g, color); b.parts.push(g);
  const arch: number[][] = [];
  for (let i = 0; i <= 16; i += 1) {
    const a = i * Math.PI / 16;
    arch.push(local(x + Math.cos(a) * (r + 0.13), sill + height - r + Math.sin(a) * (r + 0.13), z - 0.07));
  }
  line(b, arch);
}
function createStone(ground: VoxelPayload): Group {
  const b = createBuilder();
  for (const [centre, radius, eaves, segments, windows] of [
    [CENTRE, MAIN_RADIUS, MAIN_EAVES, 84, 12], [REAR, REAR_RADIUS, REAR_EAVES, 48, 7],
  ] as const) {
    drum(b, centre, radius - 0.04, PART.ground_y_m, eaves, segments);
    for (const [y, extra, c] of [
      [PART.ground_y_m + 0.45, 0.18, JOINT], [eaves - 3.25, 0.32, PALE],
      [eaves - 2.9, 0.46, STONE], [eaves - 2.48, 0.34, PALE], [eaves - 0.18, 0.30, PALE],
    ]) addCylinder(b, c, centre[0], y, centre[1], radius + extra, 0.22, segments);
    for (let i = 0; i < windows; i += 1) {
      const a = i * Math.PI * 2 / windows + 0.15;
      const x = centre[0] + Math.cos(a) * (radius + 0.035);
      const z = centre[1] + Math.sin(a) * (radius + 0.035);
      // The local +Z normal points radially outwards.
      const yaw = Math.PI / 2 - a;
      addBox(b, WINDOW, x, 11.4, z, 2.1, 8.1, 0.09, yaw, false);
      const arch = new CircleGeometry(1.05, 14, 0, Math.PI);
      arch.rotateY(yaw); arch.translate(x, 15.45, z);
      paintGeometry(arch, WINDOW); b.parts.push(arch);
      for (let j = 0; j < 6; j += 1) addBox(b, PALE, x, 7.7 + j * 1.45, z, 2.05, 0.08, 0.14, yaw, false);
      addBox(b, PALE, x, 11.6, z, 0.08, 8.35, 0.16, yaw, false);
      const oculus = new CircleGeometry(0.44, 12);
      oculus.rotateY(yaw); oculus.translate(x, eaves - 1.32, z);
      paintGeometry(oculus, SHADOW); b.parts.push(oculus);
    }
  }
  const foot = local(0, 0, -26.6);
  const floor = Math.max(PART.ground_y_m, worldGroundSampler(ground)(foot[0], foot[2]) ?? 5.2);
  box(b, STONE, 0, (PART.ground_y_m + 21.4) / 2, -20.15, 24.4, 21.4 - PART.ground_y_m, 10.1);
  for (let i = 0; i < 3; i += 1) box(b, PALE, 0, floor + i * 0.16, -26.25 + i * 0.22, 24.5, 0.16, 1.3 - i * 0.25);
  const front = -25.24;
  for (let i = 0; i < 5; i += 1) {
    const x = (i - 2) * 4.08;
    frontArch(b, x, floor + 0.4, front - 0.035, 2.8, 7.6, i % 2 === 0 ? SHADOW : PALE);
    box(b, JOINT, x, 16.6, front - 0.04, 2.9, 4.5, 0.11);
    box(b, PALE, x, 16.6, front - 0.12, 2.6, 4.15, 0.12);
    // Small original, non-figurative relief facets, never a photographic texture.
    for (let j = 0; j < 3; j += 1) box(b, STONE, x + (j - 1) * 0.7, 16.3 + j % 2 * 0.6, front - 0.22, 0.44, 2.1, 0.15);
  }
  for (let i = 0; i < 6; i += 1) {
    const x = (i - 2.5) * 4.08, p = local(x, (floor + 20.5) / 2, -25.62);
    addCylinder(b, PALE, ...p, 0.67, 20.5 - floor, 14);
    for (const y of [floor + 0.25, 20.65]) {
      box(b, PALE, x, y, -25.62, 1.75, 0.45, 1.5);
      addCylinder(b, STONE, p[0], y + 0.3, p[2], 0.85, 0.26, 14);
    }
  }
  box(b, STONE, 0, 21.35, -21.0, 24.8, 0.8, 10.15);
  box(b, PALE, 0, 22.2, -21.0, 25.15, 0.9, 10.5);
  box(b, STONE, 0, 23.0, -21.0, 25.5, 0.45, 10.7);
  polygon(b, [local(-12.75, 23.23, -26.36), local(0, 29.2, -26.36), local(12.75, 23.23, -26.36)], PALE);
  polygon(b, [local(-12.75, 23.23, -26.36), local(-12.75, 23.23, -16.0), local(0, 29.2, -16.0), local(0, 29.2, -26.36)], JOINT);
  polygon(b, [local(0, 29.2, -26.36), local(0, 29.2, -16.0), local(12.75, 23.23, -16.0), local(12.75, 23.23, -26.36)], STONE);
  line(b, [local(-12.75, 23.23, -26.41), local(0, 29.2, -26.41), local(12.75, 23.23, -26.41)]);
  for (let i = -4; i <= 4; i += 1) {
    const h = 3.15 - Math.abs(i) * 0.5;
    box(b, STONE, i * 2, 23.5 + h / 2, -26.46, 0.95, h, 0.10);
  }
  box(b, GOLD, 0, 30.25, -26.25, 0.19, 2.1, 0.18);
  box(b, GOLD, 0, 30.62, -26.25, 1.3, 0.18, 0.18);
  return finishDrawnGroup(b, { name: "St Hedwig source-bound stone and portico" })!;
}

export function createHedwigCathedral(ground: VoxelPayload): Group {
  const group = new Group();
  group.name = HEDWIG_CATHEDRAL_GROUP_NAME;
  const roof = createBuilder();
  dome(roof, CENTRE, MAIN_RADIUS, MAIN_EAVES, DOME_TOP, 84);
  dome(roof, REAR, REAR_RADIUS, REAR_EAVES, 27.75, 48);
  const domes = finishDrawnGroup(roof, { name: "St Hedwig green copper domes" })!;
  domes.traverse((object) => {
    if (object instanceof LineSegments) markArchitecturalAccentInk(object.material, 0x688472, "micro");
  });
  group.add(createStone(ground), domes);
  group.userData = { source: HEDWIG_CATHEDRAL_PROFILE, sourceBoundReplacement: true, textureFree: true, photographsBundled: false, domeCount: 2 };
  return freezeStaticSceneTransforms(group);
}

export function createMinecraftHedwigCathedral(ground: VoxelPayload): Group {
  const root = new Group();
  root.name = MINECRAFT_HEDWIG_CATHEDRAL_GROUP_NAME;
  const instances: { point: number[]; size: number[]; color: number }[] = [];
  const push = (point: number[], size: number[], color: number): void => { instances.push({ point, size, color }); };
  // Only surface blocks are emitted; the cathedral contains no hidden solid fill.
  const cell = 2;
  for (const [centre, radius, eaves, top] of [
    [CENTRE, MAIN_RADIUS, MAIN_EAVES, DOME_TOP], [REAR, REAR_RADIUS, REAR_EAVES, 27.75],
  ] as const) {
    for (let y = PART.ground_y_m + 1; y < top; y += cell) {
      const r = y <= eaves ? radius : radius * Math.sqrt(Math.max(0, 1 - ((y - eaves) / (top - eaves)) ** 2));
      for (let x = -Math.ceil(radius); x <= radius; x += cell) {
        for (let z = -Math.ceil(radius); z <= radius; z += cell) {
          const distance = Math.hypot(x, z);
          if (distance > r || distance < r - 2.25) continue;
          push([centre[0] + x, y, centre[1] + z], [cell, Math.min(cell, 2 * (top - y)), cell], y < eaves ? STONE : COPPER[Math.abs(Math.round(x + z)) % COPPER.length]);
        }
      }
    }
    push([centre[0], top - 0.35, centre[1]], [3.5, 0.7, 3.5], COPPER[1]);
  }
  const front = local(0, 0, -25.6);
  const floor = Math.max(PART.ground_y_m, worldGroundSampler(ground)(front[0], front[2]) ?? 5.2);
  for (let i = 0; i < 6; i += 1) push(local((i - 2.5) * 4.08, (floor + 20.7) / 2, -25.6), [1.6, 20.7 - floor, 1.6], PALE);
  for (let x = -12; x <= 12; x += 2) {
    push(local(x, 22.0, -25.6), [2.2, 2.3, 2.2], PALE);
    const h = 5.7 * (1 - Math.abs(x) / 13);
    push(local(x, 23.15 + h / 2, -25.6), [2.1, h, 2.1], STONE);
  }
  push(local(0, 30.25, -25.6), [0.55, 2.1, 0.55], GOLD);
  push(local(0, 30.62, -25.6), [1.7, 0.55, 0.55], GOLD);
  const g = new BoxGeometry(1, 1, 1);
  g.deleteAttribute("uv"); g.deleteAttribute("normal");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 });
  const mesh = new InstancedMesh(g, day, instances.length);
  mesh.name = `${MINECRAFT_HEDWIG_CATHEDRAL_GROUP_NAME} blocks`;
  const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), size = new Vector3();
  for (let i = 0; i < instances.length; i += 1) {
    const item = instances[i];
    m.compose(p.fromArray(item.point), q, size.fromArray(item.size));
    mesh.setMatrixAt(i, m); mesh.setColorAt(i, new Color(item.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  root.add(mesh);
  root.userData = { source: HEDWIG_CATHEDRAL_PROFILE, keepInMinecraft: true, surfaceOnly: true, textureFree: true, domeCount: 2 };
  return freezeStaticSceneTransforms(root);
}
