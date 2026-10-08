import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2,
} from "three";
import source from "./data/volksbuehneV189.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const VOLKSBUEHNE_V189_GROUP = "Volksbuehne source facade and open steel Raeuberrad v189";
type Rows = number[][];
type XY = readonly number[];
const building = source.building;
const [tx, tz] = building.frontAxis;
const nx = -tz, nz = tx;
const yaw = -Math.atan2(tz, tx);
const STONE = 0xb8ad95, JOINT = 0xa69b85, GLASS = 0x4d625f, STEEL = 0x574036;

function point(u: number, y: number, v: number): number[] {
  return [building.frontOrigin[0] + tx * u + nx * v, y,
    building.frontOrigin[1] + tz * u + nz * v];
}

function frontV(u: number): number {
  const profile = building.frontProfile;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i];
    if (u <= b[0]) return a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]);
  }
  return profile.at(-1)![1];
}

/** Native facade members are independent orthogonal surface blocks. */
function put(rows: Rows, native: boolean, p: number[], w: number, h: number,
  d: number, angle: number, color: number): void {
  if (!native) { rows.push([...p, w, h, d, angle, color]); return; }
  const count = Math.max(1, Math.ceil(w / .85));
  for (let i = 0; i < count; i++) {
    const u = (i + .5) * w / count - w / 2;
    rows.push([p[0] + Math.cos(angle) * u, p[1], p[2] - Math.sin(angle) * u,
      Math.max(.14, Math.abs(Math.cos(angle)) * w / count + Math.abs(Math.sin(angle)) * d),
      h, Math.max(.14, Math.abs(Math.sin(angle)) * w / count + Math.abs(Math.cos(angle)) * d), color]);
  }
}

function facade(rows: Rows, native: boolean): void {
  const ring = building.rings[0];
  // Reversible thin source-aligned stone facing hides inappropriate generic
  // repeated residential windows. It does not remove any original source sheet.
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < .01) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const u = (mx - building.frontOrigin[0]) * tx + (mz - building.frontOrigin[1]) * tz;
    const v = (mx - building.frontOrigin[0]) * nx + (mz - building.frontOrigin[1]) * nz;
    // Exterior ring is counterclockwise in the established x/z frame.
    const ox = dz / length, oz = -dx / length, angle = -Math.atan2(dz, dx);
    const edge = (y: number, h: number, depth: number, color: number, out: number) =>
      put(rows, native, [mx + ox * out, y, mz + oz * out], length + .015, h, depth, angle, color);
    // Exact roof-edge course; preserve all old side windows and source roof.
    edge(building.topY - .18, .28, .22, 0xc9bea5, .16);
    if (Math.abs(u) > 21.5 || v < -3) continue;
    edge((building.groundY + building.topY) / 2, building.topY - building.groundY,
      .10, STONE, .52);
    edge(18.75, .42, .32, 0xc6bba1, .69);
    edge(19.12, .12, .43, 0xd2c6aa, .74);
    // Quiet limestone courses are fine lines, not displaced masonry blocks.
    if (!native) for (let y = 4.1; y < building.topY - .7; y += 1.32)
      edge(y, .022, .022, JOINT, .582);
  }
  const member = (u: number, y: number, v: number, w: number, h: number,
    d: number, color: number) => put(rows, native, point(u, y, v), w, h, d, yaw, color);
  // Five tall recessed foyer/door fields between the six documented columns.
  for (const u of [-7.2, -3.6, 0, 3.6, 7.2]) {
    const v = frontV(u) + .73;
    member(u, 11.25, v, 2.7, 13.6, .09, GLASS);
    member(u, 5.28, v + .06, 2.15, 3.3, .07, 0x363c36);
    for (const du of [-1.40, 1.40]) member(u + du, 11.25, v + .08, .16, 13.8, .14, 0xc5bba5);
    for (const du of [-.7, 0, .7]) member(u + du, 11.35, v + .13, .055, 13.35, .05, 0x343e37);
    for (const y of [7.05, 9.25, 11.45, 13.65, 15.85, 17.85]) member(u, y, v + .12, 2.7, .065, .05, 0x343e37);
    member(u, 18.2, v + .12, 3.0, .30, .34, 0xcfc3a8);
    for (const du of [-.82, .82]) member(u + du, 7.18, v + .18, .20, .30, .16, 0xe9dca0);
  }
  // Blank red banner fields are reversible theatre signage, no copied poster.
  for (const u of [-17.85, 17.85]) {
    member(u, 12.9, .64, 2.12, 12.3, .09, 0x973c30);
    for (const du of [-1.12, 1.12]) member(u + du, 12.9, .7, .055, 12.5, .07, 0xd3c8b2);
    for (const y of [6.65, 19.15]) member(u, y, .7, 2.27, .06, .07, 0xd3c8b2);
  }
  // Lettering is procedural strokes; no font or photograph is downloaded.
  for (const path of letteringStrokePaths("VOLKSBÜHNE", 1.10)) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .075));
    for (let k = 0; k < count; k++) {
      const t = (k + .5) / count, u = (a[0] + (b[0] - a[0]) * t) * 1.25;
      member(u, 21.15 + a[1] + (b[1] - a[1]) * t, frontV(u) + .90, .13, .14, .10, 0xe4ddc7);
    }
  }
  if (native) for (const u of [-9, -5.4, -1.8, 1.8, 5.4, 9]) {
    const v = frontV(u) + 1.03;
    member(u, 11.23, v, 1.03, 15.06, 1.03, 0xc9bea5);
    member(u, 3.35, v, 1.33, .70, 1.33, 0xd0c5ac);
    member(u, 18.92, v, 1.33, .32, 1.33, 0xd0c5ac);
  }
}

function columns(): InstancedMesh {
  const geometry = new CylinderGeometry(1, 1, 1, 16, 1);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xc9bea5 });
  const night = new MeshStandardMaterial({ color: 0xc9bea5, roughness: .92 });
  const mesh = new InstancedMesh(geometry, day, 18);
  const matrix = new Matrix4();
  let i = 0;
  for (const u of [-9, -5.4, -1.8, 1.8, 5.4, 9]) {
    const v = frontV(u) + 1.03;
    for (const [y, r, h] of [[11.23, .55, 15.06], [3.35, .70, .70], [18.92, .69, .32]]) {
      matrix.makeScale(r, h, r); matrix.setPosition(...point(u, y, v) as [number, number, number]);
      mesh.setMatrixAt(i++, matrix);
    }
  }
  mesh.name = "Six Muschelkalk columns with separate feet and capitals";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, columnCount: 6 };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

const LEG_PROFILES = [
  [[-.85, 1.5], [-.61, 1.40], [-.72, .34], [-.10, .29], [-.08, .08], [-.94, .08], [-1.00, .20]],
  [[.59, 1.44], [.86, 1.56], [1.02, .34], [1.58, .41], [1.64, .21], [.89, .06], [.79, .18]],
];
const RADIUS = 1.46, INNER = 1.225, CENTER_Y = 2.62;

function inside(p: XY, ring: readonly XY[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function spokes(): number[][][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = i * Math.PI / 3 + .08, ux = Math.cos(a), uy = Math.sin(a), half = .125;
    return [[-uy * half, CENTER_Y + ux * half], [ux * INNER - uy * half, CENTER_Y + uy * INNER + ux * half],
      [ux * INNER + uy * half, CENTER_Y + uy * INNER - ux * half], [uy * half, CENTER_Y - ux * half]];
  });
}

/** Raster membership is shared with the QA aperture contract, never a filled disk. */
export function volksbuehneWheelOccupied(u: number, y: number): boolean {
  const r = Math.hypot(u, y - CENTER_Y);
  return (r >= INNER && r <= RADIUS) || [...spokes(), ...LEG_PROFILES].some(p => inside([u, y], p));
}

function wheel(native: boolean): Mesh {
  const [x, z] = source.wheel.xz, ground = source.wheel.groundY;
  if (native) {
    const rows: Rows = [], step = .13;
    for (let u = -1.56; u < 1.69; u += step) for (let y = .065; y < 4.12; y += step) {
      if (volksbuehneWheelOccupied(u, y)) rows.push([x + tx * u, ground + y, z + tz * u, .16, step, .16, STEEL]);
    }
    const mesh = justicePalaceV183Boxes(rows, true);
    mesh.name = "Raeuberrad independent open six-spoke native steel profile";
    mesh.userData.openSectors = 6; mesh.userData.plinth = false;
    return mesh;
  }
  const positions: number[] = [], colors: number[] = [];
  const tint = new Color(STEEL), edgeTint = new Color(0x382d29);
  const vertex = (p: XY, depth: number, color: Color) => {
    positions.push(x + tx * p[0] + nx * depth, ground + p[1], z + tz * p[0] + nz * depth);
    colors.push(color.r, color.g, color.b);
  };
  const triangle = (a: XY, b: XY, c: XY, depth: number, color: Color) => {
    vertex(a, depth, color); vertex(b, depth, color); vertex(c, depth, color);
  };
  const prism = (ring: XY[]) => {
    for (const t of ShapeUtils.triangulateShape(ring.map(p => new Vector2(p[0], p[1])), [])) {
      triangle(ring[t[0]], ring[t[1]], ring[t[2]], .10, tint);
      triangle(ring[t[2]], ring[t[1]], ring[t[0]], -.10, tint);
    }
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      vertex(a, -.1, edgeTint); vertex(b, -.1, edgeTint); vertex(b, .1, edgeTint);
      vertex(a, -.1, edgeTint); vertex(b, .1, edgeTint); vertex(a, .1, edgeTint);
    }
  };
  // Rectangular flat steel ring section, open centre, six real spokes. A small
  // bounded irregularity suggests fabricated plate; it is not a torus tube.
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, b = (i + 1) * Math.PI / 24;
    const at = (r: number, angle: number): number[] => [Math.cos(angle) * r, CENTER_Y + Math.sin(angle) * r];
    prism([at(RADIUS, a), at(RADIUS, b), at(INNER, b), at(INNER, a)]);
  }
  for (const p of [...spokes(), ...LEG_PROFILES]) prism(p);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .94, metalness: .08 });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Raeuberrad open flat steel ring, six spokes, two legs and forward feet";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    openSectors: 6, materialEvidence: "OSM steel", plinth: false, sourceId: source.wheel.id };
  return mesh;
}

/** One bounded site; drawn geometry is identical on pointer and touch devices. */
export function createVolksbuehneV189(native = false): Group {
  const root = new Group(); root.name = VOLKSBUEHNE_V189_GROUP;
  root.userData = { additiveOnly: true, sourceGeometryRetained: true, textureFree: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    fullStaticDetailOnTouch: true, sourceSha256: source.sourceSha256,
    sourceParentIds: [building.id], artworkSourceIds: [source.wheel.id],
    sourceStatus: source.displayStatus, sourceConflict: source.sourceConflict };
  const rows: Rows = []; facade(rows, native);
  const skin = justicePalaceV183Boxes(rows, native);
  skin.name = "Volksbuehne source-aligned limestone facing, tall glazing and inscription";
  root.add(skin);
  if (!native) root.add(columns());
  root.add(wheel(native));
  return freezeStaticSceneTransforms(root);
}
