import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Shape, ShapeGeometry, Vector3, BufferGeometry, Float32BufferAttribute } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { createBuilder, finishDrawnGroup, paintGeometry, addCylinder, type Builder } from "./drawnKit";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { BUNDESRAT_GROUP, MINECRAFT_BUNDESRAT_GROUP, BUNDESRAT_IDS, BUNDESRAT_MAIN_ID, BUNDESRAT_PROFILE, BUNDESRAT_SOURCE_PRISMS, BUNDESRAT_TOP, bundesratContains } from "./bundesratProfile";

type Point = [number, number];
type Triple = [number, number, number];
export type BundesratVoxelPayload = { cell_m: number; grid: { min_x_idx: number; min_z_idx: number }; building_rows?: Array<Array<[number, number, number, number, number]>>; buildings?: Array<[number, number, number, number, number]> };
export type BundesratOptions = { mobileLike?: boolean; voxels?: BundesratVoxelPayload; diagnostics?: boolean };
export type BundesratBlock = { position: Triple; size: Triple; quaternion: [number, number, number, number]; color: number; role: string; sourceId: string; normal?: Point; luminous?: boolean };
export type BundesratWall = { part: PrismBuilding; index: number; x: number; z: number; length: number; dx: number; dz: number; nx: number; nz: number };
type Plan = { blocks: BundesratBlock[]; curves: Builder; mobile: boolean; mc: boolean; windows: number; push: Map<string, number> };
const C = { stone: 0xd3c8af, light: 0xe5ddc9, joint: 0xb4a68e, frame: 0xb9afa0, glass: 0x425b61, dark: 0x37423e, bronze: 0x354037, white: 0xd9dfd7 };
const key = (w: BundesratWall): string => `${w.part.id}/${w.index}`;
function at(w: BundesratWall, u: number, y: number, out: number): Triple { return [w.x + w.dx * u + w.nx * out, y, w.z + w.dz * u + w.nz * out]; }
export function bundesratWalls(payload?: { buildings: readonly PrismBuilding[] }): BundesratWall[] {
  const parts = (payload?.buildings ?? BUNDESRAT_SOURCE_PRISMS as unknown as PrismBuilding[]).filter(p => BUNDESRAT_IDS.has(p.id));
  return parts.flatMap(part => [part.ring, ...(part.holes ?? [])].flatMap((ring, ri) => {
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0), sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    return ring.flatMap((a, index) => { const b = ring[(index + 1) % ring.length], dx = (b[0] - a[0]) / 10, dz = (b[1] - a[1]) / 10, length = Math.hypot(dx, dz); if (length < .2) return [];
      return [{ part, index, x: a[0] / 10, z: a[1] / 10, length, dx: dx / length, dz: dz / length, nx: sign * dz / length, nz: -sign * dx / length }]; });
  }));
}
function box(p: Plan, w: BundesratWall, u: number, y: number, out: number, width: number, height: number, depth: number, color: number, role: string, luminous = false, facade = true): void {
  if (facade) out += p.push.get(key(w)) ?? 0;
  p.blocks.push({ position: at(w, u, y, out), size: [width, height, depth], quaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.atan2(w.dz, w.dx)).toArray(), color, role, sourceId: w.part.id, normal: [w.nx, w.nz], luminous });
}
function worldBox(p: Plan, position: Triple, size: Triple, color: number, role: string, yaw = 0): void { p.blocks.push({ position, size, quaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw).toArray(), color, role, sourceId: BUNDESRAT_MAIN_ID }); }
function beam(p: Plan, w: BundesratWall, a: Triple, b: Triple, size: number, color: number, role: string, facade = true): void {
  const push = facade ? p.push.get(key(w)) ?? 0 : 0, aa = new Vector3(...at(w, a[0], a[1], a[2] + push)), bb = new Vector3(...at(w, b[0], b[1], b[2] + push)), v = bb.clone().sub(aa);
  if (p.mc) { const n = Math.max(1, Math.ceil(v.length() / Math.max(.18, size))); for (let i = 0; i < n; i++) worldBox(p, aa.clone().lerp(bb, (i + .5) / n).toArray(), [Math.max(.18, size), Math.max(.18, size), Math.max(.18, size)], color, role); }
  else p.blocks.push({ position: aa.clone().lerp(bb, .5).toArray(), size: [size, v.length(), size], quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), v.normalize()).toArray(), color, role, sourceId: w.part.id });
}
function shape(p: Plan, w: BundesratWall, u: number, y: number, out: number, s: Shape, color: number, luminous = false): void {
  const g = new ShapeGeometry(s, p.mobile ? 10 : 18), m = new Matrix4().set(w.dx, 0, w.nx, w.x + w.dx * u + w.nx * out, 0, 1, 0, y, w.dz, 0, w.nz, w.z + w.dz * u + w.nz * out, 0, 0, 0, 1);
  if (m.determinant() < 0 && g.index) for (let i = 0; i < g.index.count; i += 3) { const b = g.index.getX(i + 1); g.index.setX(i + 1, g.index.getX(i + 2)); g.index.setX(i + 2, b); }
  g.applyMatrix4(m); g.computeVertexNormals(); g.deleteAttribute("uv"); paintGeometry(g, color); (luminous ? p.curves.lamps : p.curves.parts).push(g);
}
function arch(p: Plan, w: BundesratWall, u: number, bottom: number, out: number, width: number, height: number, color: number, luminous = false): void {
  const r = width / 2, rect = height - r;
  if (p.mc) { box(p, w, u, bottom + rect / 2, out, width, rect, .10, color, luminous ? "arched glazing" : "arched stone surround", luminous); const n = p.mobile ? 4 : 6; for (let i = 0; i < n; i++) { const yy = (i + .5) * r / n; box(p, w, u, bottom + rect + yy, out, Math.sqrt(r * r - yy * yy) * 2, r / n, .10, color, luminous ? "arched glazing crown" : "arched stone crown", luminous); } }
  else { const s = new Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, rect); s.absarc(0, rect, r, 0, Math.PI, false); s.closePath(); shape(p, w, u, bottom, out, s, color, luminous); }
}
function window(p: Plan, w: BundesratWall, u: number, bottom: number, width: number, height: number, arched: boolean): void {
  if (arched) { arch(p, w, u, bottom - .12, .12, width + .38, height + .31, C.joint); arch(p, w, u, bottom, .24, width, height, C.glass, true); }
  else { box(p, w, u, bottom + height / 2, .12, width + .3, height + .26, .1, C.joint, "window surround"); box(p, w, u, bottom + height / 2, .24, width, height, .1, C.glass, "window glazing", true); }
  const t = p.mc ? .12 : .085;
  box(p, w, u, bottom + height * .45, .34, t, height * .9, .095, C.frame, "window mullion");
  if (!p.mobile || arched) box(p, w, u, bottom + height * (arched ? .64 : .52), .35, width, t, .10, C.frame, "window transom");
  box(p, w, u, bottom - .14, .27, width + .42, .18, .36, C.light, "stone sill"); if (arched) box(p, w, u, bottom + height + .19, .23, .48, .53, .25, C.light, "arch keystone"); p.windows++;
}
function sourcePush(walls: BundesratWall[], payload?: BundesratVoxelPayload): Map<string, number> {
  const result = new Map<string, number>(); if (!payload) return result;
  const c = payload.cell_m, cols: [number, number, number, number][] = [], add = (xi: number, zi: number, lo: number, hi: number) => { const x = xi * c, z = zi * c; if (x > 574 && x < 712 && z > 1021 && z < 1156) cols.push([x, z, lo / 10, hi / 10]); };
  payload.building_rows?.forEach((row, zi) => { const z = payload.grid.min_z_idx + zi; if (z * c < 1021 || z * c > 1156) return; for (const [x, count, lo, hi] of row) for (let i = 0; i < count; i++) add(payload.grid.min_x_idx + x + i, z, lo, hi); }); payload.buildings?.forEach(([x, z, lo, hi]) => add(x, z, lo, hi));
  const clip = (ring: Point[], edge: number, greater: boolean): Point[] => { const out: Point[] = []; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], ina = greater ? a[0] >= edge : a[0] <= edge, inb = greater ? b[0] >= edge : b[0] <= edge; if (ina) out.push(a); if (ina !== inb) { const t = (edge - a[0]) / (b[0] - a[0]); out.push([edge, a[1] + t * (b[1] - a[1])]); } } return out; };
  for (const w of walls) { let push = 0; for (const [x, z, lo, hi] of cols) { if (lo > (w.part.y0_dm + w.part.h_dm) / 10 || hi < w.part.y0_dm / 10) continue;
      let ring: Point[] = [[x, z], [x + c, z], [x + c, z + c], [x, z + c]].map(([px, pz]) => [(px - w.x) * w.dx + (pz - w.z) * w.dz, (px - w.x) * w.nx + (pz - w.z) * w.nz]); ring = clip(clip(ring, .3, true), w.length - .3, false); if (!ring.length) continue;
      const loD = Math.min(...ring.map(v => v[1])), hiD = Math.max(...ring.map(v => v[1])); if (loD <= .12 && hiD > 0) push = Math.max(push, hiD + .08); } result.set(key(w), push); }
  return result;
}
function portico(p: Plan, w: BundesratWall): void {
  const centre = w.length / 2, width = w.length, start = centre - width * .45, pitch = width * .9 / 5;
  for (let i = 0; i < 5; i++) { const u = start + pitch * (i + .5); window(p, w, u, 13.9, 2.42, 6.15, true); window(p, w, u, 21.42, 1.5, 1.68, false); }
  const out = 2.24 + (p.push.get(key(w)) ?? 0);
  for (let i = 0; i < 6; i++) { const u = start + pitch * i;
    if (p.mc) box(p, w, u, 19.46, 2.24, .96, 11.9, .96, C.stone, "portico column shaft"); else addCylinder(p.curves, C.stone, ...at(w, u, 19.46, out), .49, 11.9, p.mobile ? 10 : 16);
    for (const [y, ww, hh] of [[13.42, 1.46, .23], [13.69, 1.22, .24], [25.3, 1.20, .24], [25.6, 1.54, .33]] as const) box(p, w, u, y, 2.24, ww, hh, ww, C.light, "portico column base or capital");
    if (!p.mc) for (const side of [-1, 1]) { box(p, w, u + side * .48, 25.39, 2.64, .27, .40, .24, C.light, "Corinthian capital volute"); if (!p.mobile) for (let leaf = 0; leaf < 3; leaf++) box(p, w, u + (leaf - 1) * .28, 25.15, 2.68, .13, .38, .16, C.joint, "capital acanthus cut"); }
  }
  for (const [y, height, ww] of [[13.12, .3, width + .6], [25.99, .48, width + 1.9], [26.66, .80, width + 2.2], [27.18, .26, width + 2.7]] as const) box(p, w, centre, y, 1.3, ww, height, 3.2, C.light, "portico entablature");
  const triWidth = width + 2.8, rise = 4.7, y = 27.35;
  if (p.mc) for (let i = 0; i < 10; i++) box(p, w, centre, y + rise * (i + .5) / 10, 2.69, triWidth * (1 - (i + .5) / 10), rise / 10, .5, C.stone, "stepped portico pediment");
  else { const s = new Shape(); s.moveTo(-triWidth / 2, 0); s.lineTo(triWidth / 2, 0); s.lineTo(0, rise); s.closePath(); shape(p, w, centre, y, 2.75, s, C.stone); }
  for (const side of [-1, 1]) { beam(p, w, [centre + side * triWidth / 2, y, 2.98], [centre, y + rise, 2.98], .25, C.light, "pediment raking cornice"); beam(p, w, [centre + side * triWidth * .46, y + .24, 3.05], [centre, y + rise - .45, 3.05], .12, C.joint, "pediment inner moulding"); }
  for (let i = -4; i <= 4; i++) { const u = centre + i * 2.17, h = 3.25 - Math.abs(i) * .51, yy = y + .27;
    box(p, w, u, yy + h * .37, 3.09, Math.abs(i) > 2 ? 1.9 : .83, h * .66, .17, C.light, "historic pediment relief robe"); box(p, w, u + (i < 0 ? .19 : -.12), yy + h * .83, 3.1, .42, .49, .25, C.light, "historic pediment relief head"); beam(p, w, [u - .35, yy + h * .58, 3.12], [u + .6, yy + h * .53, 3.12], .16, C.light, "historic pediment relief arm"); }
  for (const path of letteringStrokePaths("BUNDESRAT", .67)) for (let i = 1; i < path.length; i++) beam(p, w, [centre - path[i - 1][0], 26.32 + path[i - 1][1], 3.00], [centre - path[i][0], 26.32 + path[i][1], 3.00], .065, C.dark, "BUNDESRAT inscription");
  for (const side of [-1, 1]) { const u = centre + side * (width / 2 + 1.1); box(p, w, u, 28.50, -.3, 2.6, 2.4, 2.5, C.stone, "central attic bronze pedestal", false, false); box(p, w, u, 31.71, -.3, 2, 4, .80, C.bronze, "Kirkeby bronze relief", false, false); if (!p.mobile) for (let i = 0; i < 7; i++) box(p, w, u + (i % 2 ? .07 : -.05), 30.0 + i * .51, .15, 1.85, .19, .17, i % 2 ? 0x41483c : 0x26332e, "bronze relief strata", false, false); }
}
function roofs(p: Plan, walls: BundesratWall[]): void {
  for (const index of [19, 32]) { const w = walls.find(q => q.part.id === BUNDESRAT_MAIN_ID && q.index === index)!; for (let i = 0; i < 3; i++) { const u = w.length * (.15 + i * .35); box(p, w, u, 27.57, -1, 2.6, .42, 2.1, C.light, "wing bronze pedestal", false, false); const h = [2.3, 2.8, 2.0][i]; for (let layer = 0; layer < (p.mc ? 4 : 7); layer++) { const n = p.mc ? 4 : 7, t = (layer + .5) / n, width = 1.7 - .55 * t + Math.sin(t * 5 + i) * .22; box(p, w, u + Math.sin(t * 3 + i) * .20, 27.8 + h * t, -1 + Math.sin(t * 4) * .12, width, h / n, 1.15 - t * .2, C.bronze, "Kirkeby wing bronze torso", false, false); } } }
  const r = BUNDESRAT_PROFILE.roof, base = BUNDESRAT_TOP + .15, roofPoint = (u: number, v: number, y: number): Triple => [r.x + Math.cos(r.yaw) * u + Math.sin(r.yaw) * v, y, r.z - Math.sin(r.yaw) * u + Math.cos(r.yaw) * v];
  if (p.mc) { const n = p.mobile ? 10 : 15; for (let i = 0; i < n; i++) { const t = (i + .5) / n; worldBox(p, roofPoint(0, 0, base + t * r.rise), [r.width * (1 - t), r.rise / n, r.depth * (1 - t)], i % 2 ? C.glass : 0x658187, "stepped plenary glass roof", r.yaw); } }
  else {
    const corners: Point[] = [[-r.width / 2, -r.depth / 2], [r.width / 2, -r.depth / 2], [r.width / 2, r.depth / 2], [-r.width / 2, r.depth / 2]], verts: number[] = [];
    for (let i = 0; i < 4; i++) verts.push(...roofPoint(...corners[(i + 1) % 4], base), ...roofPoint(...corners[i], base), ...roofPoint(0, 0, base + r.rise));
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(verts, 3)); g.setIndex(Array.from({length:verts.length/3},(_,i)=>i)); g.computeVertexNormals(); paintGeometry(g, 0x68828a); p.curves.parts.push(g);
    const n = p.mobile ? 8 : 16;
    for (let i = 0; i <= n; i++) { const t = -1 + i * 2 / n, top = base + r.rise * (1 - Math.abs(t)); for (const sign of [-1, 1]) for (const swap of [false, true]) { const a = swap ? roofPoint(t * r.width / 2, sign * r.depth / 2, base) : roofPoint(sign * r.width / 2, t * r.depth / 2, base), b = swap ? roofPoint(t * r.width / 2, sign * Math.abs(t) * r.depth / 2, top) : roofPoint(sign * Math.abs(t) * r.width / 2, t * r.depth / 2, top), aa = new Vector3(...a), bb = new Vector3(...b), v = bb.clone().sub(aa); if (v.length() < .01) continue; p.blocks.push({ position: aa.lerp(bb, .5).toArray(), size: [.075, v.length(), .075], quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), v.normalize()).toArray(), color: C.white, role: "plenary roof glazing rib", sourceId: BUNDESRAT_MAIN_ID }); } }
  }
  for (const [x, z, ww, dd] of [[637.4,1090.9,7,7],[645.3,1090.3,7,7],[653.0,1089.8,7,7],[624.7,1111.8,9,10],[667.7,1108.5,9,10],[644.0,1079.0,11,6],[609.0,1085.4,4.2,4.2],[678.8,1079.9,4.2,4.2],[629.1,1087.0,3.3,3.3],[658.6,1084.7,3.3,3.3]] as const) { worldBox(p,[x,BUNDESRAT_TOP+.18,z],[ww,.20,dd],C.glass,"secondary roof light",r.yaw);worldBox(p,[x,BUNDESRAT_TOP+.31,z],[ww+.28,.15,.14],C.white,"roof light frame",r.yaw);worldBox(p,[x,BUNDESRAT_TOP+.31,z],[.14,.15,dd+.28],C.white,"roof light frame",r.yaw); }
}
function make(payload: { buildings: readonly PrismBuilding[] } | undefined, options: BundesratOptions, mc: boolean): Group {
  const parts = (payload?.buildings ?? BUNDESRAT_SOURCE_PRISMS as unknown as PrismBuilding[]).filter(p => BUNDESRAT_IDS.has(p.id)), walls = bundesratWalls({ buildings: parts }), p: Plan = { blocks: [], curves: createBuilder(), mobile: !!options.mobileLike, mc, windows: 0, push: mc ? sourcePush(walls, options.voxels) : new Map() };
  const neighbours = (payload?.buildings ?? parts).filter(b => b.ring.some(a => a[0] >= 5760 && a[0] <= 7100 && a[1] >= 10200 && a[1] <= 11580));
  const exposed = (w: BundesratWall, u: number, y: number) => { const a = at(w, u, y, .28); return !neighbours.some(b => b.id !== w.part.id && y >= b.y0_dm / 10 && y < (b.y0_dm + b.h_dm) / 10 && bundesratContains(b, a[0], a[2])); };
  for (const w of walls) {
    if (w.length < 2) continue;
    const main = w.part.id === BUNDESRAT_MAIN_ID, front = main && w.index >= 19 && w.index <= 33, base = w.part.y0_dm / 10, top = (w.part.y0_dm + w.part.h_dm) / 10;
    const exact = main ? ({19:6,22:7,23:5,26:5,28:5,29:7,32:6} as Record<number,number>)[w.index] : undefined, bays = exact ?? Math.max(1, Math.floor(w.length / (mc ? 4.8 : 4.2))), pitch = w.length / bays;
    for (let i = 0; i < bays; i++) { const u = (i + .5) * pitch;
      const rows: [number,number][] = main ? [[base+.95,1.65],[base+4.1,3.0],[base+9.3,6.15],[base+16.8,3.1]] : Array.from({length:Math.max(1,Math.floor((top-base)/3.9))},(_,j)=>[base+1.5+j*3.8,2.1]);
      for (let floor = 0; floor < rows.length; floor++) { const [bottom,height] = rows[floor]; if(bottom+height>top-.8||!exposed(w,u,bottom+height/2)||(main&&w.index===26&&floor>1))continue;window(p,w,u,bottom,Math.min(pitch*.48,front?2.42:1.9),height,front&&floor===2); }
      if(!exposed(w,u,base+6.2))continue;
      if(main){for(let row=0;row<(p.mobile||mc?7:14);row++){const yy=base+.25+(row+.5)*7.65/(p.mobile||mc?7:14);box(p,w,u-pitch*.37,yy,.105,pitch*.21,.055,.15,C.joint,"rustication joint");box(p,w,u+pitch*.37,yy,.105,pitch*.21,.055,.15,C.joint,"rustication joint");}if(front&&w.index!==26){box(p,w,u-pitch/2,base+14.75,.21,.63,12.0,.38,C.light,"two-storey pilaster");box(p,w,u-pitch/2,base+20.65,.28,.83,.23,.55,C.light,"pilaster capital");}}
      for(const [yy,hh,dd] of main?[[base+8.02,.28,.40],[top-1.75,.21,.48],[top-.95,.32,.65],[top-.20,.24,.51]]:[[top-.20,.23,.40]])if(exposed(w,u,yy))box(p,w,u,yy,.18,pitch,hh,dd,C.light,"continuous source-wall cornice");
      if(main&&front&&!p.mobile&&!mc&&w.index!==26)for(let d=0;d<5;d++)box(p,w,u+(d-2)*pitch/5,top-1.33,.27,.18,.26,.3,C.light,"eaves dentil");
    }
  }
  const front=walls.find(w=>w.part.id===BUNDESRAT_MAIN_ID&&w.index===26);if(front){portico(p,front);roofs(p,walls);}
  const root=new Group();root.name=mc?MINECRAFT_BUNDESRAT_GROUP:BUNDESRAT_GROUP;const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");const m=new Matrix4(),q=new Quaternion(),v=new Vector3(),scale=new Vector3(),color=new Color();
  for(const luminous of mc?[false]:[false,true]){const blocks=mc?p.blocks:p.blocks.filter(b=>!!b.luminous===luminous);if(!blocks.length)continue;const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.86,emissive:luminous?0xffc777:0,emissiveIntensity:luminous?.3:0}),mesh=new InstancedMesh(geometry,day,blocks.length);mesh.name=`${root.name} ${luminous?"glazing":"detail blocks"}`;blocks.forEach((b,i)=>{m.compose(v.fromArray(b.position),q.fromArray(b.quaternion),scale.fromArray(b.size));mesh.setMatrixAt(i,m);mesh.setColorAt(i,color.setHex(b.color));});mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;mesh.userData.sourceBounded=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();root.add(mesh);}
  const curves=finishDrawnGroup(p.curves,{name:"Bundesrat curved architectural fields",lampEmissive:0xffc777,lampEmissiveIntensity:.3});if(curves)root.add(curves);root.userData.architecturalProfile=BUNDESRAT_PROFILE;root.userData.geometryStatus=BUNDESRAT_PROFILE.sourceStatus;root.userData.minecraft=mc;root.userData.mobileLike=p.mobile;root.userData.detailCounts={sourcePrisms:parts.length,porticoColumns:6,porticoBays:5,bronzeWorks:8,windows:p.windows,instances:p.blocks.length};if(options.diagnostics)root.userData.blocks=p.blocks;freezeStaticSceneTransforms(root);return root;
}
export function createBundesratArchitecture(prisms?: { buildings: readonly PrismBuilding[] },options:BundesratOptions={}):Group{return make(prisms,options,false);}
export function createMinecraftBundesratArchitecture(prisms?: { buildings: readonly PrismBuilding[] },options:BundesratOptions={}):Group{return make(prisms,options,true);}
