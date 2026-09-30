import { BoxGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { type BebelplatzSourcePart, bebelplatzPartBounds } from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { FRIEDRICH_MONUMENT_PROFILE as F, PALACES_UDL_SOURCES, PALACES_UDL_GROUP_NAME, MINECRAFT_PALACES_UDL_GROUP_NAME, PALACES_BRIDGE_ID, PALACES_OPEN_COLONNADE_IDS, PALACES_PORTICO_ID, palacesUdlPartContains, palacesUdlPartRoofAt, palacesUdlPartBaseAt } from "./palacesUdlProfile";

type P = [number, number, number];
type Kind = "blocks" | "sculpture" | "columns";
type Axis = { a: readonly [number, number]; b: readonly [number, number]; side: number };
const UP = new Vector3(0, 1, 0), C = { stone: 0xddd2bb, light: 0xefe6d4, recess: 0xb3a690, glass: 0x42595e, frame: 0xb3bab0, roof: 0x955e4b, bronze: 0x405750, bronzeLight: 0x687b66, granite: 0x8e7971, iron: 0x47584b };
const MAIN: Axis = { a: [1691.503, 222.796], b: [1730.44, 219.443], side: 1 };
const EAST: Axis = { a: [1731.935, 227.93], b: [1749.531, 226.27], side: 1 };
const HEAD: Axis = { a: [1663.046, 225.374], b: [1678.497, 224.209], side: 1 };
const GARDEN: Axis = { a: [1667.682, 242.032], b: [1674.798, 310.56], side: -1 };
const WALL: Axis = { a: [1680.776, 247.168], b: [1686.939, 309.242], side: 1 };
const axisLength = (a: Axis) => Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]);
const axisYaw = (a: Axis) => -Math.atan2(a.b[1] - a.a[1], a.b[0] - a.a[0]);
function pt(a: Axis, u: number, y: number, out = .22): P {
  const l = axisLength(a), dx = (a.b[0] - a.a[0]) / l, dz = (a.b[1] - a.a[1]) / l;
  return [a.a[0] + dx * u + dz * out * a.side, y, a.a[1] + dz * u - dx * out * a.side];
}
class Builder {
  batches = new Map<Kind, { matrix: number[]; color: number }[]>();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, p: P, size: P, color: number, rotation = new Quaternion()): void {
    if (this.minecraft) kind = "blocks";
    const list = this.batches.get(kind) ?? [];
    list.push({ matrix: new Matrix4().compose(new Vector3(...p), rotation, new Vector3(...size)).toArray(), color }); this.batches.set(kind, list);
  }
  box(p: P, size: P, color: number, yaw = 0): void { this.add("blocks", p, size, color, new Quaternion().setFromAxisAngle(UP, yaw)); }
  bead(p: P, size: P, color: number): void { this.add("sculpture", p, size, color); }
  beam(a: P, b: P, width: number, color: number): void {
    const d = new Vector3(...b).sub(new Vector3(...a)), l = d.length();
    if (l < .001) return;
    this.add("columns", a.map((n, i) => (n + b[i]) / 2) as P, [width, l, width], color, new Quaternion().setFromUnitVectors(UP, d.multiplyScalar(1 / l)));
  }
  facade(a: Axis, u: number, y: number, w: number, h: number, color: number, out = .22, depth = .18): void { this.box(pt(a, u, y, out), [w, h, depth], color, axisYaw(a)); }
  finish(root: Group): void {
    const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .87, flatShading: true });
    for (const [kind, rows] of this.batches) {
      const g = kind === "blocks" ? new BoxGeometry(1, 1, 1) : kind === "sculpture" ? new SphereGeometry(.5, 10, 7) : new CylinderGeometry(.5, .5, 1, 8);
      g.deleteAttribute("uv"); const mesh = new InstancedMesh(g, day, 0), matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3), color = new Color();
      rows.forEach((r, i) => { matrices.set(r.matrix, i * 16); color.setHex(r.color).toArray(colors, i * 3); });
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = rows.length;
      mesh.name = `${root.name} ${kind}`; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: this.minecraft };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    }
  }
}
/** Clipping changes only explicitly documented false closures; every original sheet stays in the source JSON. */
function clip(ring: number[][], distance: (p: number[]) => number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], da = distance(a), db = distance(b);
    if (da >= -1e-7) out.push(a);
    if ((da < 0) !== (db < 0)) out.push(a.map((v, j) => v + (b[j] - v) * da / (da - db)));
  }
  return out;
}
function displayPart(p: BebelplatzSourcePart, shift: number): BebelplatzSourcePart {
  if (p.id !== PALACES_BRIDGE_ID && p.id !== PALACES_PORTICO_ID && !PALACES_OPEN_COLONNADE_IDS.has(p.id)) return p;
  const surfaces: BebelplatzSourcePart["surfaces"] = [];
  for (const s of p.surfaces) {
    if (s.kind === "RoofSurface") { surfaces.push(s); continue; }
    if (p.id !== PALACES_BRIDGE_ID) {
      const ring = clip(s.rings[0], v => v[1] - (p.top_y_m - .65));
      if (ring.length >= 3) surfaces.push({ kind: s.kind, rings: [ring] });
    } else {
      const axis = (v: number[]) => (v[0] - 1686.65) * .995 + (v[2] - 242.36) * -.099875;
      for (let i = 0; i < 40; i++) {
        const lo = -8 + i * .4, hi = lo + .4, u = (lo + hi) / 2;
        const bottom = palacesUdlPartBaseAt(p, 1686.65 + u * .995, 242.36 - u * .099875) - shift;
        const r = clip(clip(clip(s.rings[0], v => axis(v) - lo), v => hi - axis(v)), v => v[1] - bottom);
        if (r.length >= 3) surfaces.push({ kind: s.kind, rings: [r] });
      }
    }
  }
  return { ...p, surfaces };
}
function window(b: Builder, a: Axis, u: number, y: number, w: number, h: number, ornate = false): void {
  b.facade(a, u, y, w + .35, h + .38, C.recess); b.facade(a, u, y, w, h, C.glass, .34);
  b.facade(a, u, y, .095, h, C.frame, .46); b.facade(a, u, y + .35, w, .1, C.frame, .46);
  for (const side of [-1, 1]) b.facade(a, u + side * (w / 2 + .16), y, .2, h + .45, C.light, .43);
  b.facade(a, u, y - h / 2 - .23, w + .75, .27, C.light, .46, .45);
  if (ornate) { b.facade(a, u, y + h / 2 + .42, w + .75, .32, C.light, .45, .42); b.bead(pt(a, u, y + h / 2 + .72, .55), [.45, .55, .23], C.light); }
}
function balustrade(b: Builder, a: Axis, y: number, spacing = .8): void {
  const l = axisLength(a);
  for (const h of [-.55, .55]) b.facade(a, l / 2, y + h, l, .22, C.light, .24, .4);
  for (let u = .35; u < l; u += b.minecraft ? spacing * 1.8 : spacing) {
    b.add("columns", pt(a, u, y), [.17, .95, .17], C.light);
    if (!b.minecraft) b.bead(pt(a, u, y - .1), [.30, .36, .30], C.light);
  }
}
function person(b: Builder, p: P, h: number, color: number, gesture = 0): void {
  b.bead([p[0], p[1] + h * .88, p[2]], [h * .20, h * .24, h * .2], color);
  b.add("columns", [p[0], p[1] + h * .43, p[2]], [h * .32, h * .73, h * .27], color);
  b.beam([p[0] - h * .13, p[1] + h * .69, p[2]], [p[0] - h * .27, p[1] + h * (.43 + gesture), p[2] + h * .08], h * .10, color);
  b.beam([p[0] + h * .13, p[1] + h * .69, p[2]], [p[0] + h * .24, p[1] + h * .45, p[2] - h * .10], h * .10, color);
}
function palaces(b: Builder): void {
  for (const [a, bays, floors, height] of [[MAIN, 9, [8.7, 14.25, 22.2], 4.75], [EAST, 5, [8.7, 14.25, 22.2], 4.75], [HEAD, 3, [10.0, 16.4], 4.8]] as const) {
    const l = axisLength(a), pitch = l / bays;
    floors.forEach(y => { for (let i = 0; i < bays; i++) window(b, a, (i + .5) * pitch, y, pitch * .48, height, true); });
    for (const y of a === HEAD ? [6.25, 13.05, 20.7, 22] : [6.25, 17.6, 19.1, 26.05]) b.facade(a, l / 2, y, l, .38, C.light, .3, .4);
    for (let i = 0; i <= bays; i++) {
      const u = i * pitch;
      b.facade(a, u, a === HEAD ? 13.2 : 12.25, .54, a === HEAD ? 14.6 : 11.6, C.light, .36, .32);
      if (a !== HEAD) b.facade(a, u, 22.45, .50, 6.05, C.light, .36, .32);
      for (const y of a === HEAD ? [20.3] : [17.75, 25.7]) for (const side of [-1, 1]) b.bead(pt(a, u + side * .21, y, .47), [.35, .30, .25], C.light);
    }
    if (a !== HEAD) balustrade(b, a, 27.15);
  }
  // The portico uses the exact independent LoD2 roof, held by six open columns.
  for (let i = 0; i < 6; i++) {
    const x = 1706.05 + i * 1.94, z = 216.72 - i * .153;
    b.add("columns", [x, 12.35, z], [.62, 13.9, .62], C.light);
    b.box([x, 5.65, z], [.9, .9, .9], C.recess); b.box([x, 19.38, z], [.92, .5, .92], C.light);
  }
  balustrade(b, { a: [1705.74, 216.543], b: [1715.929, 215.747], side: 1 }, 21.87);
  for (let i = 0; i < 4; i++) person(b, [1706.3 + i * 2.6, 28.2, 220.8 - i * .22], 2.35, C.recess, i % 2 * .25);
  const col: Axis = { a: [1730.44, 219.443], b: [1756.7, 217.377], side: 1 };
  for (let i = 0; i <= 10; i++) {
    const p = pt(col, i * axisLength(col) / 10, 9.8, -.65);
    b.add("columns", p, [.55, 8.5, .55], C.light); b.box([p[0], 13.95, p[2]], [.83, .42, .83], C.light);
  }
  // Long historic wing retains the exact mansard and the adjoining garden.
  for (const a of [GARDEN, WALL]) {
    const l = axisLength(a), n = a === GARDEN ? 17 : 15;
    for (let i = 0; i < n; i++) {
      const u = (i + .5) * l / n;
      window(b, a, u, 8.8, 1.6, 3.5); window(b, a, u, 15.0, 1.65, 4.5, true);
      // Dormers supplement the source mansard, never flatten its planes.
      if (i < 6 || i > n - 7) { window(b, a, u, 21.45, 1.2, 2.2); b.beam(pt(a, u - .8, 22.6, -.55), pt(a, u, 23.1, -.55), .18, C.light); b.beam(pt(a, u, 23.1, -.55), pt(a, u + .8, 22.6, -.55), .18, C.light); }
    }
    for (const y of [6.1, 11.2, 18.15, 19.85]) b.facade(a, l / 2, y, l, .28, C.light, .34, .40);
    for (let i = -1; i <= 1; i++) {
      const u = l / 2 + i * l / n;
      b.bead(pt(a, u, 21.4, .4), [1.25, 1.3, .24], C.light); b.bead(pt(a, u, 21.4, .55), [.9, .95, .2], C.glass);
    }
  }
  const bridge: Axis = { a: [1680.934, 239.094], b: [1691.597, 238.036], side: 1 };
  for (const out of [.25, -7.1]) {
    for (let i = 0; i < 3; i++) window(b, bridge, 2.2 + i * 3.0, 18.1, 1.65, 3.2);
    for (let i = 0; i < (b.minecraft ? 10 : 24); i++) {
      const n = b.minecraft ? 10 : 24, a = i * Math.PI / n, z = (i + 1) * Math.PI / n;
      b.beam(pt(bridge, 5.4 + 4.65 * Math.cos(a), 10.5 + 3.6 * Math.sin(a), out), pt(bridge, 5.4 + 4.65 * Math.cos(z), 10.5 + 3.6 * Math.sin(z), out), .28, C.light);
    }
  }
}
function monument(b: Builder): void {
  const yaw = Math.atan2(F.facing[0], F.facing[1]);
  const p = (u: number, y: number, v: number): P => [F.anchor[0] + v * .995 + u * .099875, 5.2 + y, F.anchor[1] - v * .099875 + u * .995];
  const box = (u: number, y: number, v: number, size: P, color: number) => b.box(p(u, y, v), size, color, yaw);
  // Granite support, bronze inscription zone, crowded middle register, relief attic.
  for (const [y, h, w, d, color] of [[.12,.24,5.7,7.7,C.granite],[.75,1.3,5.25,7.1,C.granite],[1.8,.8,4.8,6.5,C.granite],[2.48,.5,5.0,6.7,C.bronze],[3.02,.65,4.55,6.2,C.bronze],[3.5,.3,4.9,6.55,C.bronzeLight],[5,2.75,3.65,5.3,C.bronze],[6.5,.28,4.2,5.85,C.bronzeLight],[7.18,1.08,3.8,5.35,C.bronze],[7.82,.27,4.35,5.85,C.bronzeLight],[8.08,.25,4.1,5.6,C.bronze]] as const) box(0,y,0,[w,h,d],color);
  // Two long relief fields contain shallow gesturing silhouettes; no text texture.
  for (const side of [-1,1]) for (let i = 0; i < 9; i++) {
    person(b, p(side * 1.87, 3.65, -2.35 + i * .58), 1.85 + (i % 3) * .1, C.bronzeLight, i % 2 * .3);
    person(b, p(side * 1.94, 6.68, -2.28 + i * .56), .72, C.bronzeLight, i % 2 * .3);
  }
  function horse(u: number, base: number, v: number, scale: number, king: boolean): void {
    const at = (du: number, y: number, dv: number) => p(u + du * scale, base + y * scale, v + dv * scale);
    const rounded = (p: P, size: P, color: number) => b.add("sculpture", p, size, color, new Quaternion().setFromAxisAngle(UP, yaw));
    rounded(at(0, 2.35, 0), [1.35 * scale, 1.55 * scale, 2.85 * scale], C.bronze);
    rounded(at(0, 2.62, 1.02), [1.10 * scale, 1.65 * scale, 1.25 * scale], C.bronze);
    b.beam(at(0, 2.7, 1.03), at(0, 3.58, 1.62), .90 * scale, C.bronze);
    rounded(at(0, 3.54, 1.88), [.64 * scale, .85 * scale, 1.05 * scale], C.bronze);
    b.beam(at(0, 3.55, 1.91), at(0, 3.2, 2.13), .46 * scale, C.bronze);
    for (const s of [-1,1]) {
      b.beam(at(s * .22, 3.89, 1.66), at(s * .25, 4.20, 1.58), .15 * scale, C.bronze);
      for (const rear of [false,true]) {
        const dv = rear ? -1.05 : 1.05, raised = !rear && s === -1;
        const knee = at(s * .43, raised ? 1.38 : .85, dv + (raised ? .62 : rear ? .25 : .1));
        b.beam(at(s * .43, 2.15, dv), knee, .27 * scale, C.bronze);
        b.beam(knee, at(s * .43, raised ? .7 : .12, dv + (raised ? .40 : rear ? -.2 : .32)), .17 * scale, C.bronze);
        rounded(at(s * .43, raised ? .65 : .12, dv + (raised ? .38 : rear ? -.2 : .38)), [.27 * scale,.22 * scale,.39 * scale], C.bronze);
      }
    }
    b.beam(at(0, 2.78, -1.27), at(.12, 1.3, -1.84), .38 * scale, C.bronze);
    b.beam(at(.12, 1.3, -1.84), at(.26, .98, -2.12), .2 * scale, C.bronze);
    // Rider's separated legs, coat and tricorn retain a recognisable seated silhouette.
    rounded(at(0, 3.62, -.04), [.85 * scale, 1.5 * scale, .68 * scale], C.bronze);
    rounded(at(0, 4.55, .05), [.49 * scale,.62 * scale,.49 * scale], C.bronzeLight);
    if (king) { b.box(at(0,4.94,.05),[1.05*scale,.19*scale,.57*scale],C.bronze,yaw); b.box(at(0,5.14,.05),[.57*scale,.32*scale,.46*scale],C.bronze,yaw); }
    for (const s of [-1,1]) {
      b.beam(at(s*.26,3.4,0),at(s*.58,2.55,.45),.24*scale,C.bronze);
      b.beam(at(s*.58,2.55,.45),at(s*.60,1.75,.28),.19*scale,C.bronze);
      b.beam(at(s*.27,4.0,0),at(s*.48,3.4,.84),.19*scale,C.bronze);
      if (!b.minecraft) b.beam(at(s*.48,3.4,.84),at(s*.31,3.24,2.08),.04*scale,C.bronzeLight);
    }
    for (let i=0;i<5;i++) b.beam(at((i-2)*.13,3.9,-.3),at((i-2)*.20,2.15,-.72),.16*scale,C.bronzeLight);
  }
  horse(0,8.2,0,1,true);
  for (const s of [-1,1]) for (const v of [-1,1]) horse(s*1.62,3.63,v*1.78,.48,false);
  for (const s of [-1,1]) for (let i=0;i<4;i++) person(b,p(-1.1+i*.72,3.7,s*2.75),1.9,C.bronzeLight,.16*(i%2));
  // Cast-iron enclosure remains narrow and free of the road surface beyond it.
  const corners=[[-3.4,-4.9],[3.4,-4.9],[3.4,4.9],[-3.4,4.9]];
  for(let side=0;side<4;side++) {
    const a=corners[side],z=corners[(side+1)%4],len=Math.hypot(z[0]-a[0],z[1]-a[1]),n=Math.ceil(len/(b.minecraft?.62:.32));
    for(const y of [.25,1.03,1.22]) b.beam(p(a[0],y,a[1]),p(z[0],y,z[1]),.075,C.iron);
    for(let i=0;i<=n;i++) {
      const u=a[0]+(z[0]-a[0])*i/n,v=a[1]+(z[1]-a[1])*i/n;
      b.beam(p(u,0,v),p(u,1.28,v),.07,C.iron); b.bead(p(u,1.34,v),[.10,.16,.10],C.bronzeLight);
    }
  }
  for(const [u,v] of corners) { box(u,.7,v,[.22,1.4,.22],C.iron); b.bead(p(u,1.52,v),[.29,.32,.29],C.bronzeLight); }
  // Four restored Strack lamp standards, with code-built scroll arms.
  for (const u of [-4.25, 4.25]) for (const v of [-5.65, 5.65]) {
    box(u, .2, v, [.55, .4, .55], C.iron);
    b.beam(p(u,.3,v),p(u,4.95,v),.17,C.iron);
    for (const y of [.5,.7,1.05,3.5,4.1]) b.bead(p(u,y,v),[.33,.20,.33],C.bronzeLight);
    const s=u>0?-1:1;
    b.beam(p(u,4.95,v),p(u+s*.5,5.3,v),.09,C.iron);
    b.beam(p(u+s*.5,5.3,v),p(u+s*.8,5.08,v),.09,C.iron);
    b.beam(p(u+s*.8,5.08,v),p(u+s*.8,4.72,v),.06,C.iron);
    b.bead(p(u+s*.8,4.61,v),[.40,.52,.40],0xe7dec1);
    box(u+s*.8,4.91,v,[.47,.14,.47],C.iron);
  }
}
function nativeShell(b: Builder): void {
  const cell=1.6, parts=PALACES_UDL_SOURCES.flatMap(s=>s.parts), bounds=parts.map(bebelplatzPartBounds), grid=new Map<string,{x:number;z:number;top:number;base:number;color:number}>();
  for(let ix=Math.floor(Math.min(...bounds.map(r=>r[0]))/cell);ix*cell<Math.max(...bounds.map(r=>r[2]));ix++) for(let iz=Math.floor(Math.min(...bounds.map(r=>r[1]))/cell);iz*cell<Math.max(...bounds.map(r=>r[3]));iz++) {
    const x=(ix+.5)*cell,z=(iz+.5)*cell;let top=-Infinity,base=5.2,color=C.roof;
    for(const part of parts){const y=palacesUdlPartRoofAt(part,x,z);if(y!==null&&y>top){top=y;base=palacesUdlPartBaseAt(part,x,z);color=part.id.startsWith('DEBE3D')&&PALACES_UDL_SOURCES[0].parts.some(s=>s.id===part.id)?0x77776c:C.roof;}}
    if(Number.isFinite(top))grid.set(`${ix},${iz}`,{x,z,top,base,color});
  }
  for(const [key,v] of grid) {
    b.box([v.x,v.top-.24,v.z],[cell,.48,cell],v.color);const [ix,iz]=key.split(',').map(Number);
    const neighbour=Math.min(...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>grid.get(`${ix+dx},${iz+dz}`)?.top??5.2));
    const base=Math.max(v.base,neighbour),h=v.top-.48-base;if(h<=0)continue;const n=Math.ceil(h/2.8);
    for(let i=0;i<n;i++)b.box([v.x,base+(i+.5)*h/n,v.z],[cell,h/n,cell],C.stone);
  }
}
function create(minecraft:boolean):Group {
  const root=new Group();root.name=minecraft?MINECRAFT_PALACES_UDL_GROUP_NAME:PALACES_UDL_GROUP_NAME;
  root.userData={textureFree:true,keepInMinecraft:minecraft,blockNative:minecraft,fullStaticDetailOnTouch:true,sourcePartIds:PALACES_UDL_SOURCES.flatMap(s=>s.parts.map(p=>p.id)),photographsBundled:false};
  const b=new Builder(minecraft);
  if(minecraft)nativeShell(b);else PALACES_UDL_SOURCES.forEach((s,i)=>{const mesh=sourceMesh(s.parts.map(p=>displayPart(p,s.display_y_translation_m)),{wall:C.stone,roof:i===1?C.roof:0x77776c,name:i===1?'Prinzessinnenpalais':'Kronprinzenpalais'});mesh.position.y=s.display_y_translation_m;mesh.userData.sourceGeometryUnchanged=false;mesh.userData.originalRoofSheetsRetained=true;root.add(mesh);});
  palaces(b);monument(b);b.finish(root);return freezeStaticSceneTransforms(root);
}
export function createPalacesAndFriedrich():Group{return create(false);}
export function createMinecraftPalacesAndFriedrich():Group{return create(true);}
