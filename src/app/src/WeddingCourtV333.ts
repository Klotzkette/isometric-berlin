import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, Vector2,
} from "three";
import drawnEnvelopes from "./data/districtCourtsV229Envelopes.json";
import nativeEnvelopes from "./data/districtCourtsV229Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = readonly [u: number, y: number];
type Cue = { ring: readonly Point[]; depth: number; color: number };
type Label = { text: string; center: number[]; direction: number[]; normal: number[]; height: number; color: number };
type Recognition = {
  key: string; owner: string; boxes: number[][]; rods: number[][]; nativeRows: number[][]; labels: Label[];
};
type Range = readonly [first: number, last: number];

const OWNER = "DEBE01YYK00041Iw";
const CENTER_X = 254.6545;
const CENTER_Z = -3439.5005;
const DX = 0.6998499207070085;
const DZ = 0.7142899190709567;
const BASE_Y = 5.2;
const DRAWN_BOXES: readonly Range[] = [[1136, 1147], [1164, 1175], [1192, 1203], [1220, 1231], [1960, 1960], [2056, 2061]];
const DRAWN_RODS: readonly Range[] = [[144, 149], [178, 187]];
const NATIVE_ROWS: readonly Range[] = [[2564, 2608], [2653, 2673], [2702, 2722], [2751, 2771], [4527, 4536], [4820, 4871]];
const V293_PANES = [284, 285, 286, 291, 292, 293, 298, 299, 300, 305, 306, 307];

function control(value: unknown): number {
  const json = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i++) hash = Math.imul(hash ^ json.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function outside(rows: number[][], ranges: readonly Range[]): number[][] {
  return rows.filter((_, i) => ranges.every(([first, last]) => i < first || i > last));
}

/** The V293 layer generates both modes from the same pane and plaque records. */
export function weddingCourtV333PreviousPanes(site: {
  key: string; sourceOwner: string; panes: number[][]; label: Label;
}): ReadonlySet<number> | null {
  if (site.key !== "wedding" || site.sourceOwner !== OWNER ||
    control([site.key, site.sourceOwner, site.panes, site.label]) !== 4055527600) return null;
  return new Set(V293_PANES);
}

function keepDrawnPlinthEnds(row: number[]): number[][] {
  const [x, y, z, width, height, depth, yaw, color] = row;
  const halfOpening = 3.58;
  const flankWidth = width / 2 - halfOpening;
  const center = halfOpening + flankWidth / 2;
  return [-center, center].map(u => [
    x + Math.cos(yaw) * u, y, z - Math.sin(yaw) * u, flankWidth, height, depth, yaw, color,
  ]);
}

function facadeCues(): Cue[] {
  const cues: Cue[] = [];
  const glass = 0x394a51, door = 0x293e3b, reveal = 0x74695e;
  const stone = 0xa99d89, edge = 0xc0b5a1, shade = 0x575047;
  const panel = (ring: readonly Point[], depth: number, color: number) => cues.push({ ring, depth, color });
  const rect = (left: number, bottom: number, right: number, top: number, depth: number, color: number) =>
    panel([[left, bottom], [right, bottom], [right, top], [left, top]], depth, color);
  const trace = (path: readonly Point[], width: number, depth: number, color: number) => {
    for (let i = 1; i < path.length; i++) {
      const [x, y] = path[i - 1], [u, v] = path[i];
      const l = Math.hypot(u - x, v - y);
      const a = -(v - y) * width / (2 * l), b = (u - x) * width / (2 * l);
      panel([[x + a, y + b], [x - a, y - b], [u - a, v - b], [u + a, v + b]], depth, color);
    }
  };
  const arch = (cx: number, spring: number, width: number, rise: number): Point[] => [
    [-1, 0], [-.94, .29], [-.83, .57], [-.60, .72], [-.31, .82], [0, 1],
    [.31, .82], [.60, .72], [.83, .57], [.94, .29], [1, 0],
  ].map(([u, y]) => [cx + u * width / 2, spring + y * rise]);
  const fill = (head: readonly Point[], bottom: number, depth: number, color: number) =>
    panel([[head[0][0], bottom], [head[head.length - 1][0], bottom], ...[...head].reverse()], depth, color);

  const greatHead = arch(0, 19.1, 9.10, 3.28);
  const glazedHead = arch(0, 18.85, 7.38, 2.86);
  fill(greatHead, 5.3, .12, reveal);
  fill(glazedHead, 10.95, .18, glass);
  trace([[-4.55, 5.4], ...greatHead, [4.55, 5.4]], .31, .48, stone);
  trace([[-3.69, 10.95], ...glazedHead, [3.69, 10.95]], .17, .37, edge);
  for (const u of [-2.46, -1.23, 0, 1.23, 2.46]) {
    const top = Math.abs(u) > 2 ? 21.02 : Math.abs(u) > 1 ? 21.28 : 21.67;
    rect(u - .10, 11.0, u + .10, top, .34, edge);
  }
  for (const y of [12.25, 13.55, 14.85, 16.15, 17.45])
    rect(-3.64, y, 3.64, y + .105, .30, 0x8d9188);
  for (const u of [-2.46, 0, 2.46]) {
    trace([[u - 1.16, 18.92], [u - .77, 18.02], [u, 17.57], [u + .77, 18.02],
      [u + 1.16, 18.92]], .18, .39, edge);
    trace([[u - 1.02, 17.34], [u - .40, 17.75], [u, 18.45], [u + .40, 17.75],
      [u + 1.02, 17.34]], .145, .38, stone);
  }

  // The projecting double portal has its own two smaller curtain arches.
  for (const u of [-1.80, 1.80]) {
    const portalHead = arch(u, 8.13, 3.22, 2.19);
    fill(portalHead, 5.29, .49, shade);
    rect(u - 1.02, 5.35, u + 1.02, 8.10, .53, door);
    rect(u - .055, 5.44, u + .055, 8.02, .61, 0x495754);
    trace([[u - 1.61, 5.35], ...portalHead, [u + 1.61, 5.35]], .22, .65, stone);
    trace(arch(u, 8.32, 2.60, 1.59), .11, .68, edge);
  }
  rect(-.26, 5.29, .26, 11.56, .76, stone);
  rect(-3.58, 10.73, 3.58, 11.11, .71, shade);
  for (let i = -3; i <= 3; i++)
    trace(arch(i * .97, 11.07, .90, .59), .12, .76, stone);

  // A separate low, multi-light window sits above the main curtain arch.
  const smallHead: Point[] = [[-2.47, 24.12], [-2.1, 24.23], [-1.51, 24.69], [-.87, 24.37],
    [0, 24.29], [.87, 24.37], [1.51, 24.69], [2.1, 24.23], [2.47, 24.12]];
  fill(smallHead, 22.97, .15, glass);
  trace([[-2.47, 22.97], ...smallHead, [2.47, 22.97]], .14, .31, stone);
  for (const u of [-1.54, -.78, 0, .78, 1.54])
    rect(u - .062, 23.0, u + .062, Math.abs(u) > 1 ? 24.53 : 24.28, .27, edge);
  rect(-2.56, 22.83, 2.56, 23.0, .38, shade);
  for (const u of [-3.75, 3.75]) {
    rect(u - .61, 23.03, u + .61, 25.67, .11, 0x958875);
    trace([[u - .61, 23.03], ...arch(u, 24.56, 1.22, .70), [u + .61, 23.03]], .16, .29, stone);
    rect(u - .69, 25.59, u + .69, 25.78, .42, shade);
  }

  // The photograph shows a small upright plaque beside the entrance.
  rect(4.88, 6.83, 5.26, 7.53, .19, 0xd2cbc0);
  trace([[4.99, 7.32], [5.08, 7.41], [5.08, 6.98]], .065, .22, shade);
  return cues;
}

function drawnFacade(cues: readonly Cue[]): Mesh {
  const positions: number[] = [], colors: number[] = [];
  const color = new Color();
  const point = ([u, y]: Point, depth: number) => [
    CENTER_X + DX * u - DZ * depth, y, CENTER_Z + DZ * u + DX * depth,
  ];
  const triangle = (a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  for (const {ring, depth, color: tint} of cues) {
    const front = ring.map(p => point(p, depth)), back = ring.map(p => point(p, .025));
    color.setHex(tint);
    for (const [a, b, c] of ShapeUtils.triangulateShape(ring.map(([x, y]) => new Vector2(x, y)), []))
      triangle(front[a], front[b], front[c]);
    color.multiplyScalar(.80);
    for (let i = 0; i < ring.length; i++) {
      const next = (i + 1) % ring.length;
      triangle(back[i], back[next], front[next]);
      triangle(back[i], front[next], front[i]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors: true, side: DoubleSide});
  const night = new MeshStandardMaterial({vertexColors: true, side: DoubleSide, roughness: .88});
  const mesh = new Mesh(geometry, day);
  mesh.userData = {dayMaterial: day, nightMaterial: night};
  return mesh;
}

function contains(ring: readonly Point[], u: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j];
    if ((b > y) !== (d > y) && u < a + (y - b) * (c - a) / (d - b)) inside = !inside;
  }
  return inside;
}

function nativeFacade(cues: readonly Cue[], blocks: number[][]): Mesh | null {
  const rows: number[][] = [];
  // Rasterize onto the exposed cardinal Z faces of the actual one-metre wall
  // columns. Coalesce adjacent equal cells vertically before allocating buffers.
  const step = .125;
  const sorted = [...cues].sort((a, b) => b.depth - a.depth);
  const firstColumn = Math.floor((CENTER_X - DX * 5.3) / step);
  const lastColumn = Math.ceil((CENTER_X + DX * 5.3) / step);
  const firstCell = Math.floor(BASE_Y / step), endCell = Math.ceil(25.85 / step);
  for (let column = firstColumn; column < lastColumn; column++) {
    const x = (column + .5) * step, u = (x - CENTER_X) / DX;
    const expectedZ = CENTER_Z + DZ * u;
    const front = blocks.reduce((best, [bx, by, bz, w, h, d]) => {
      const face = bz + d / 2;
      return Math.abs(x - bx) < w / 2 && by - h / 2 <= BASE_Y && by + h / 2 >= 25.8 &&
        Math.abs(face - expectedZ) <= 1.45 ? Math.max(best, face) : best;
    }, -Infinity);
    let active: Cue | undefined;
    let start = 0;
    for (let cell = firstCell; cell <= endCell; cell++) {
      const cue = cell === endCell ? undefined : sorted.find(p => contains(p.ring, u, (cell + .5) * step));
      if (cue?.depth === active?.depth && cue?.color === active?.color) continue;
      if (active) {
        if (!Number.isFinite(front)) return null;
        const height = (cell - start) * step, depth = .08 + active.depth * .76;
        rows.push([x, start * step + height / 2, front + depth / 2 - .012,
          step, height, depth, active.color]);
      }
      start = cell;
      active = cue;
    }
  }
  return rows.length ? justicePalaceV183Boxes(rows, true) : null;
}

/** Prepare the replacement before omitting any old rows. The full existing
 * mode-specific recognition and source envelope must both match. */
export function createWeddingCourtV333(site: Recognition, native: boolean) {
  if (site.key !== "wedding" || site.owner !== OWNER) return null;
  const envelope = native ? nativeEnvelopes.sites.find(s => s.key === "wedding") :
    drawnEnvelopes.sites.find(s => s.key === "wedding");
  if (!envelope) return null;
  const envelopeRows = "blocks" in envelope ? envelope.blocks : envelope.surfaces;
  if (control([envelope.key, envelope.owners, envelopeRows]) !== (native ? 1114846709 : 752879898)) return null;
  const rows = native ? site.nativeRows : site.boxes;
  const proof = native ? [site.key, site.owner, rows, site.labels] : [site.key, site.owner, rows, site.rods, site.labels];
  if (control(proof) !== (native ? 3830337895 : 2508507545)) return null;
  const cues = facadeCues();
  const mesh = "blocks" in envelope ? nativeFacade(cues, envelope.blocks) : drawnFacade(cues);
  if (!mesh) return null;
  mesh.name = "Wedding Brunnenplatz curtain arch, tracery and double portal v333";
  const meta = {
    siteKey: "wedding", sourceOwner: OWNER, textureFree: true, requiredBeforeNavigation: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native, fullStaticDetailOnTouch: true,
  };
  Object.assign(mesh.userData, meta);
  const root = new Group();
  root.name = "Amtsgericht Wedding – Brunnenplatz 1, Schaufassade v333";
  root.userData = meta;
  root.add(mesh);
  const retainedRows = outside(rows, native ? NATIVE_ROWS : DRAWN_BOXES);
  if (!native) retainedRows.push(...keepDrawnPlinthEnds(site.boxes[1960]));
  return {
    root: freezeStaticSceneTransforms(root), rows: retainedRows,
    rods: native ? [] : outside(site.rods, DRAWN_RODS), labels: site.labels.slice(1),
  };
}
