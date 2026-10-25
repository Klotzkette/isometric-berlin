import {
  Box3, BoxGeometry, Color, DynamicDrawUsage, Frustum, Group, InstancedBufferAttribute,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  Sphere, Vector3, type Camera,
} from "three";
import source from "./data/alexanderNorthV272.json";
import { letteringStrokePaths } from "./drawnLettering";

type Point = [number, number, number];
type Instance = { matrix: Matrix4; color: number };
export const ALEXANDER_NORTH_V272 = source;
export const PRESSEHAUS_CROWN_V272 = "Pressehaus: rotating BERLINER VERLAG crown v272";

function cube(rows: Instance[], at: Point, size: Point, color: number, yaw = 0): void {
  const matrix = new Matrix4().makeRotationY(yaw);
  matrix.scale(new Vector3(...size)).setPosition(...at);
  rows.push({ matrix, color });
}

/** Native strokes are independently sampled axis-aligned boxes. */
function rod(rows: Instance[], native: boolean, a: Point, b: Point, width: number, color: number): void {
  const start = new Vector3(...a), end = new Vector3(...b), axis = end.clone().sub(start);
  const length = axis.length();
  if (native) {
    const n = Math.max(1, Math.ceil(length / Math.max(width, .19)));
    for (let i = 0; i < n; i++) {
      const p = start.clone().lerp(end, (i + .5) / n).toArray() as Point;
      cube(rows, p, [Math.max(width, Math.abs(axis.x) / n), Math.max(width, Math.abs(axis.y) / n),
        Math.max(width, Math.abs(axis.z) / n)], color);
    }
  } else {
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize());
    rows.push({ color, matrix: new Matrix4().compose(start.add(end).multiplyScalar(.5), q,
      new Vector3(width, length, width)) });
  }
}

function label(rows: Instance[], native: boolean, text: string, at: Point, tangent: Point,
  height: number, color: number, width: number): void {
  const paths = letteringStrokePaths(text, height), extent = Math.max(...paths.flat().map(p => p[0]));
  const point = (p: number[]): Point => [at[0] + tangent[0] * (p[0] - extent / 2),
    at[1] + p[1], at[2] + tangent[2] * (p[0] - extent / 2)];
  for (const path of paths) for (let j = 1; j < path.length; j++)
    rod(rows, native, point(path[j - 1]), point(path[j]), width, color);
}

/** Fits all additions to immutable wall receipts, sharing the old static batch. */
export function alexanderNorthRecognitionV272(native: boolean): Instance[] {
  const rows: Instance[] = [];
  for (const [faceId, u, y, w, h, out, depth, color] of source.panels) {
    const f = source.faces[faceId], length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const dx = (f.b[0] - f.a[0]) / length, dz = (f.b[1] - f.a[1]) / length;
    if (!native) {
      cube(rows, [f.a[0] + dx * u + f.normal[0] * out, y, f.a[1] + dz * u + f.normal[1] * out],
        [w, h, depth], color, -Math.atan2(dz, dx));
    } else {
      const n = Math.max(1, Math.ceil(w / 1.5));
      for (let j = 0; j < n; j++) {
        const along = u - w / 2 + (j + .5) * w / n, reach = out + 1.38;
        cube(rows, [f.a[0] + dx * along + f.normal[0] * reach, y,
          f.a[1] + dz * along + f.normal[1] * reach],
        [Math.max(.11, Math.abs(dx) * w / n + Math.abs(f.normal[0]) * depth), h,
          Math.max(.11, Math.abs(dz) * w / n + Math.abs(f.normal[1]) * depth)], color);
      }
    }
  }
  // Separate fixed newspaper identity: owner-requested historical reinstatement,
  // distinct from the source-supported BERLINER VERLAG rotating crown.
  const f = source.faces.find(f => f.part === "DEBE3DwHEnY2xVWt" && f.surface === 3)!;
  const l = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const dx = (f.b[0] - f.a[0]) / l, dz = (f.b[1] - f.a[1]) / l;
  const tangent: Point = dx < 0 ? [-dx, 0, -dz] : [dx, 0, dz];
  const center: Point = [(f.a[0] + f.b[0]) / 2, 68.2, (f.a[1] + f.b[1]) / 2];
  label(rows, native, source.historicalRoofText, center, tangent, 2.0, 0xDBE3E8, .23);
  for (const d of [-14, -7, 0, 7, 14]) {
    const a: Point = [center[0] + tangent[0] * d, 67.3, center[2] + tangent[2] * d];
    rod(rows, native, a, [a[0], 70.4, a[2]], .13, 0x646E72);
  }
  const cafe = source.faces.find(f => f.part === "DEBE3DJG5XjFMrAD" && f.surface === 8)!;
  const cl = Math.hypot(cafe.b[0] - cafe.a[0], cafe.b[1] - cafe.a[1]);
  label(rows, native, "PRESSECAFE", [(cafe.a[0] + cafe.b[0]) / 2 + cafe.normal[0] * (native ? 2.25 : .88),
    6.75, (cafe.a[1] + cafe.b[1]) / 2 + cafe.normal[1] * (native ? 2.25 : .88)],
  [(cafe.a[0] - cafe.b[0]) / cl, 0, (cafe.a[1] - cafe.b[1]) / cl], .62, 0x596264, .075);
  return rows;
}

export type PressehausUpdateV272 = (timestamp: number, camera: Camera,
  reducedMotion?: boolean, pageHidden?: boolean) => boolean;

/** One small reusable batch; the caller supplies the already-existing frame loop. */
export function createPressehausCrownV272(native: boolean): Group {
  const root = new Group(), rows: Instance[] = [], { radius, height, centre, text } = source.crown;
  root.name = PRESSEHAUS_CROWN_V272;
  const dark = 0x6D7677, white = 0xEEEDE0;
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, b = (i + 1) * Math.PI / 24;
    for (const y of [0, height]) rod(rows, native,
      [Math.sin(a) * radius, y, Math.cos(a) * radius], [Math.sin(b) * radius, y, Math.cos(b) * radius], .10, dark);
    if (i % 4 === 0) rod(rows, native, [0, .1, 0], [Math.sin(a) * radius, .1, Math.cos(a) * radius], .10, dark);
  }
  const paths = letteringStrokePaths(text, height * .86);
  const span = Math.max(...paths.flat().map(p => p[0]));
  // A full ring of correctly ordered letters, leaving one modest word seam.
  const curve = (p: number[]): Point => {
    const a = (p[0] / span - .5) * Math.PI * 1.84;
    return [Math.sin(a) * (radius + .06), .16 + p[1], Math.cos(a) * (radius + .06)];
  };
  for (const path of paths) for (let j = 1; j < path.length; j++) {
    const a = path[j - 1], b = path[j], n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / .25));
    for (let k = 0; k < n; k++) {
      const p = (t: number) => curve([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      rod(rows, native, p(k / n), p((k + 1) / n), .16, white);
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .78,
    emissive: 0x576675, emissiveIntensity: .3 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colours = new Float32Array(rows.length * 3), c = new Color();
  for (let i = 0; i < rows.length; i++) {
    rows[i].matrix.toArray(matrices, i * 16); c.setHex(rows[i].color).toArray(colours, i * 3);
  }
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colours, 3);
  mesh.position.set(...centre as Point);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, keepInMinecraft: native, noShadowAtlasRebuild: true };
  // The fixed sphere covers every orientation; no per-frame bounds allocation.
  mesh.boundingSphere = new Sphere(new Vector3(0, height / 2, 0), radius + height);
  mesh.boundingBox = mesh.boundingSphere.getBoundingBox(new Box3());
  root.add(mesh); mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  const retained = native ? new Float32Array(matrices) : null;
  if (native) mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  const projection = new Matrix4(), frustum = new Frustum(), worldSphere = new Sphere();
  const localSphere = new Sphere(new Vector3(...centre as Point), radius + height + 1);
  let elapsed = 0, lastTime: number | undefined, lastPaint = -Infinity, disposed = false;
  const update: PressehausUpdateV272 = (timestamp, camera, reducedMotion = false, pageHidden = false) => {
    let visible = !pageHidden && !reducedMotion && !disposed && Number.isFinite(timestamp);
    for (let p: Group | import("three").Object3D | null = root; visible && p; p = p.parent) visible = p.visible;
    if (!visible) { lastTime = undefined; return false; }
    worldSphere.copy(localSphere).applyMatrix4(root.matrixWorld);
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!frustum.setFromProjectionMatrix(projection).intersectsSphere(worldSphere)) { lastTime = undefined; return false; }
    if (lastTime !== undefined) elapsed = (elapsed + Math.min(.1, Math.max(0, (timestamp - lastTime) / 1000))) % source.crown.periodSeconds;
    lastTime = timestamp;
    if (timestamp - lastPaint < 100) return false;
    lastPaint = timestamp;
    const angle = elapsed / source.crown.periodSeconds * Math.PI * 2;
    if (retained) {
      const sin = Math.sin(angle), cos = Math.cos(angle);
      for (let i = 0; i < mesh.count; i++) {
        const at = i * 16, x = retained[at + 12], z = retained[at + 14];
        matrices[at + 12] = x * cos + z * sin;
        matrices[at + 14] = z * cos - x * sin;
      }
      mesh.instanceMatrix.needsUpdate = true;
    } else {
      mesh.rotation.y = angle; mesh.updateMatrix();
    }
    root.userData.elapsedSeconds = elapsed;
    return true;
  };
  // Geometry disposal also evicts reusable offscreen GPU copies. Only the
  // viewer's final root teardown may permanently stop this shared-loop hook.
  const dispose = () => { disposed = true; lastTime = undefined; };
  root.userData = { updatePressehausV272: update, disposePressehausV272: dispose,
    textureFree: true, fullStaticDetailOnTouch: true,
    blockNative: native, keepInMinecraft: native, historicalNewspaperLettersSeparate: true,
    instances: rows.length, frameIntervalMs: 100, periodSeconds: source.crown.periodSeconds,
    animationClaim: "Operator describes a rotating BERLINER VERLAG crown; rotation speed is illustrative.",
    elapsedSeconds: 0 };
  return root;
}
