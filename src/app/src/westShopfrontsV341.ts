import data from "./data/westShopfrontsV254.json";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

const KIND = "west-shopfronts-v341";
type Plan = { origin: number[]; guards: {mesh:number;kind:string;fingerprint:number}[]; fields:number[][] };
const allowed = new Set(data.ids.filter(key => !key.includes("district188")));
const linear = (value: number) => Math.round((value <= 10.31475 ? value / 255 / 12.92 : ((value / 255 + .055) / 1.055) ** 2.4) * 255);
const METAL = [184, 188, 178].map(linear), SHADOW = [68, 79, 77].map(linear);
function encode(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function* fingerprint(parts: string[]): Generator<void, number> {
  let hash = 2166136261;
  for (const text of parts) for (let at = 0; at < text.length; at += 65536) {
    for (let i = at; i < Math.min(text.length, at + 65536); i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return hash;
}

/** In-aperture sill returns and meeting-stile relief on the retained Ku'damm /
 * Tauentzien commercial glazing. Original pane positions, widths and windows,
 * the v235/v254 complements, navigation and cardinal Native support stay exact. */
export function* prepareWestShopfrontsV341(chunk: SurroundingCityChunk, id: string, native = false): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (!allowed.has(key) || chunk.meshes.some(p => p.kind === KIND)) return chunk;
  const plan = (data.packets as Record<string, Plan>)[key];
  if (!plan || !plan.origin.every((n, i) => n === chunk.origin[i]) || !chunk.meshes.some(p => p.kind === "west-shopfronts-v254")) return chunk;
  for (const guard of plan.guards) {
    const part = chunk.meshes[guard.mesh];
    if (!part || part.kind !== guard.kind || (yield* fingerprint([part.positions, part.colors, part.indices])) !== guard.fingerprint) return chunk;
  }
  const fields = plan.fields.filter(p => p[9] !== 1 && p[7] > .38);
  const positions = new Uint16Array(fields.length * 6 * 12);
  const colors = new Uint8Array(positions.length), indices = new Uint32Array(fields.length * 6 * 6);
  let vertex = 0, index = 0, valid = true;
  for (let field = 0; field < fields.length; field++) {
    const [x,y,z,ux,uz,nx,nz,w,h] = fields[field];
    const quad = (corners: number[][], rgb: number[]) => {
      const start = vertex;
      for (const [u,v,depth] of corners) {
        const p = [x+ux*u+nx*depth, y+v, z+uz*u+nz*depth];
        for (let axis=0;axis<3;axis++) {
          const value=Math.round(p[axis]*100);
          if (value < 0 || value > 65535) valid=false;
          positions[vertex*3+axis]=value;colors[vertex*3+axis]=rgb[axis];
        }
        vertex++;
      }
      for (const offset of [0,1,2,0,2,3]) indices[index++]=start+offset;
    };
    const edge=w/2-.15, bottom=-h/2+.22, top=h/2-.15;
    // Original central mullion is retained between these two slender beads.
    for (const sign of [-1,1]) {
      const a=sign*.092, b=a+sign*.020;
      quad([[a,bottom,.112],[b,bottom,.112],[b,top,.112],[a,top,.112]],METAL);
    }
    // Recessed two-piece sill shows its top and front, clear of all original axes.
    for (const [a,b] of [[-edge,-.13],[.13,edge]]) {
      quad([[a,bottom,.095],[b,bottom,.095],[b,bottom,.13],[a,bottom,.13]],METAL);
      quad([[a,bottom-.035,.13],[b,bottom-.035,.13],[b,bottom,.13],[a,bottom,.13]],SHADOW);
    }
    if (field % 32 === 31) yield;
  }
  if (!valid || !fields.length) return chunk;
  const part: SurroundingPackedMesh = {kind:KIND,positionType:"u16cm",positions:encode(positions),colors:encode(colors),indices:encode(indices)};
  return {...chunk,meshes:[...chunk.meshes,part]};
}
