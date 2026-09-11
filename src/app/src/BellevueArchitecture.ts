import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import { BELLEVUE_SOURCE as S, BELLEVUE_IDS, BELLEVUE_MAIN_ID, BELLEVUE_OFFICE_ID, BELLEVUE_PROFILE, BELLEVUE_GROUP, MINECRAFT_BELLEVUE_GROUP, bellevueContains, bellevueRoofTopAt, bellevueOfficeLocal, bellevueOfficeRoofTopAt } from "./bellevueProfile";

type Point = [number, number];
type Triple = [number, number, number];
type Part = Pick<PrismBuilding, "id" | "ring" | "holes" | "y0_dm" | "h_dm">;
export type BellevueVoxels = { cell_m: number; grid: { min_x_idx: number; min_z_idx: number }; building_rows?: Array<Array<[number, number, number, number, number]>>; buildings?: Array<[number, number, number, number, number]> };
export type BellevueOptions = { mobileLike?: boolean; voxels?: BellevueVoxels; diagnostics?: boolean };
export type BellevueBlock = { position: Triple; size: Triple; quaternion: [number, number, number, number]; color: number; role: string; sourceId: string; normal?: Point; glass?: boolean };
export type BellevueWall = { part: Part; edge: number; a: Point; dx: number; dz: number; nx: number; nz: number; length: number };
const C = { plaster: 0xe9e5d3, bright: 0xf0ecdf, stone: 0xc6c4b6, recess: 0x7b8079, glass: 0x44585b, frame: 0xdedfd6, roof: 0x62594f, tile: 0x766b60, dark: 0x333d3e, metal: 0xabb9b7, solar: 0x526572, gold: 0xa28a49 };
type Plan = { blocks: BellevueBlock[]; positions: number[]; colors: number[]; mc: boolean; mobile: boolean; push: Map<string, number> };
function wallKey(w: BellevueWall): string { return `${w.part.id}:${w.edge}`; }
export function bellevueWalls(): BellevueWall[] {
  const result: BellevueWall[] = [];
  for (const part of S.prisms) {
    const ring = part.ring, area = ring.reduce((s, p, i) => { const b = ring[(i + 1) % ring.length]; return s + p[0] * b[1] - b[0] * p[1]; }, 0), sign = area > 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) { const a: Point = [ring[i][0] / 10, ring[i][1] / 10], b = ring[(i + 1) % ring.length], length = Math.hypot(b[0] / 10 - a[0], b[1] / 10 - a[1]); if (length < 1) continue; const dx = (b[0] / 10 - a[0]) / length, dz = (b[1] / 10 - a[1]) / length; result.push({ part, edge: i, a, dx, dz, nx: sign * dz, nz: -sign * dx, length }); }
  }
  return result;
}
function at(w: BellevueWall, u: number, y: number, out: number): Triple { return [w.a[0] + u * w.dx + out * w.nx, y, w.a[1] + u * w.dz + out * w.nz]; }
function add(p: Plan, position: Triple, size: Triple, color: number, role: string, sourceId: string, yaw = 0, normal?: Point, glass = false, roll = 0): void {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw); if (roll) q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll));
  p.blocks.push({ position, size, quaternion: q.toArray(), color, role, sourceId, normal, glass });
}
function box(p: Plan, w: BellevueWall, u: number, y: number, out: number, width: number, height: number, depth: number, color: number, role: string, glass = false): void {
  add(p, at(w, u, y, out + (p.push.get(wallKey(w)) ?? 0)), [width, height, depth], color, role, w.part.id, -Math.atan2(w.dz, w.dx), [w.nx, w.nz], glass);
}
function beam(p: Plan, a: Triple, b: Triple, width: number, color: number, role: string, sourceId: string): void {
  const aa = new Vector3(...a), bb = new Vector3(...b), delta = bb.clone().sub(aa); if (delta.length() < .001) return;
  p.blocks.push({ position: aa.lerp(bb, .5).toArray(), size: [width, delta.length(), width], quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()).toArray(), color, role, sourceId });
}
function triangle(p: Plan, a: Triple, b: Triple, c: Triple, color: number): void {
  p.positions.push(...a, ...b, ...c); const col = new Color(color); for (let i = 0; i < 3; i++) p.colors.push(col.r, col.g, col.b);
}
function polygon(p: Plan, rings: number[][][], color: number): void {
  const n = new Vector3(), r = rings[0];
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; n.x += (a[1] - b[1]) * (a[2] + b[2]); n.y += (a[2] - b[2]) * (a[0] + b[0]); n.z += (a[0] - b[0]) * (a[1] + b[1]); }
  const dominant = Math.abs(n.y) > Math.abs(n.x) ? Math.abs(n.y) > Math.abs(n.z) ? 1 : 2 : Math.abs(n.x) > Math.abs(n.z) ? 0 : 2;
  const projected = rings.map(r => r.map(v => dominant === 1 ? new Vector2(v[0], v[2]) : dominant === 0 ? new Vector2(v[2], v[1]) : new Vector2(v[0], v[1]))), flat = rings.flat();
  for (const [a, b, c] of ShapeUtils.triangulateShape(projected[0], projected.slice(1))) triangle(p, flat[a] as Triple, flat[b] as Triple, flat[c] as Triple, color);
}
function sourceBodies(p: Plan): void {
  if (p.mc) return;
  for (const part of S.palace.parts) { const prism = S.prisms.find(b => b.id === part.id.slice(-8))!, offset = prism.y0_dm / 10 - part.ground_y_m;
    for (const s of part.surfaces) polygon(p, s.rings.map(r => r.map(v => [v[0], v[1] + offset, v[2]])), s.kind === "RoofSurface" ? C.roof : C.plaster);
  }
  const ring = S.prisms.find(b => b.id === BELLEVUE_OFFICE_ID)!.ring;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], top = BELLEVUE_PROFILE.office.eaves;
    polygon(p, [[[a[0] / 10, 5.2, a[1] / 10], [b[0] / 10, 5.2, b[1] / 10], [b[0] / 10, top, b[1] / 10], [a[0] / 10, top, a[1] / 10]]], C.dark);
  }
}
/** Whole facade groups share one displacement so reveals never overtake panes. */
function sourceClearance(walls: BellevueWall[], voxels?: BellevueVoxels): Map<string, number> {
  const result = new Map<string, number>(); if (!voxels) return result;
  const cell = voxels.cell_m, columns: number[][] = [], add = (xi: number, zi: number, lo: number, hi: number) => { const x = xi * cell, z = zi * cell; if (x > -1432 && x < -1186 && z > 68 && z < 300) columns.push([x, z, lo / 10, hi / 10]); };
  voxels.building_rows?.forEach((row, zi) => { const z = voxels.grid.min_z_idx + zi; if (z * cell < 68 || z * cell > 300) return; for (const [xi, n, lo, hi] of row) for (let j = 0; j < n; j++) add(voxels.grid.min_x_idx + xi + j, z, lo, hi); }); voxels.buildings?.forEach(([x, z, lo, hi]) => add(x, z, lo, hi));
  const clip = (r: Point[], v: number, greater: boolean): Point[] => { const out: Point[] = []; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], ia = greater ? a[0] >= v : a[0] <= v, ib = greater ? b[0] >= v : b[0] <= v; if (ia) out.push(a); if (ia !== ib) { const t = (v - a[0]) / (b[0] - a[0]); out.push([v, a[1] + t * (b[1] - a[1])]); } } return out; };
  for (const w of walls) { let push = 0; for (const [x, z, lo, hi] of columns) { if (lo > (w.part.y0_dm + w.part.h_dm) / 10 || hi < w.part.y0_dm / 10) continue;
      let ring: Point[] = [[x, z], [x + cell, z], [x + cell, z + cell], [x, z + cell]].map(([x, z]) => [(x - w.a[0]) * w.dx + (z - w.a[1]) * w.dz, (x - w.a[0]) * w.nx + (z - w.a[1]) * w.nz]);
      ring = clip(clip(ring, .15, true), w.length - .15, false); if (ring.length && Math.min(...ring.map(p => p[1])) <= .06 && Math.max(...ring.map(p => p[1])) < 4.9) push = Math.max(push, Math.max(...ring.map(p => p[1])) + .06);
    } result.set(wallKey(w), Math.max(0, push)); }
  return result;
}
function window(p: Plan, w: BellevueWall, u: number, y: number, width: number, height: number, ornate: boolean): void {
  box(p, w, u, y, .08, width + .26, height + .28, .10, C.recess, "window reveal");
  box(p, w, u, y, .19, width, height, .055, C.glass, "window glazing", true);
  for (const side of [-1, 1]) box(p, w, u + side * (width / 2 + .10), y, .27, .16, height + .32, .16, C.bright, "plaster window surround");
  box(p, w, u, y - height / 2 - .13, .32, width + .45, .18, .4, C.bright, "stone window sill");
  box(p, w, u, y + height / 2 + .14, .29, width + .43, .17, .24, C.bright, "plaster window lintel");
  box(p, w, u, y, .32, p.mc ? .12 : .065, height, .065, C.frame, "window centre mullion");
  for (const t of p.mobile ? [0] : [-.25, 0, .25]) box(p, w, u, y + height * t, .34, width, p.mc ? .105 : .05, .065, C.frame, "window transom");
  if (ornate) { const yy = y + height / 2 + .34, rise = .68, half = width * .72, out = .36 + (p.push.get(wallKey(w)) ?? 0);
    if (p.mc) for (let i = 0; i < 3; i++) box(p, w, u, yy + (i + .5) * rise / 3, .32, half * 2 * (1 - (i + .5) / 3), rise / 3, .26, C.bright, "window triangular pediment");
    else triangle(p, at(w, u - half, yy, out), at(w, u + half, yy, out), at(w, u, yy + rise, out), C.bright);
    for (const side of [-1, 1]) beam(p, at(w, u + side * half, yy, out + .04), at(w, u, yy + rise, out + .04), .12, C.stone, "window pediment moulding", w.part.id);
  }
}
function oculus(p: Plan, w: BellevueWall, u: number, y: number): void {
  const n = p.mc ? 8 : p.mobile ? 12 : 20, out = .24 + (p.push.get(wallKey(w)) ?? 0);
  if (p.mc) { box(p, w, u, y, .12, 1.04, .77, .14, C.glass, "mezzanine oval glazing", true); }
  for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, b = (i + 1) * 2 * Math.PI / n; const aa = at(w, u + Math.cos(a) * .55, y + Math.sin(a) * .39, out), bb = at(w, u + Math.cos(b) * .55, y + Math.sin(b) * .39, out); if (!p.mc) triangle(p, at(w, u, y, out - .05), aa, bb, C.glass); beam(p, aa, bb, p.mc ? .15 : .115, C.bright, "mezzanine oval surround", w.part.id); }
  box(p, w, u, y, .34, .065, .67, .075, C.frame, "mezzanine oval mullion");
}
function palaceFacades(p: Plan, walls: BellevueWall[]): void {
  const major = new Set([BELLEVUE_MAIN_ID, "PPLhh2YS", "4t36BBCS", "PhIgkjw2", "y128osGU"]);
  const outside = (w: BellevueWall, u: number, y: number) => { const q = at(w, u, y, .4); return ![...S.prisms, ...S.neighbours].some(b => b.id !== w.part.id && y >= b.y0_dm / 10 && y <= (b.y0_dm + b.h_dm) / 10 && bellevueContains(b, q[0], q[2])); };
  for (const w of walls.filter(w => major.has(w.part.id) && w.length > 3)) {
    const main = w.part.id === BELLEVUE_MAIN_ID, front = main && w.edge === 0, eaves = main ? 20.5 : w.part.id === "PPLhh2YS" || w.part.id === "4t36BBCS" ? 17.0 : 13.85;
    const n = front ? 19 : Math.max(1, Math.round(w.length / (main ? 3.87 : 3.6))), pitch = w.length / n;
    for (let i = 0; i < n; i++) { const u = (i + .5) * pitch;
      const rows = main ? [[9.25, 3.5], [15.5, 3.65]] : eaves > 16 ? [[6.9, 1.55], [10.8, 2.7], [14.6, 2.0]] : [[7.0, 1.45], [10.8, 2.55]];
      for (const [y, h] of rows) if (outside(w, u, y) && !(front && i === 9 && y < 12)) window(p, w, u, y, main ? 1.8 : 1.38, h, front && y < 12 && i !== 3 && i !== 15);
      if (front) oculus(p, w, u, 18.83);
      if (!outside(w, u, eaves - .5)) continue;
      for (const [y, h, d] of [[5.65, .43, .22], [eaves - .77, .16, .32], [eaves - .35, .35, .48], [eaves + .02, .22, .65]]) box(p, w, u, y, .16, pitch + .01, h, d, C.bright, "palace continuous cornice");
      if (main && front && !p.mobile) for (let j = 0; j < 6; j++) box(p, w, u + (j - 2.5) * pitch / 6, eaves - .53, .4, .15, .22, .25, C.stone, "eaves dentil");
      if (!main) for (let j = 0; j < (p.mobile ? 5 : 9); j++) box(p, w, u, 5.65 + j * (3.15 / (p.mobile ? 5 : 9)), .065, pitch, .036, .09, C.stone, "wing basement rustication course");
    }
    if (front) palaceCentre(p, w);
  }
}
function palaceCentre(p: Plan, w: BellevueWall): void {
  const u = w.length / 2, out = .58 + (p.push.get(wallKey(w)) ?? 0), width = 14.8, base = 20.55, rise = 3.7;
  for (const du of [-6.0, -2.25, 2.25, 6.0]) { box(p, w, u + du, 13.74, .43, .46, 12.36, .44, C.bright, "Corinthian central pilaster"); for (const [yy, ww, hh] of [[7.55, .81, .25], [19.67, .85, .29], [19.34, .66, .34]]) box(p, w, u + du, yy, .55, ww, hh, .62, C.bright, "pilaster base or capital"); if (!p.mobile) for (const side of [-1, 1]) box(p, w, u + du + side * .29, 19.44, .88, .24, .31, .18, C.stone, "capital volute"); }
  box(p, w, u, 9.0, .39, 2.2, 4.0, .09, 0x62594c, "central entrance door");
  for (const side of [-1, 1]) box(p, w, u + side * 1.25, 9.0, .55, .24, 4.3, .32, C.bright, "central entrance jamb");
  for (let i = 0; i < 8; i++) box(p, w, u, 5.4 + i * .215, 1.0 + (7 - i) * .31, 15.0 - i * .12, .215, .65, C.stone, "central entrance stair");
  box(p, w, u, base - .4, .42, width + .35, .6, .85, C.bright, "central entablature");
  if (p.mc) for (let i = 0; i < 8; i++) box(p, w, u, base + (i + .5) * rise / 8, .45, width * (1 - (i + .5) / 8), rise / 8, .6, C.bright, "central stepped pediment");
  else triangle(p, at(w, u - width / 2, base, out), at(w, u + width / 2, base, out), at(w, u, base + rise, out), C.bright);
  for (const side of [-1, 1]) beam(p, at(w, u + side * width / 2, base, out + .18), at(w, u, base + rise, out + .18), .26, C.stone, "central raking cornice", w.part.id);
  for (const path of letteringStrokePaths("BELLEVUE", .43)) for (let i = 1; i < path.length; i++) beam(p, at(w, u - path[i - 1][0], 20.1 + path[i - 1][1], out + .22), at(w, u - path[i][0], 20.1 + path[i][1], out + .22), .044, C.gold, "BELLEVUE gilded lettering", w.part.id);
  const n = p.mc ? 12 : 24; for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, b = (i + 1) * 2 * Math.PI / n; beam(p, at(w, u + Math.cos(a) * .64, 22.08 + Math.sin(a) * .64, out + .23), at(w, u + Math.cos(b) * .64, 22.08 + Math.sin(b) * .64, out + .23), .09, C.gold, "pediment clock surround", w.part.id); }
  box(p, w, u, 22.08, .70, .82, .88, .08, C.stone, "pediment clock field"); beam(p, at(w, u, 22.08, out + .32), at(w, u + .18, 22.46, out + .32), .055, C.gold, "clock hand", w.part.id); beam(p, at(w, u, 22.08, out + .32), at(w, u - .37, 22.12, out + .32), .055, C.gold, "clock hand", w.part.id);
  for (const du of [-7.25, 0, 7.25]) { const yy = du === 0 ? base + rise + .25 : base + .4; box(p, w, u + du, yy, .26, .74, .28, .73, C.stone, "pediment allegory plinth"); box(p, w, u + du, yy + .86, .27, .50, 1.42, .39, C.stone, "agriculture hunting fishing figure"); box(p, w, u + du, yy + 1.74, .28, .35, .43, .34, C.bright, "allegory head"); for (const side of [-1, 1]) beam(p, at(w, u + du, yy + 1.25, .30), at(w, u + du + side * .55, yy + .73, .34), .17, C.stone, "allegory arm", w.part.id); }
}
function palaceRoofs(p: Plan, walls: BellevueWall[]): void {
  // The survey contains hipped roofs, not invented ranks of dormers. The DOP
  // supports sparse flush roof lights, ridge fittings and two centre chimneys.
  const main = walls.find(w => w.part.id === BELLEVUE_MAIN_ID && w.edge === 0)!;
  for (const u of [main.length * .43, main.length * .57]) { const q = at(main, u, 0, -7.7), y = bellevueRoofTopAt(q[0], q[2]) ?? 26.9; add(p, [q[0], y + .75, q[2]], [1.12, 1.5, 1.12], C.stone, "palace ridge chimney", main.part.id, -.674); add(p, [q[0], y + 1.53, q[2]], [1.38, .14, 1.38], C.dark, "chimney cap", main.part.id, -.674); }
  for (const w of walls.filter(w => [BELLEVUE_MAIN_ID, "4t36BBCS", "PPLhh2YS"].includes(w.part.id) && w.length > 30)) for (const t of [.24, .75]) { const q = at(w, w.length * t, 0, -3.2), y = bellevueRoofTopAt(q[0], q[2], w.part.id); if (y === null) continue; add(p, [q[0], y + .10, q[2]], [1.12, .17, 1.55], C.glass, "flush palace roof light", w.part.id, -Math.atan2(w.dz, w.dx), undefined, true); }
  if (!p.mobile) for (const w of walls.filter(w => [BELLEVUE_MAIN_ID, "4t36BBCS", "PPLhh2YS"].includes(w.part.id) && w.length > 30)) { for (let k = 1; k < 7; k++) { const d = -.8 - k * .7, count = Math.floor(w.length / 2); for (let i = 0; i < count; i++) { const a = at(w, w.length * i / count, 0, d), b = at(w, w.length * (i + 1) / count, 0, d), ay = bellevueRoofTopAt(a[0], a[2], w.part.id), by = bellevueRoofTopAt(b[0], b[2], w.part.id); if (ay !== null && by !== null) beam(p, [a[0], ay + .02, a[2]], [b[0], by + .02, b[2]], p.mc ? .09 : .045, C.tile, "hipped roof tile course", w.part.id); } } }
}
function office(p: Plan, walls: BellevueWall[]): void {
  const o = BELLEVUE_PROFILE.office, id = BELLEVUE_OFFICE_ID;
  const point = (u: number, v: number, y: number): Triple => [o.centre[0] + Math.cos(o.yaw) * u + Math.sin(o.yaw) * v, y, o.centre[1] - Math.sin(o.yaw) * u + Math.cos(o.yaw) * v];
  for (const w of walls.filter(w => w.part.id === id)) { const n = Math.max(1, Math.round(w.length / 3.2)), pitch = w.length / n;
    for (let i = 0; i < n; i++) { const u = (i + .5) * pitch; for (let floor = 0; floor < 3; floor++) { const y = 9.2 + floor * 4.55, width = Math.min(1.9, pitch * .63); box(p, w, u, y, .09, width + .20, 3.1, .12, 0x161f22, "office recessed window surround"); box(p, w, u, y, .21, width, 2.87, .08, 0x6f8487, "office window glazing", true); box(p, w, u, y, .3, .095, 2.84, .06, 0x9eaaa7, "office window centre mullion"); if (!p.mobile) for (const side of [-1, 1]) box(p, w, u + side * width * .33, y, .29, .04, 2.84, .07, C.dark, "office glazing vertical frame"); }
      if (!p.mobile) for (let j = 0; j < 8; j++) box(p, w, u, 6.2 + j * 1.94, .06, pitch, .027, .05, 0x596160, "polished stone panel joint");
    }
    box(p, w, w.length / 2, o.eaves - .13, .07, w.length + .01, .27, .32, 0x596567, "office stone eaves rim");
  }
  const n = p.mobile ? 64 : 96, outer = S.prisms.find(b => b.id === id)!.ring, ar = o.radii[0] * o.lanternScale[0], br = o.radii[1] * o.lanternScale[1];
  const roofRing = Array.from({length:n}, (_,i) => { const t=i*2*Math.PI/n; return point(Math.cos(t)*ar,Math.sin(t)*br,o.top); });
  if (!p.mc) { polygon(p, [outer.map(q=>[q[0]/10,o.eaves+.1,q[1]/10])], C.solar); polygon(p,[roofRing],0xa7bbc0); }
  for (let i = 0; i < n; i++) { const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,aa=point(Math.cos(a)*ar,Math.sin(a)*br,o.lanternBase),bb=point(Math.cos(b)*ar,Math.sin(b)*br,o.lanternBase),ta=point(Math.cos(a)*ar,Math.sin(a)*br,o.top),tb=point(Math.cos(b)*ar,Math.sin(b)*br,o.top);
    if (!p.mc) polygon(p,[[aa,bb,tb,ta]],C.bright); else add(p,[(aa[0]+bb[0])/2,(o.lanternBase+o.top)/2,(aa[2]+bb[2])/2],[Math.hypot(bb[0]-aa[0],bb[2]-aa[2])+.02,o.top-o.lanternBase,.23],C.bright,"elliptical lantern wall",id,-Math.atan2(bb[2]-aa[2],bb[0]-aa[0]));
    beam(p,ta,tb,p.mc?.19:.12,C.bright,"elliptical lantern roof rim",id);
    if (i%2===0) { const mid=(a+b)/2,pa=point(Math.cos(mid)*ar,Math.sin(mid)*br,o.lanternBase+.60); add(p,pa,[p.mc?1.3:1.8,.53,.08],0x748387,"lantern side ventilation panel",id,o.yaw-Math.atan2(br*Math.cos(mid),-ar*Math.sin(mid))); }
  }
  // The current DOP resolves one raised central strip and a white lattice
  // above glazing. These are roof fields, not a fabricated open-air courtyard.
  add(p,point(0,0,o.top+.035),[56,.08,8.8],0x87979b,"lantern central service strip",id,o.yaw);
  const pitch = p.mobile ? 2.8 : 1.75;
  for (let u=-ar+pitch;u<ar;u+=pitch) { const extent=br*Math.sqrt(Math.max(0,1-u*u/(ar*ar))); if(extent<1)continue;beam(p,point(u,-extent,o.top+.12),point(u,extent,o.top+.12),p.mc?.18:.115,C.bright,"glass roof transverse grid",id); }
  for(let v=-br+pitch;v<br;v+=pitch){const extent=ar*Math.sqrt(Math.max(0,1-v*v/(br*br)));beam(p,point(-extent,v,o.top+.13),point(extent,v,o.top+.13),p.mc?.18:.11,C.bright,"glass roof longitudinal grid",id);}
  for(const u of [-25,0,25])add(p,point(u,0,o.top+.25),[4.1,.42,5.3],0xa4b1b1,"office roof service enclosure",id,o.yaw);
  for(let i=0;i<outer.length;i++){const a=outer[i],b=outer[(i+1)%outer.length],centre:Point=[(a[0]+b[0])/20,(a[1]+b[1])/20],local=bellevueOfficeLocal(...centre);const len=Math.hypot(b[0]-a[0],b[1]-a[1])/10,scale=.94;beam(p,[a[0]/10,o.eaves+.18,a[1]/10],[b[0]/10,o.eaves+.18,b[1]/10],.08,C.metal,"solar perimeter frame",id);if(len>2)beam(p,point(local[0]*scale,local[1]*scale,o.eaves+.19),point(local[0]*.79,local[1]*.79,o.eaves+.19),.085,C.metal,"radial solar panel division",id);}
}
function minecraftRoofs(p: Plan): void {
  if (!p.mc) return; const cell=p.mobile?2.4:1.6;
  for(const part of S.prisms){const xs=part.ring.map(q=>q[0]/10),zs=part.ring.map(q=>q[1]/10);for(let xi=Math.floor(Math.min(...xs)/cell);xi<=Math.floor(Math.max(...xs)/cell);xi++)for(let zi=Math.floor(Math.min(...zs)/cell);zi<=Math.floor(Math.max(...zs)/cell);zi++){const x=(xi+.5)*cell,z=(zi+.5)*cell;if(!bellevueContains(part,x,z))continue;const y=bellevueRoofTopAt(x,z,part.id);if(y===null)continue;add(p,[x,y-.62,z],[cell,1.24,cell],part.id===BELLEVUE_OFFICE_ID?(bellevueOfficeRoofTopAt(x,z)>24?0xa7bbc0:C.solar):C.roof,"source roof block",part.id);}}
}
function make(payload: { buildings: readonly Part[] } | undefined, options:BellevueOptions, mc:boolean):Group {
  const walls=bellevueWalls(),p:Plan={blocks:[],positions:[],colors:[],mc,mobile:mc&&!!options.mobileLike,push:mc?sourceClearance(walls,options.voxels):new Map()};
  sourceBodies(p);palaceFacades(p,walls);palaceRoofs(p,walls);minecraftRoofs(p);office(p,walls);
  const root=new Group();root.name=mc?MINECRAFT_BELLEVUE_GROUP:BELLEVUE_GROUP;
  const attach=(mesh:Mesh,luminous:boolean)=>{const day=mesh.material,night=new MeshStandardMaterial({color:0xffffff,vertexColors:!(mesh instanceof InstancedMesh),side:DoubleSide,roughness:.82,emissive:luminous?0xffd395:0,emissiveIntensity:luminous?.24:0});mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;mesh.userData.sourceBounded=true;root.add(mesh);};
  if(p.positions.length){const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(p.positions,3));g.setAttribute("color",new Float32BufferAttribute(p.colors,3));g.computeVertexNormals();const mesh=new Mesh(g,new MeshBasicMaterial({vertexColors:true,side:DoubleSide}));mesh.name="Bellevue exact source walls, hipped roofs and architectural fields";attach(mesh,false);}
  const cube=new BoxGeometry(1,1,1);cube.deleteAttribute("uv");const m=new Matrix4(),q=new Quaternion(),v=new Vector3(),s=new Vector3(),c=new Color();
  for(const glass of mc?[false]:[false,true]){const blocks=mc?p.blocks:p.blocks.filter(b=>!!b.glass===glass);if(!blocks.length)continue;const mesh=new InstancedMesh(cube,new MeshBasicMaterial({color:0xffffff}),blocks.length);mesh.name=`${root.name} ${glass?"glazing":"detail blocks"}`;blocks.forEach((b,i)=>{m.compose(v.fromArray(b.position),q.fromArray(b.quaternion),s.fromArray(b.size));mesh.setMatrixAt(i,m);mesh.setColorAt(i,c.setHex(b.color));});mesh.computeBoundingBox();mesh.computeBoundingSphere();attach(mesh,glass);}
  root.userData.architecturalProfile=BELLEVUE_PROFILE;root.userData.geometryStatus=BELLEVUE_PROFILE.sourceStatus;root.userData.minecraft=mc;root.userData.mobileLike=p.mobile;root.userData.detailCounts={sourcePrisms:S.prisms.length,mainFrontBays:19,wingFloors:3,pedimentFigures:3,officeFloors:3,instances:p.blocks.length};root.userData.inputSourceMatches=payload?.buildings.filter(p=>BELLEVUE_IDS.has(p.id)).length??15;if(options.diagnostics)root.userData.blocks=p.blocks;freezeStaticSceneTransforms(root);return root;
}
export function createBellevueArchitecture(prisms?:{buildings:readonly Part[]},options:BellevueOptions={}):Group{return make(prisms,options,false);}
export function createMinecraftBellevueArchitecture(prisms?:{buildings:readonly Part[]},options:BellevueOptions={}):Group{return make(prisms,options,true);}
