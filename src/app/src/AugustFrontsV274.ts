import data from "./data/augustFrontsV274.json";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Plan = { origin: number[]; guard: number; records: { mesh: number; kind: string; fingerprint: number }[]; boxes: number[][] };
export type AugustFrontsSourceV274 = { schemaVersion: number; keys?: string[]; chunks: Record<string, { drawn: Plan; minecraft: Plan }> };
const source = data as AugustFrontsSourceV274;
const known = /* @__PURE__ */ (() => new Set(source.keys ?? Object.keys(source.chunks)))();
export const AUGUST_FRONTS_KIND_V274 = "august-fronts-v274";
export const AUGUST_FRONTS_BOX_LIMIT_V274 = 900;
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);

/** Same complete owner/height/ring contract as v233, with cooperative yielding. */
export function* augustFrontsNavigationGuardV274(nav: SurroundingNavigation): Generator<void, number> {
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

/** Adds bounded upper heads and outer reveals of exactly retained panes to the original
 * streamed packet. No glazing or window register is introduced.
 * All earlier meshes/nav survive by identity. No new root,
 * animation, texture, cache or residency allowance. Run after the earlier preparers: all original records must still match;
 * additive prior meshes are accepted and retained by identity. */
export function* prepareAugustFrontsV274(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: AugustFrontsSourceV274 = source,
): Generator<void, SurroundingCityChunk> {
  if (evidence === source && !known.has(id)) return chunk;
  if (chunk.meshes.some(mesh => mesh.kind === AUGUST_FRONTS_KIND_V274)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.chunks,id)) return chunk;
  const plan = evidence.chunks[id][native ? "minecraft" : "drawn"];
  if (evidence.schemaVersion !== 1 || !plan?.boxes.length || plan.boxes.length > AUGUST_FRONTS_BOX_LIMIT_V274 ||
      plan.origin.length !== 3 || chunk.origin.some((v,i)=>v!==plan.origin[i]) || chunk.meshes.length >= 16 ||
      !plan.records.length || plan.records.length > chunk.meshes.length || plan.records.some((r,i)=>r.mesh!==i) ||
      (yield* augustFrontsNavigationGuardV274(chunk.nav)) !== plan.guard) return chunk;
  if (plan.boxes.some(row => row.length!==11 || !row.every(Number.isFinite) ||
      Math.abs(Math.hypot(row[3],row[4])-1)>.000001 || Math.abs(Math.hypot(row[5],row[6])-1)>.000001 ||
      Math.abs(row[3]*row[5]+row[4]*row[6])>.000001 || row.slice(7,10).some(v=>v<=0||v>100) ||
      !Number.isInteger(row[10]) || row[10]<0 || row[10]>0xffffff ||
      (native && !(row[3]===0 || row[4]===0)))) return chunk;
  const vertexCount = plan.boxes.length * 24, indexCount = plan.boxes.length * 36;
  if (chunk.meshes.reduce((n,m)=>n+bytes(m.positions)/6,vertexCount)>400_000 ||
      chunk.meshes.reduce((n,m)=>n+bytes(m.indices)/4,indexCount)>2_400_000) return chunk;
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
  const part: SurroundingPackedMesh = { kind: AUGUST_FRONTS_KIND_V274, positionType: "u16cm",
    positions: encoded(positions), colors: encoded(colours), indices: encoded(indices) };
  return {...chunk, meshes:[...chunk.meshes,part]};
}
