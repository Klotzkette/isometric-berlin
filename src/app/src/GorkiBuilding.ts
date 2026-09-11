import {
  BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { appendVoxelEnvelope, sourceMesh, type SourceEnvelopeBlock } from "./BebelplatzBuildingShells";
import { GORKI_BUILDING_PROFILE as P, GORKI_BUILDING_SOURCE as source, gorkiDisplayParts } from "./gorkiBuildingProfile";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type Axis = readonly [readonly [number, number], readonly [number, number]];
type Instance = { p: Point; s: Point; color: number; yaw: number; rotation?: Quaternion };
const IVORY = 0xded7c6, LIGHT = 0xeee7d6, SHADE = 0xb5ac97;
const DOOR = 0x453329, RECESS = 0xc4bdac, GOLD = 0xa99757;
const TONE = { wall: IVORY, roof: 0x666661, name: "Maxim Gorki Theater" };
const UP = new Vector3(0, 1, 0);
function axisLength(axis: Axis): number { return Math.hypot(axis[1][0] - axis[0][0], axis[1][1] - axis[0][1]); }
function at(axis: Axis, u: number, y: number, out: number, side = -1): Point {
  const dx = axis[1][0] - axis[0][0], dz = axis[1][1] - axis[0][1], l = axisLength(axis);
  return [axis[0][0] + (dx * u + dz * out * side) / l, y, axis[0][1] + (dz * u - dx * out * side) / l];
}

/** Three real entrance bays, four fluted pilasters and the unglazed former hall. */
export function createGorkiBuilding(minecraft = false): Group {
  const root = new Group();
  root.name = minecraft ? "Block-native Maxim Gorki Theater" : "Maxim Gorki Theater source-bound architecture";
  root.userData = { textureFree: true, keepInMinecraft: minecraft, blockNative: minecraft,
    sourceParent: source.parent_id, entranceCount: P.entranceCount, largeHallWindows: P.largeHallWindows };
  const instances: Instance[] = [];
  const box = (axis: Axis, u: number, y: number, out: number, size: Point, color: number, side = -1) => {
    const p = at(axis, u, y, out, side), yaw = -Math.atan2(axis[1][1] - axis[0][1], axis[1][0] - axis[0][0]);
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    if (minecraft && size[0] > 2.5) {
      // Small axis-aligned courses follow the real bearing without giant AABBs.
      const n = Math.ceil(size[0] / 1.35);
      for (let i = 0; i < n; i++) instances.push({ p: at(axis, u - size[0] / 2 + (i + 0.5) * size[0] / n, y, out, side),
        s: [(size[0] / n + 0.04) * c + size[2] * s, Math.max(0.12, size[1]), Math.max(0.16, (size[0] / n + 0.04) * s + size[2] * c)], color, yaw: 0 });
    } else instances.push({ p, s: minecraft ? [Math.max(0.12, size[0] * c + size[2] * s), Math.max(0.12, size[1]), Math.max(0.12, size[0] * s + size[2] * c)] : size,
      color, yaw: minecraft ? 0 : yaw });
  };
  const front = P.frontAxis, w = axisLength(front), centre = w / 2;
  const displayParts = gorkiDisplayParts();
  if (minecraft) {
    const blocks: SourceEnvelopeBlock[] = [];
    displayParts.forEach((part) => appendVoxelEnvelope(part, TONE, blocks));
    for (const b of blocks) instances.push({ p: b.position, s: b.size, color: b.color, yaw: 0 });
  } else {
    const shell = sourceMesh(displayParts, TONE);
    shell.userData.sourceGeometryUnchanged = false;
    shell.userData.sourceFootprintsUnchanged = true;
    shell.userData.roofInterpretation = "Gabled hall and distinct northern stage tower; raw generalized source sheets retained";
    root.add(shell);
  }
  // Broad shallow approach and actual three portals, below the temple order.
  for (let i = 0; i < 5; i++) box(front, centre, 5.28 + i * 0.16, 1.72 - i * 0.25,
    [w + 0.8 - i * 0.18, 0.18, 2.9 - i * 0.34], SHADE);
  const bays = [w * 0.2, w * 0.5, w * 0.8];
  for (const u of bays) {
    box(front, u, 8.35, 0.12, [2.6, 4.8, 0.2], 0x302c27);
    box(front, u, 8.25, 0.27, [2.32, 4.6, 0.16], DOOR);
    for (const sign of [-1, 1]) {
      box(front, u + sign * 1.44, 8.75, 0.37, [0.32, 5.6, 0.46], LIGHT);
      box(front, u + sign * 0.64, 7.7, 0.38, [0.86, 1.55, 0.05], 0x584234);
      box(front, u + sign * 0.64, 9.5, 0.38, [0.86, 1.45, 0.05], 0x584234);
    }
    box(front, u, 11.7, 0.4, [3.4, 0.35, 0.58], IVORY);
    box(front, u, 12.08, 0.42, [3.72, 0.18, 0.74], LIGHT);
    box(front, u, 8.4, 0.4, [0.055, 4.4, 0.06], GOLD);
    // Solid framed rectangular tympanum above each door; not window glazing.
    box(front, u, 15.48, 0.07, [3.15, 2.18, 0.15], RECESS);
    for (const y of [14.25, 16.7]) box(front, u, y, 0.22, [3.6, 0.16, 0.3], LIGHT);
    for (const sign of [-1, 1]) box(front, u + sign * 1.72, 15.48, 0.22, [0.16, 2.4, 0.3], LIGHT);
  }
  for (let i = 0; i < 4; i++) {
    const u = 1 + (w - 2) * i / 3;
    box(front, u, 12.0, 0.52, [0.8, 11.4, 0.56], LIGHT);
    for (const y of [6.15, 6.5, 17.9, 18.35]) box(front, u, y, 0.55, [1.14, 0.25, 0.78], LIGHT);
    if (!minecraft) {
      for (let flute = -2; flute <= 2; flute++) box(front, u + flute * 0.13, 12.05, 0.83, [0.042, 10.5, 0.045], SHADE);
      for (const side of [-1, 1]) {
        box(front, u + side * 0.35, 17.45, 0.73, [0.3, 0.75, 0.35], IVORY);
        box(front, u + side * 0.41, 18.07, 0.74, [0.38, 0.23, 0.4], SHADE);
      }
    }
  }
  for (const y of [18.8, 19.04, 20.22]) box(front, centre, y, 0.45, [w + 0.8, 0.23, 0.78], LIGHT);
  box(front, centre, 19.55, 0.22, [w + 0.25, 0.95, 0.35], IVORY);
  // Source roof generalisation lacks this shallow triangular front. Fill it
  // using bounded courses, under the retained northern stage-tower maximum.
  const rows = minecraft ? 12 : 40;
  for (let i = 0; i < rows; i++) {
    const f = (i + 0.5) / rows, h = P.pedimentTopY - P.frontEavesY;
    box(front, centre, P.frontEavesY + h * f, 0.06, [Math.max(0.12, (w + 0.6) * (1 - f)), h / rows + 0.02, 0.22], IVORY);
  }
  for (let i = 0; i < (minecraft ? 24 : 64); i++) {
    const f = i / ((minecraft ? 24 : 64) - 1), u = -0.4 + (w + 0.8) * f;
    const y = P.frontEavesY + (P.pedimentTopY - P.frontEavesY) * (1 - Math.abs(2 * f - 1));
    box(front, u, y + 0.13, 0.34, [minecraft ? 0.86 : 0.36, 0.23, 0.66], LIGHT);
    if (!minecraft && i % 2 === 0) box(front, u, 20.03, 0.83, [0.15, 0.2, 0.28], SHADE);
  }
  // West-side high hall windows were closed during the post-war conversion.
  const west = P.westAxis, l = axisLength(west);
  for (let i = 0; i < 6; i++) {
    const u = (i + 0.5) * l / 6;
    box(west, u, 14.1, 0.1, [2.85, 6.7, 0.12], RECESS);
    for (const sign of [-1, 1]) box(west, u + sign * 1.54, 14.1, 0.23, [0.18, 7.0, 0.32], LIGHT);
    for (const y of [10.54, 17.65]) box(west, u, y, 0.28, [3.35, 0.2, 0.46], LIGHT);
    box(west, u, 8.1, 0.13, [2.9, 2.0, 0.16], RECESS);
  }
  for (const y of [6.2, 9.5, 18.9, 19.25]) box(west, l / 2, y, 0.22, [l, 0.16, 0.44], LIGHT);
  if (!minecraft) {
    // Code-built identity, no promotional poster artwork or font texture.
    for (const path of letteringStrokePaths("MAXIM GORKI THEATER", 0.59)) for (let i = 1; i < path.length; i++) {
      const a = at(front, centre + path[i - 1][0], 19.25 + path[i - 1][1], 0.47);
      const z = at(front, centre + path[i][0], 19.25 + path[i][1], 0.47);
      const direction = new Vector3(...z).sub(new Vector3(...a)), length = direction.length();
      if (length > 0.001) instances.push({ p: a.map((v, k) => (v + z[k]) / 2) as Point,
        s: [0.054, length, 0.045], color: GOLD, yaw: 0,
        rotation: new Quaternion().setFromUnitVectors(UP, direction.multiplyScalar(1 / length)) });
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, instances.length), matrix = new Matrix4(), paint = new Color(), q = new Quaternion();
  instances.forEach((b, i) => { matrix.compose(new Vector3(...b.p), b.rotation ?? q.setFromAxisAngle(UP, b.yaw), new Vector3(...b.s));
    mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, paint.setHex(b.color)); });
  mesh.name = "Gorki three portals, fluted pilasters, pediment and blind hall panels";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
