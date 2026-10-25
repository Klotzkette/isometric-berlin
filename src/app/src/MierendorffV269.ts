import data from "./data/mierendorffV269.json";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh, SurroundingPolygon } from "./SurroundingCityGeometry";

type Floor = SurroundingPolygon & { y:number; sourceId:string; step:number };
type Plan = { origin:number[]; guard:number; records:{mesh:number;kind:string;fingerprint:number}[]; boxes:number[][];
  structure:SurroundingPackedMesh|null; structureFingerprint?:number; transfers:{mesh:number;triangles:number[]}[];
  floors:Floor[]; solids:SurroundingNavigation['buildings']; openings:SurroundingPolygon[] };
type Prepared = SurroundingCityChunk & { mierendorffV269?:Plan };
type Navigation = SurroundingNavigation & { mierendorffV269?:{floors:Floor[];openings:SurroundingPolygon[]} };
export type MierendorffSourceV269 = { schema: number; keys: string[]; packets: Record<string, Plan> };
const source = data as MierendorffSourceV269;
const known = /* @__PURE__ */ (() => new Set(source.keys))();
export const MIERENDORFF_KIND_V269 = "mierendorff-v269-details";
export const MIERENDORFF_BOX_LIMIT_V269 = 2200;
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);

/** Same complete owner/height/ring contract as v233, with cooperative yielding. */
export function* mierendorffNavigationGuardV269(nav: SurroundingNavigation): Generator<void, number> {
  let value = 2166136261, points = 0;
  const feed = (s: string) => { for (let i=0;i<s.length;i++) value = Math.imul(value ^ s.charCodeAt(i), 16777619) >>> 0; };
  const numbers = (v: number[]) => feed(v.map(n => Math.floor(n * 1000 + .5)).join(",") + ";");
  numbers([nav.groundY]);
  for (const b of nav.buildings) {
    feed(b.sourceId + ";"); numbers([b.minHeight, b.height, b.groundOffset ?? 0]);
    for (const ring of [b.ring,...b.holes]) {
      feed("[");
      for (const point of ring) { numbers(point); if (++points % 512 === 0) yield; }
      feed("]");
    }
  }
  return value;
}

function encoded(array: ArrayBufferView): string {
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let text = "";
  for (let at=0;at<view.length;at+=8192) text += String.fromCharCode(...view.subarray(at,at+8192));
  return btoa(text);
}

const faces = [
  [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],
  [[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],
  [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],
  [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],
  [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
  [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
];

/** Adds retained-pane relief, mapped park furniture and complete open stairs to the original
 * streamed packet. All earlier meshes/nav survive by identity. No new root,
 * animation, texture, cache or residency allowance. Run after the earlier preparers: all original records must still match;
 * additive prior meshes are accepted and retained by identity. */
export function* prepareMierendorffV269(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: MierendorffSourceV269 = source,
): Generator<void, SurroundingCityChunk> {
  const key=`${native ? "minecraft" : "drawn"}:${id}`;
  if (evidence === source && !known.has(key)) return chunk;
  if (chunk.meshes.some(mesh => mesh.kind === MIERENDORFF_KIND_V269)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets,key)) return chunk;
  const plan = evidence.packets[key];
  if (evidence.schema !== 1 || !plan?.boxes.length || plan.boxes.length > MIERENDORFF_BOX_LIMIT_V269 ||
      plan.origin.length !== 3 || chunk.origin.some((v,i)=>v!==plan.origin[i]) || chunk.meshes.length + (plan.structure ? 2 : 1) > 16 ||
      !plan.records.length || plan.records.length > chunk.meshes.length || plan.records.some((r,i)=>r.mesh!==i) ||
      (yield* mierendorffNavigationGuardV269(chunk.nav)) !== plan.guard) return chunk;
  if (plan.boxes.some(row => row.length!==11 || !row.every(Number.isFinite) ||
      Math.abs(Math.hypot(row[3],row[4])-1)>.000001 || Math.abs(Math.hypot(row[5],row[6])-1)>.000001 ||
      Math.abs(row[3]*row[5]+row[4]*row[6])>.000001 || row.slice(7,10).some(v=>v<=0||v>100) ||
      !Number.isInteger(row[10]) || row[10]<0 || row[10]>0xffffff ||
      (native && !(row[3]===0 || row[4]===0)))) return chunk;
  if (plan.structure) {
    const m=plan.structure;
    if(m.kind!=="mierendorff-v269-structure"||m.positionType!=="u16cm")return chunk;
    let h=2166136261;
    for(const text of [m.positions,m.colors,m.indices])for(let start=0;start<text.length;start+=65_536){
      for(let i=start;i<Math.min(start+65_536,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;
    }
    if(h!==plan.structureFingerprint)return chunk;
  }
  for(const r of plan.transfers)if(!plan.structure||!chunk.meshes[r.mesh]||r.triangles.some(t=>!Number.isSafeInteger(t)||t<0||t>=bytes(chunk.meshes[r.mesh].indices)/12))return chunk;
  const vertexCount = plan.boxes.length * 24, indexCount = plan.boxes.length * 36;
  const extraVertices=plan.structure?bytes(plan.structure.positions)/6:0,extraIndices=plan.structure?bytes(plan.structure.indices)/4:0;
  if (chunk.meshes.reduce((n,m)=>n+bytes(m.positions)/6,vertexCount+extraVertices)>400_000 ||
      chunk.meshes.reduce((n,m)=>n+bytes(m.indices)/4,indexCount+extraIndices)>2_400_000) return chunk;
  for (const record of plan.records) {
    const mesh = chunk.meshes[record.mesh];
    if (!mesh || mesh.kind !== record.kind || mesh.positionType !== "u16cm") return chunk;
    let hash = 2166136261;
    for (const text of [mesh.positions,mesh.colors,mesh.indices]) {
      for (let start=0;start<text.length;start+=65_536) {
        for (let at=start;at<Math.min(start+65_536,text.length);at++) hash=Math.imul(hash^text.charCodeAt(at),16777619)>>>0;
        yield;
      }
    }
    if (hash!==record.fingerprint) return chunk;
  }
  const positions = new Uint16Array(vertexCount*3), colours = new Uint8Array(vertexCount*3), indices = new Uint32Array(indexCount);
  const palette = new Map<number,number[]>();
  let vertex=0,index=0,valid=true;
  for (let at=0;at<plan.boxes.length;at++) {
    const [x,y,z,dx,dz,nx,nz,w,h,depth,rgb] = plan.boxes[at];
    let colour=palette.get(rgb);
    if (!colour) {
      colour=[rgb>>16,(rgb>>8)&255,rgb&255].map(v=>Math.round((v<=10.31475?v/255/12.92:((v/255+.055)/1.055)**2.4)*255));
      palette.set(rgb,colour);
    }
    const positive = dx*nz-dz*nx>0;
    for (const face of faces) {
      const first=vertex;
      for (const [u,v,q] of face) {
        const p=[x+dx*u*w/2+nx*q*depth/2,y+v*h/2,z+dz*u*w/2+nz*q*depth/2];
        for (let axis=0;axis<3;axis++) {
          const value=Math.round(p[axis]*100);
          if (value<0||value>65535) valid=false;
          positions[vertex*3+axis]=value; colours[vertex*3+axis]=colour[axis];
        }
        vertex++;
      }
      for (const offset of positive?[0,1,2,0,2,3]:[0,2,1,0,3,2]) indices[index++]=first+offset;
    }
    if (at%16===15) yield;
  }
  if (!valid) return chunk;
  const part: SurroundingPackedMesh = { kind: MIERENDORFF_KIND_V269, positionType: "u16cm",
    positions: encoded(positions), colors: encoded(colours), indices: encoded(indices) };
  return {...chunk, meshes:[...chunk.meshes,part,...(plan.structure?[plan.structure]:[])],mierendorffV269:plan} as Prepared;
}


/** Exact triangles yield only while their complete matching complement is present. */
export function* applyMierendorffTrianglesV269(chunk:SurroundingCityChunk, mesh:number, indices:Uint16Array|Uint32Array, offset:number):Generator<void,number>{
  const p=(chunk as Prepared).mierendorffV269;
  if(!p?.structure||!chunk.meshes.includes(p.structure))return 0;
  let count=0;
  for(const r of p.transfers)if(r.mesh===mesh)for(const t of r.triangles){
    const at=offset+t*3;if(at+2>=indices.length)throw new Error("Mierendorff ground receipt exceeds original buffer");
    indices[at+1]=indices[at];indices[at+2]=indices[at];if(++count%512===0)yield;
  }
  return count;
}

/** Original ground-membership polygons remain: the local floor takes precedence
 * only inside the four represented openings. Source buildings remain untouched. */
export function mierendorffNavigationV269(chunk:SurroundingCityChunk,nav:SurroundingNavigation):SurroundingNavigation {
  const p=(chunk as Prepared).mierendorffV269;
  if(!p?.structure||!chunk.meshes.includes(p.structure)||(nav as Navigation).mierendorffV269)return nav;
  return {...nav,buildings:[...nav.buildings,...p.solids],mierendorffV269:{floors:p.floors,openings:p.openings}} as Navigation;
}

function inside(ring:number[][],x:number,z:number):boolean {
  let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
}
/** Packet-local ground only; eviction/mode changes remove the entire stair model. */
export function mierendorffFloorAtV269(nav:SurroundingNavigation,x:number,z:number):number|null {
  const stairs=(nav as Navigation).mierendorffV269;if(!stairs||!Number.isFinite(x)||!Number.isFinite(z))return null;
  let y:number|null=null;
  for(const f of stairs.floors)if(inside(f.ring,x,z)&&!f.holes.some(h=>inside(h,x,z)))y=Math.max(y??-Infinity,f.y);
  return y;
}
