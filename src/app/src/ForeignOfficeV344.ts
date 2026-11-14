import { Group } from "three";
import source from "./data/foreignOfficeV344.json";
import { EAST_CIVIC_SOURCES } from "./eastCivicProfile";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const FOREIGN_OFFICE_V344_NAME = "Source-bound Foreign Office street elevations v344";
type Path = typeof source.paths[number];
/** Receipt of the columns actually emitted by EastCivicArchitecture.nativeShell. */
export type ForeignOfficeNativeColumn = {
  ix: number; iz: number; x: number; z: number; partId: string;
  top: number; wallBase: number;
};
const C = { stone: 0xcac7ba, joint: 0xa6a79e, sill: 0xc4c2b7,
  bronze: 0x626b62, glass: 0x435e62, modernGlass: 0x637b7e, metal: 0x848d88 };
const historicRows = [[8.3, 2.6], [13.7, 3.5], [19.2, 3.1], [23.7, 3.1], [28.1, 2.6]];
const bandRows = [10.3, 14, 17.7, 21.4, 25.1];

/** No stale source facade can retire its v148 owner after a source geometry change. */
export function foreignOfficeV344SourceMatches(profiles: unknown = EAST_CIVIC_SOURCES): boolean {
  const encoded = JSON.stringify(profiles);
  if (encoded.length !== source.sourceCharacters) return false;
  let hash = 2166136261;
  for (let i = 0; i < encoded.length; i++) hash = Math.imul(hash ^ encoded.charCodeAt(i), 16777619) >>> 0;
  return hash === source.sourceGuard;
}

/** These six public elevations only; courts, church, source sheets and other wings remain owned by v148. */
export function foreignOfficeV344OwnsEdge(partId: string, edge: number): boolean {
  return source.paths.some(p => p.part === partId && edge >= p.first && edge < p.last);
}

function edge(path: Path, index: number): PerimeterFacadeEdge {
  return { startXZ: path.points[index], endXZ: path.points[index + 1], outwardSide: path.outwardSide,
    wallBaseY: path.base, wallTopY: path.top, street: path.street, prismId: path.part };
}

function at(path: Path, distance: number): { edge: PerimeterFacadeEdge; u: number } {
  let u = distance;
  for (let i = 0; i < path.points.length - 1; i++) {
    const e = edge(path, i), length = perimeterEdgeLength(e);
    if (u <= length || i === path.points.length - 2) return { edge: e, u: Math.min(u, length) };
    u -= length;
  }
  throw new Error("Missing Foreign Office facade path");
}

function ribbon(b: GendarmenmarktFacadeBuilder, path: Path, y: number, height: number,
  color: number, out = .16, depth = .14): void {
  for (let i = 0; i < path.points.length - 1; i++) {
    const e = edge(path, i), length = perimeterEdgeLength(e);
    if (length > .015) b.face(e, length / 2, y, length + .01, height, depth, color, out);
  }
}

function oldWindow(b: GendarmenmarktFacadeBuilder, e: PerimeterFacadeEdge,
  u: number, y: number, width: number, height: number): void {
  if (y - height / 2 < e.wallBaseY || y + height / 2 > e.wallTopY) return;
  b.window(e, u, y, width, height, C.sill, C.bronze, C.glass, false, .22);
  // Bronze transoms and narrow side lights, not the old bright thick square outline.
  if (!b.minecraft) {
    b.face(e, u, y + height * .25, width, .065, .075, C.bronze, .34);
    for (const side of [-1, 1]) b.face(e, u + side * width * .31, y, .055, height, .075, C.bronze, .34);
  } else b.face(e, u, y, .10, height, .08, C.bronze, .34);
}

function drawnPath(b: GendarmenmarktFacadeBuilder, path: Path): void {
  if (path.kind === "historic" || path.kind === "monumental") {
    const monumental = path.kind === "monumental";
    const rows = monumental ? [[18.1, 3.0], [22.8, 3.0], [27.5, 2.7]] : historicRows;
    const pitch = path.length / path.bays;
    for (let i = 0; i < path.bays; i++) {
      const p = at(path, (i + .5) * pitch);
      for (const [y, height] of rows) oldWindow(b, p.edge, p.u, y, Math.min(1.65, pitch * .61), height);
    }
    if (monumental) for (let i = 0; i < 24; i++) {
      const p = at(path, (i + .5) * path.length / 24);
      oldWindow(b, p.edge, p.u, 11.1, 2.05, 6.25);
      const column = at(path, i * path.length / 24 + .20);
      b.face(column.edge, column.u, 10.35, .68, 10.1, .55, C.sill, .40);
      for (const y of [5.5, 15.45]) b.face(column.edge, column.u, y, .91, .27, .68, C.stone, .43);
    }
    // Exact curved source path, including every short arc segment formerly discarded.
    for (const y of monumental ? [5.9, 15.8, 31.6] : [5.9, 10.65, 16.0, 31.6]) {
      ribbon(b, path, y, y > 30 ? .34 : .17, C.sill, .21, y > 30 ? .50 : .28);
    }
    for (let y = 6.35; y < 31.1; y += .86) ribbon(b, path, y, .025, C.joint, .065, .045);
    return;
  }
  const e = edge(path, 0), length = path.length;
  if (path.kind === "bands") {
    for (const y of bandRows) {
      b.face(e, length / 2, y, length - 1.8, 2.85, .12, C.modernGlass, .21, "glass");
      for (let i = 1; i < path.bays; i++) {
        const u = .9 + i * (length - 1.8) / path.bays;
        b.face(e, u, y, .075, 2.85, .09, C.metal, .31);
      }
      for (const dy of [-1.45, 1.45]) b.face(e, length / 2, y + dy, length - 1.7, .11, .22, C.metal, .27);
      b.face(e, length / 2, y - .43, length - 1.8, .06, .07, C.metal, .31);
    }
    const groundBays = Math.floor(length / 3.8);
    for (let i = 0; i < groundBays; i++) oldWindow(b, e, (i + .5) * length / groundBays, 7.1, 1.7, 2.7);
    for (const y of [5.55, 8.48, 12.15, 15.85, 19.55, 23.25, 27.45]) ribbon(b, path, y, .065, C.joint, .055, .04);
    return;
  }
  // The glazed Lichthof facade remains its original measured source sheet.
  // Narrow slats and stays make its vertical curtain legible without filling the atrium.
  for (let i = 0; i <= path.bays; i++) {
    const u = .25 + i * (length - .5) / path.bays;
    b.face(e, u, 17.1, .075, 23.0, .10, C.metal, .20);
    if (i % 2 === 0) b.face(e, u + .18, 18.4, .25, 20.2, .05, 0x879b98, .12, "glass");
  }
  for (const y of [5.7, 9.0, 12.8, 16.6, 20.4, 24.2, 28.7]) b.face(e, length / 2, y, length - .4, .09, .10, C.metal, .20);
  for (const u of [length * .25, length * .5, length * .75]) {
    for (const side of [-1, 1]) b.face(e, u + side * .8, 7.0, .10, 2.6, .13, C.metal, .26);
    b.face(e, u, 8.3, 1.7, .10, .13, C.metal, .26);
  }
}

function nearest(path: Path, x: number, z: number): { distance: number; nx: number; nz: number } {
  let best = { distance: Infinity, nx: 0, nz: 0 };
  for (let i = 0; i < path.points.length - 1; i++) {
    const [ax, az] = path.points[i], [bx, bz] = path.points[i + 1], dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (l * l)));
    const distance = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (distance < best.distance) best = { distance, nx: -dz / l * path.outwardSide, nz: dx / l * path.outwardSide };
  }
  return best;
}

function nativePaths(b: GendarmenmarktFacadeBuilder, columns: readonly ForeignOfficeNativeColumn[]) {
  const grid = new Map(columns.map(p => [`${p.ix},${p.iz}`, p]));
  const counts: Record<string, number> = Object.fromEntries(source.paths.map(p => [p.key, 0]));
  const probes: { path: string; edge: PerimeterFacadeEdge; column: ForeignOfficeNativeColumn }[] = [];
  for (const p of columns) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const neighbour = grid.get(`${p.ix + nx},${p.iz + nz}`);
    const base = Math.max(p.wallBase, neighbour?.top ?? 5.2), top = p.top - .44;
    if (top - base < 1) continue;
    const x = p.x + nx, z = p.z + nz;
    const candidates = source.paths.filter(path => path.part === p.partId).map(path => ({ path, near: nearest(path, x, z) }))
      .filter(({ near }) => near.distance < 1.55 && near.nx * nx + near.nz * nz > .48)
      .sort((a, b) => a.near.distance - b.near.distance);
    if (!candidates.length) continue;
    const path = candidates[0].path;
    // Tangent (nz,-nx) has left normal (nx,nz): every new Native member is cardinal.
    const e: PerimeterFacadeEdge = { startXZ: [x - nz, z + nx], endXZ: [x + nz, z - nx], outwardSide: 1,
      wallBaseY: base, wallTopY: top, street: path.street, prismId: path.part };
    counts[path.key]++; probes.push({ path: path.key, edge: e, column: p });
    if (path.kind === "bands") {
      for (const y of bandRows) if (y - 1.425 >= base && y + 1.425 <= top) {
        b.face(e, 1, y, 2.01, 2.85, .10, C.modernGlass, .12, "glass");
        b.face(e, 1, y, .10, 2.85, .08, C.metal, .22);
        for (const dy of [-1.45, 1.45]) b.face(e, 1, y + dy, 2.01, .11, .16, C.metal, .18);
      }
      oldWindow(b, e, 1, 7.1, 1.3, 2.7);
    } else if (path.kind === "curtain") {
      b.face(e, 1, (base + top) / 2, .10, top - base, .10, C.metal, .14);
      for (const y of [9, 12.8, 16.6, 20.4, 24.2, 28.7]) if (y > base && y < top) b.face(e, 1, y, 2.01, .10, .10, C.metal, .14);
    } else {
      const rows = path.kind === "monumental" ? [[11.1, 6.25], [18.1, 3], [22.8, 3], [27.5, 2.7]] : historicRows;
      for (const [y, height] of rows) oldWindow(b, e, 1, y, 1.24, height);
      for (const y of path.kind === "monumental" ? [5.9, 15.8, 31.3] : [5.9, 10.65, 16, 31.3]) {
        if (y > base && y < top) b.face(e, 1, y, 2.01, .17, .25, C.sill, .17);
      }
    }
  }
  // Translate the twenty-four monumental source stations onto the actual stepped
  // Native wall. Retiring the old rotated pilasters must not lose this order.
  const north = source.paths.find(p => p.key === "reichsbank-north")!;
  const northFaces = probes.filter(p => p.path === north.key);
  for (let i = 0; i < 24 && northFaces.length; i++) {
    const station = at(north, i * north.length / 24 + .2);
    const target = b.point(station.edge, station.u, 0, 0);
    const host = northFaces.reduce((best, candidate) => {
      const centre = (p: typeof candidate) => b.point(p.edge, 1, 0, 0);
      const distance = (p: typeof candidate) => { const q = centre(p); return Math.hypot(q[0] - target[0], q[2] - target[2]); };
      return distance(candidate) < distance(best) ? candidate : best;
    });
    const e = host.edge;
    if (e.wallBaseY > 5.3 || e.wallTopY < 15.6) continue;
    const dx = (e.endXZ[0] - e.startXZ[0]) / 2, dz = (e.endXZ[1] - e.startXZ[1]) / 2;
    const u = Math.max(.4, Math.min(1.6, (target[0] - e.startXZ[0]) * dx + (target[2] - e.startXZ[1]) * dz));
    b.face(e, u, 10.35, .62, 10.1, .44, C.sill, .35);
    for (const y of [5.5, 15.45]) b.face(e, u, y, .82, .27, .55, C.stone, .38);
  }
  return { counts, probes };
}

export function createForeignOfficeV344(minecraft = false, columns?: readonly ForeignOfficeNativeColumn[]): Group | null {
  if (!foreignOfficeV344SourceMatches() || (minecraft && !columns?.length)) return null;
  const b = new GendarmenmarktFacadeBuilder(minecraft, true, 0);
  const native = minecraft ? nativePaths(b, columns!) : undefined;
  if (native && Object.values(native.counts).some(n => n === 0)) return null;
  if (!minecraft) for (const path of source.paths) drawnPath(b, path);
  const root = b.finish(FOREIGN_OFFICE_V344_NAME);
  Object.assign(root.userData, { sourceGuard: source.sourceGuard, sourceSha256: source.sourceSha256,
    sourcePartIds: [...new Set(source.paths.map(p => p.part))], sourcePaths: source.paths.map(p => p.key),
    nativeFaceCounts: native?.counts, nativeFaceProbes: native?.probes,
    displayEstimates: source.estimates, windowProbes: b.windowProbes, photographsBundled: false });
  return freezeStaticSceneTransforms(root);
}
