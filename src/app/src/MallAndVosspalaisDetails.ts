import { BoxGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { bebelplatzPartContains } from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import { LEIPZIGER_MALL_PASSAGE_PART, LEIPZIGER_SOURCE_PARTS, LEIPZIGER_SOURCE_PROFILES, leipzigerMallRoofRib, LEIPZIGER_VOSSPALAIS_PROFILE as V, leipzigerSourceRoofAt } from "./leipzigerPlatzSourceProfile";

type P = [number, number, number];
type Axis = { a: readonly number[]; b: readonly number[]; outward?: number };
type Kind = "blocks" | "rounds" | "ornament";
const UP = new Vector3(0, 1, 0);
const C = { red: 0xa66b54, light: 0xc08b6a, shadow: 0x775547, glass: 0x4f6266, frame: 0xe2dcc9, roof: 0x696c65, stone: 0xc9c4b5, joint: 0xaca695, bronze: 0x6c6450 };
export const MALL_VOSS_DETAIL_GROUP = "Mall parcel fronts and historic Voss Palais relief";
export const MINECRAFT_MALL_VOSS_DETAIL_GROUP = "Block-native Mall and Voss Palais facades";
const length = (a: Axis) => Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]);
const yaw = (a: Axis) => -Math.atan2(a.b[1] - a.a[1], a.b[0] - a.a[0]);
function at(a: Axis, u: number, y: number, out = .2): P {
  const l = length(a), dx = (a.b[0] - a.a[0]) / l, dz = (a.b[1] - a.a[1]) / l, side = a.outward ?? 1;
  return [a.a[0] + dx * u + dz * out * side, y, a.a[1] + dz * u - dx * out * side];
}
class Batch {
  rows = new Map<Kind, { m: number[]; color: number }[]>();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, p: P, s: P, color: number, q = new Quaternion()): void {
    if (this.minecraft) kind = "blocks";
    const rows = this.rows.get(kind) ?? [];
    rows.push({ m: new Matrix4().compose(new Vector3(...p), q, new Vector3(...s)).toArray(), color }); this.rows.set(kind, rows);
  }
  box(p: P, s: P, c: number, rotation = 0): void { this.add("blocks", p, s, c, new Quaternion().setFromAxisAngle(UP, rotation)); }
  face(a: Axis, u: number, y: number, w: number, h: number, c: number, out = .2, d = .16): void { this.box(at(a, u, y, out + (this.minecraft ? 1.0 : 0)), [w, h, d], c, yaw(a)); }
  beam(a: P, b: P, w: number, c: number): void {
    const delta = new Vector3(...b).sub(new Vector3(...a)), l = delta.length();
    if (l < .001) return;
    this.add("rounds", a.map((v, i) => (v + b[i]) / 2) as P, [w, l, w], c, new Quaternion().setFromUnitVectors(UP, delta.multiplyScalar(1 / l)));
  }
  finish(name: string): Group {
    const root = new Group(); root.name = name;
    root.userData = { textureFree: true, blockNative: this.minecraft, keepInMinecraft: this.minecraft, noHiddenSolidInfill: true };
    const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .87, flatShading: true });
    for (const [kind, rows] of this.rows) {
      const g = kind === "blocks" ? new BoxGeometry(1, 1, 1) : kind === "rounds" ? new CylinderGeometry(.5, .5, 1, 7) : new SphereGeometry(.5, 8, 6);
      g.deleteAttribute("uv"); const m = new InstancedMesh(g, day, 0), matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3), color = new Color();
      rows.forEach((r, i) => { matrices.set(r.m, i * 16); color.setHex(r.color).toArray(colors, i * 3); });
      m.instanceMatrix = new InstancedBufferAttribute(matrices, 16); m.instanceColor = new InstancedBufferAttribute(colors, 3); m.count = rows.length;
      m.name = `${name} ${kind}`; m.userData = { textureFree: true, dayMaterial: day, nightMaterial: night, blockNative: this.minecraft };
      m.computeBoundingBox(); m.computeBoundingSphere(); root.add(m);
    }
    return freezeStaticSceneTransforms(root);
  }
}
function framedWindow(b: Batch, a: Axis, u: number, y: number, w: number, h: number, projection = .2, sandstone = C.light): void {
  b.face(a,u,y,w+.32,h+.3,C.shadow,projection,.16);
  b.face(a,u,y,w,h,C.glass,projection+.12,.09);
  b.face(a,u,y,.095,h,C.frame,projection+.2,.1);
  b.face(a,u,y+.2,w,.085,C.frame,projection+.2,.1);
  for (const side of [-1,1]) b.face(a,u+side*(w/2+.14),y,.17,h+.38,sandstone,projection+.15,.23);
  b.face(a,u,y-h/2-.14,w+.58,.23,sandstone,projection+.28,.40);
  b.face(a,u,y+h/2+.16,w+.5,.22,sandstone,projection+.24,.35);
}
function arch(b: Batch, a: Axis, u: number, y: number, r: number, out: number): void {
  const n = b.minecraft ? 8 : 18;
  for (let i=0;i<n;i++) {
    const t=i*Math.PI/n, v=(i+1)*Math.PI/n;
    b.beam(at(a,u+r*Math.cos(t),y+r*Math.sin(t),out),at(a,u+r*Math.cos(v),y+r*Math.sin(v),out),.25,C.light);
  }
}
function inscription(b: Batch, a: Axis, text: string, y: number, width: number, color: number): void {
  const paths = letteringStrokePaths(text, 1);
  const min = Math.min(...paths.flat().map(p => p[0])), max = Math.max(...paths.flat().map(p => p[0]));
  if (!Number.isFinite(min) || max<=min) return;
  const scale = width / (max-min), left = (length(a)-width)/2;
  for (const path of paths) for(let i=1;i<path.length;i++) {
    const p=path[i-1],q=path[i];
    b.beam(at(a,left+(p[0]-min)*scale,y+p[1]*scale,.54),at(a,left+(q[0]-min)*scale,y+q[1]*scale,.54),b.minecraft?.15:.1,color);
  }
}
function vosspalais(b: Batch): void {
  const a: Axis = { a: V.front[0], b: V.front[1] }, l = length(a), center = l/2;
  // Four street axes: portal, projecting central pair, right shop window.
  b.face(a,center,15.2,l,19.6,C.red,.08,.14);
  for(const y of [5.95,11.6,12.2,17.7,18.15,24.4,25.05]) b.face(a,center,y,l+.12,y===25.05?.48:.24,C.light,.35,.4);
  b.face(a,center,18.2,8.3,11.8,C.red,.37,.70);
  const axes = [.13,.385,.615,.87].map(f=>f*l);
  axes.forEach((u,i)=>{
    const projection = i===1||i===2? .78:.2;
    b.face(a,u,8.7,2.16,4.65,i===3?0x303b3b:C.glass,.22,.12);
    arch(b,a,u,10.36,1.1,.42);
    for(const side of [-1,1]) b.face(a,u+side*1.15,8.5,.22,4.0,C.light,.38,.32);
    if(i<3){b.face(a,u,8.7,.1,4.5,C.frame,.42,.1);b.face(a,u,9.5,2.1,.1,C.frame,.42,.1);}
    framedWindow(b,a,u,15.0,1.8,3.5,projection);
    framedWindow(b,a,u,21.1,1.8,3.85,projection);
    // Triangular Renaissance window crowns stay below the retained cornice.
    if(i===0||i===3) {
      for(const side of [-1,1]) b.beam(at(a,u+side*1.35,23.32,projection+.30),at(a,u,24.1,projection+.30),.23,C.light);
      b.face(a,u,23.3,2.7,.2,C.light,projection+.3,.3);
    }
    b.add("ornament",at(a,u,18.75,projection+.24),[.44,.6,.25],C.light);
  });
  for(const side of [-1,1]) b.beam(at(a,center+side*4.05,23.85,1.05),at(a,center,24.9,1.05),.25,C.light);
  b.face(a,center,23.82,8.1,.22,C.light,.95,.35);
  // The central two-storey oriel is relief on the source front, not a box infill.
  for(const u of [center-3.95,center+3.95]) {
    b.face(a,u,18.3,.45,12.0,C.light,.62,.48);
    for(const y of [12.5,17.6,18.3,24.2]) b.face(a,u,y,.72,.33,C.light,.75,.62);
  }
  b.face(a,center,12.0,8.6,.55,C.light,.85,1.05);
  b.face(a,center,18.05,8.4,.38,C.light,.84,.94);
  // Regular rustication is kept on the masonry piers only.
  for(let y=6.35;y<24.2;y+=.85) for(const u of [.035,.268,.732,.965].map(f=>f*l)) b.face(a,u,y,.58,.075,C.shadow,.33,.07);
  for(let i=0;i<15;i++) {
    const u=(i+.5)*l/15;b.face(a,u,24.45,.25,.62,C.light,.47,.48);
    b.add("ornament",at(a,u,24.3,.67),[.31,.30,.28],C.light);
  }
  // Surviving high niches and shield reliefs: procedural, not photographic casts.
  for(const f of [.266,.734]) {
    const u=f*l;b.face(a,u,20.8,.8,2.75,C.shadow,.36,.12);
    b.add("ornament",at(a,u,21.65,.58),[.4,.48,.3],C.light);
    b.add("rounds",at(a,u,20.65,.55),[.47,1.6,.33],C.light);
    b.face(a,u,19.72,.86,.22,C.light,.60,.48);
    b.add("ornament",at(a,u,15.05,.40),[.78,1.03,.27],C.light);
  }
  const upper: Axis={a:V.rearSetback[0],b:V.rearSetback[1]};
  for(const y of [26.6,29.65]) for(let i=0;i<5;i++) framedWindow(b,upper,(i+.5)*length(upper)/5,y,1.7,1.75,.25,0xccc7b7);
}
function mallUpperStoreys(b: Batch): void {
  const mallIds = new Set(LEIPZIGER_SOURCE_PROFILES.filter(p=>p.name.startsWith("Mall of")&&p.parent_id!==LEIPZIGER_MALL_PASSAGE_PART.id).flatMap(p=>p.parts.map(part=>part.id)));
  const parts=LEIPZIGER_SOURCE_PARTS.filter(p=>mallIds.has(p.id));
  for(const part of parts) for(const surface of part.surfaces) {
    if(surface.kind!=="WallSurface")continue;
    const ring=surface.rings[0];let pair:[number[],number[]]|null=null,max=0;
    for(const p of ring)for(const q of ring){const d=Math.hypot(p[0]-q[0],p[2]-q[2]);if(d>max){max=d;pair=[p,q];}}
    if(!pair||max<5)continue;
    const a:Axis={a:[pair[0][0],pair[0][2]],b:[pair[1][0],pair[1][2]]};
    const mid=at(a,max/2,0,.25);if(bebelplatzPartContains(part,mid[0],mid[2]))a.outward=-1;
    const top=Math.max(...ring.map(p=>p[1])), bottom=Math.min(...ring.map(p=>p[1]));
    const bays=Math.max(1,Math.floor(max/3.7)),pitch=max/bays;
    for(let y=Math.max(24.7,bottom+2);y<top-1.4;y+=3.2)for(let i=0;i<bays;i++) {
      const u=(i+.5)*pitch,p=at(a,u,y,.38);
      if(parts.some(q=>q!==part&&bebelplatzPartContains(q,p[0],p[2])&&(leipzigerSourceRoofAt(q,p[0],p[2])??-Infinity)>y-1))continue;
      framedWindow(b,a,u,y,Math.min(1.45,pitch*.46),1.95,.3,C.stone);
    }
  }
  // Permanent name, rather than temporary store adverts or seasonal decorations.
  const entrance:Axis={a:[487.498,956.571],b:[530.479,992.085],outward:1};
  inscription(b,entrance,"MALL OF BERLIN",21.45,27,C.frame);
  // Double-height storefront subdivisions along the retained square-facing run.
  for(let i=0;i<12;i++){
    const u=(i+.5)*length(entrance)/12;
    b.face(entrance,u,8.1,.13,5.5,C.frame,.33,.16);
    b.face(entrance,u,6.1,.11,1.6,C.bronze,.39,.12);
  }
}
function nativePassage(b: Batch): Group {
  const glass = new Batch(true), p = LEIPZIGER_MALL_PASSAGE_PART;
  // Exact roof heights sampled on the native 2 m grid; no wall/volume fill.
  for(let x=619;x<649;x+=2)for(let z=915;z<993;z+=2) {
    const top=leipzigerSourceRoofAt(p,x,z);
    if(top!==null)glass.box([x,top-.18,z],[2,.36,2],0xa7c1c0);
  }
  for(let rib=0;rib<=8;rib++) {
    const points=leipzigerMallRoofRib(-37+74*rib/8);
    for(let i=1;i<points.length;i++)b.beam(points[i-1],points[i],.19,0xc9c9bd);
    for(const point of [points[0],points[points.length-1]])if(point)b.box([point[0],(point[1]+5.1)/2,point[2]],[.35,point[1]-5.1,.35],0xc9c9bd);
  }
  const root=glass.finish("Block-native open Mall glass canopy");
  root.traverse(object=>{
    if(!(object instanceof InstancedMesh))return;
    for(const material of [object.userData.dayMaterial,object.userData.nightMaterial]){
      material.transparent=true;material.opacity=.4;material.depthWrite=false;
    }
    object.userData.openCoveredPassage=true;
  });
  return root;
}
export function createMallAndVosspalaisDetails(options:{minecraft?:boolean}={}):Group {
  const b=new Batch(!!options.minecraft);vosspalais(b);mallUpperStoreys(b);
  const passage=options.minecraft?nativePassage(b):null;
  const root=b.finish(options.minecraft?MINECRAFT_MALL_VOSS_DETAIL_GROUP:MALL_VOSS_DETAIL_GROUP);
  if(passage)root.add(passage);
  root.userData.vosspalais=V;root.userData.sourcePartIds=LEIPZIGER_SOURCE_PROFILES.filter(p=>p.name.startsWith("Mall of")||p.parent_id===V.parentId).flatMap(p=>p.parts.map(part=>part.id));
  return root;
}
